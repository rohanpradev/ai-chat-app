import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const rootDir = new URL("..", import.meta.url);
const boolEnv = (name) => ["1", "true", "yes", "on"].includes((process.env[name] ?? "").toLowerCase());

const kubeVersions = process.env.KUBE_VERSION ? [process.env.KUBE_VERSION] : ["1.35.8", "1.36.4"];
const kubeVersion = kubeVersions.at(-1);

const useValuesTemplate = boolEnv("DEPLOY_CHECK_USE_VALUES_TEMPLATE");
const valuesFiles = [
	"helm/chat-app/values.yaml",
	!useValuesTemplate && existsSync(new URL("helm/chat-app/values.local.yaml", rootDir))
		? "helm/chat-app/values.local.yaml"
		: "helm/chat-app/values.local.yaml.template",
];

const run = ({ args, command, input, name, optional = false, silent = false }) => {
	console.log(`\n==> ${name}`);
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		input,
		stdio: input === undefined ? "pipe" : ["pipe", "pipe", "pipe"],
	});

	if (result.error) {
		if (optional) {
			console.log(`Skipped: ${result.error.message}`);
			return result;
		}

		throw result.error;
	}

	if (result.stdout && !silent) {
		process.stdout.write(result.stdout);
	}

	if (result.stderr && !silent) {
		process.stderr.write(result.stderr);
	}

	if (result.status !== 0 && !optional) {
		throw new Error(`${name} failed with exit code ${result.status}`);
	}

	return result;
};

const assertIncludes = (haystack, needle, label) => {
	if (!haystack.includes(needle)) {
		throw new Error(`Rendered Kubernetes manifest is missing ${label}: ${needle}`);
	}
};

const assertNotIncludes = (haystack, needle, label) => {
	if (haystack.includes(needle)) {
		throw new Error(`Rendered Kubernetes manifest unexpectedly contains ${label}: ${needle}`);
	}
};

const manifestDocument = (rendered, kind, name) => {
	const document = rendered
		.split(/^---\s*$/m)
		.find((candidate) => candidate.includes(`kind: ${kind}`) && candidate.includes(`\n  name: ${name}\n`));

	if (!document) {
		throw new Error(`Rendered Kubernetes manifest is missing ${kind}/${name}.`);
	}

	return document;
};

const expectFailure = ({ args, command, name, stderrIncludes }) => {
	console.log(`\n==> ${name}`);
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		stdio: "pipe",
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status === 0) {
		throw new Error(`${name} unexpectedly succeeded.`);
	}

	const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	if (stderrIncludes && !output.includes(stderrIncludes)) {
		throw new Error(`${name} failed for the wrong reason; expected output to include: ${stderrIncludes}`);
	}
};

if (existsSync(new URL(".env", rootDir)) && !useValuesTemplate) {
	run({
		args: ["scripts/ensure-k8s-secrets.sh"],
		command: "bash",
		name: "Generate local Helm values from .env",
	});
} else {
	console.log("\n==> Generate local Helm values from .env");
	console.log("Skipped: validating with values.local.yaml.template.");
}

const composeConfigResult = run({
	args: ["compose", "-f", "compose.yml", "config", "--format", "json"],
	command: "docker",
	name: "Validate Docker Compose config",
	silent: true,
});

const composeConfig = JSON.parse(composeConfigResult.stdout);
const socketProxyService = composeConfig.services?.["docker-socket-proxy"];
const traefikService = composeConfig.services?.traefik;
const traefikCommand = Array.isArray(traefikService?.command) ? traefikService.command : [];
const traefikVolumes = Array.isArray(traefikService?.volumes) ? traefikService.volumes : [];
const socketProxyVolumes = Array.isArray(socketProxyService?.volumes) ? socketProxyService.volumes : [];

if (!socketProxyService || !traefikService) {
	throw new Error("Compose config must include Traefik and its Docker socket proxy.");
}

if (!traefikCommand.includes("--providers.docker.endpoint=tcp://docker-socket-proxy:2375")) {
	throw new Error("Traefik must use the restricted Docker socket proxy endpoint.");
}

if (!traefikCommand.includes("--providers.docker.constraints=Label(`com.chatapp.traefik.scope`,`edge`)")) {
	throw new Error("Traefik must restrict discovery with a project-owned, non-reserved label.");
}

if (
	!traefikCommand.includes("--global.checknewversion=false") ||
	!traefikCommand.includes("--global.sendanonymoususage=false")
) {
	throw new Error("Traefik outbound version and anonymous usage checks must remain disabled.");
}

if (traefikVolumes.some((volume) => volume.target === "/var/run/docker.sock")) {
	throw new Error("Traefik must not mount the Docker socket directly.");
}

if (
	!socketProxyVolumes.some(
		(volume) =>
			volume.source === "/var/run/docker.sock" && volume.target === "/var/run/docker.sock" && volume.read_only === true,
	)
) {
	throw new Error("Docker socket proxy must own the read-only Docker socket mount.");
}

if (socketProxyService.environment?.POST !== "0") {
	throw new Error("Docker socket proxy must deny write requests.");
}

if (composeConfig.networks?.["chat-app-docker-api"]?.internal !== true) {
	throw new Error("Docker socket proxy network must remain internal.");
}

for (const serviceName of ["client", "server", "migrate", "redis"]) {
	const service = composeConfig.services?.[serviceName];
	if (!service?.cap_drop?.includes("ALL")) {
		throw new Error(`${serviceName} must drop all Linux capabilities.`);
	}
}

for (const serviceName of ["client", "server", "migrate"]) {
	if (composeConfig.services?.[serviceName]?.read_only !== true) {
		throw new Error(`${serviceName} must use a read-only root filesystem.`);
	}
}

if (!traefikService.cap_drop?.includes("ALL") || !traefikService.cap_add?.includes("NET_BIND_SERVICE")) {
	throw new Error("Traefik must drop all capabilities and add back only NET_BIND_SERVICE.");
}

const dockerInfo = run({
	args: ["info"],
	command: "docker",
	name: "Check Docker daemon",
	optional: true,
	silent: true,
});

const dockerBuildChecksEnabled = dockerInfo.status === 0 && !boolEnv("DEPLOY_CHECK_SKIP_DOCKER_BUILD_CHECKS");
if (dockerBuildChecksEnabled) {
	run({
		args: ["build", "--check", "--target", "server-prod", "."],
		command: "docker",
		name: "Dockerfile build check: server-prod",
	});
	run({
		args: ["build", "--check", "--target", "client-prod", "."],
		command: "docker",
		name: "Dockerfile build check: client-prod",
	});
	run({
		args: ["build", "--check", "-f", "server/Dockerfile.migrate", "."],
		command: "docker",
		name: "Dockerfile build check: migration",
	});
} else if (boolEnv("DEPLOY_CHECK_REQUIRE_DOCKER")) {
	throw new Error("Docker daemon is required but is not reachable.");
} else {
	console.log("\n==> Dockerfile build checks");
	console.log("Skipped: Docker daemon is not reachable. Set DEPLOY_CHECK_REQUIRE_DOCKER=1 to fail instead.");
}

const helmValueArgs = valuesFiles.flatMap((file) => ["-f", file]);

for (const supportedKubeVersion of kubeVersions) {
	run({
		args: ["lint", "--strict", "--kube-version", supportedKubeVersion, "helm/chat-app", ...helmValueArgs],
		command: "helm",
		name: `Helm lint (Kubernetes ${supportedKubeVersion})`,
	});
}

const localRender = run({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"--api-versions",
		"gateway.networking.k8s.io/v1",
		"--api-versions",
		"traefik.io/v1alpha1/Middleware",
		...helmValueArgs,
	],
	command: "helm",
	name: "Helm template local values with Gateway API",
	silent: true,
});

const localServerDeployment = manifestDocument(localRender.stdout, "Deployment", "chat-app-server");
const localClientDeployment = manifestDocument(localRender.stdout, "Deployment", "chat-app-client");
assertIncludes(localServerDeployment, "\n  replicas: 1", "a fixed server replica count when HPA is disabled");
assertIncludes(localClientDeployment, "\n  replicas: 1", "a fixed client replica count when HPA is disabled");

const defaultGatewayRender = run({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"--api-versions",
		"gateway.networking.k8s.io/v1",
		"--api-versions",
		"traefik.io/v1alpha1/Middleware",
		"-f",
		"helm/chat-app/values.yaml",
	],
	command: "helm",
	name: "Helm template production defaults with Gateway API",
	silent: true,
});

for (const [needle, label] of [
	["kind: Deployment", "Deployments"],
	["kind: StatefulSet", "StatefulSets"],
	["kind: NetworkPolicy", "NetworkPolicies"],
	["kind: HorizontalPodAutoscaler", "HPAs"],
	["kind: PodDisruptionBudget", "PDBs"],
	["docker.io/pgvector/pgvector:0.8.6-pg18-trixie", "pgvector-enabled PostgreSQL image"],
	["dhi.io/redis:8.10.0-debian13", "Redis image"],
	["curlimages/curl:8.21.0", "Helm test image"],
	["AI_DAILY_TOKEN_LIMIT", "AI quota configuration"],
	["kind: HTTPRoute", "Gateway HTTPRoutes"],
	["startupProbe:", "startup probes"],
	["readinessProbe:", "readiness probes"],
	["livenessProbe:", "liveness probes"],
	["automountServiceAccountToken: false", "disabled service account token mounts"],
	["enableServiceLinks: false", "disabled service link injection"],
	["readOnlyRootFilesystem: true", "read-only root filesystems"],
	["allowPrivilegeEscalation: false", "privilege escalation guard"],
	["type: RuntimeDefault", "RuntimeDefault seccomp"],
	["name: chat-app-secrets", "external production Secret reference"],
]) {
	assertIncludes(defaultGatewayRender.stdout, needle, label);
}

assertNotIncludes(defaultGatewayRender.stdout, "kind: Secret", "inline production Secret material");

const serverDeployment = manifestDocument(defaultGatewayRender.stdout, "Deployment", "chat-app-server");
const clientDeployment = manifestDocument(defaultGatewayRender.stdout, "Deployment", "chat-app-client");
const migrationJob = manifestDocument(defaultGatewayRender.stdout, "Job", "chat-app-migration");
const dbPvc = manifestDocument(defaultGatewayRender.stdout, "PersistentVolumeClaim", "chat-app-db-data");
const redisPvc = manifestDocument(defaultGatewayRender.stdout, "PersistentVolumeClaim", "chat-app-redis-data");

assertNotIncludes(serverDeployment, "\n  replicas:", "server replicas while its HPA is enabled");
assertNotIncludes(clientDeployment, "\n  replicas:", "client replicas while its HPA is enabled");
assertNotIncludes(defaultGatewayRender.stdout, "chat-app-server-uploads", "unused shared server upload storage");
assertNotIncludes(migrationJob, "secretRef:", "the complete application Secret in the migration Job");
assertIncludes(migrationJob, "key: DB_URL", "the migration database URL secret key");
assertIncludes(dbPvc, "helm.sh/resource-policy: keep", "retained PostgreSQL storage");
assertIncludes(redisPvc, "helm.sh/resource-policy: keep", "retained Redis storage");

expectFailure({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"-f",
		"helm/chat-app/values.yaml",
		"--set-string",
		"server.replicaCount=not-a-number",
	],
	command: "helm",
	name: "Reject invalid replica type",
	stderrIncludes: "/server/replicaCount",
});

expectFailure({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"-f",
		"helm/chat-app/values.yaml",
		"--set",
		"server.hpa.minReplicas=10",
		"--set",
		"server.hpa.maxReplicas=2",
	],
	command: "helm",
	name: "Reject inverted HPA bounds",
	stderrIncludes: "server.hpa.minReplicas",
});

expectFailure({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"-f",
		"helm/chat-app/values.yaml",
		"--set",
		"madeUpSetting=true",
	],
	command: "helm",
	name: "Reject unknown top-level values",
	stderrIncludes: "additional properties 'madeUpSetting' not allowed",
});

expectFailure({
	args: ["template", "chat-app", "helm/chat-app", "--set", "db.enabled=false"],
	command: "helm",
	name: "Require an external database host when the chart database is disabled",
	stderrIncludes: "externalDatabase.host",
});

const disposableStorageRender = run({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--set",
		"db.persistence.retainOnDelete=false",
		"--set",
		"redis.persistence.retainOnDelete=false",
	],
	command: "helm",
	name: "Render explicitly disposable stateful storage",
	silent: true,
});
assertNotIncludes(
	manifestDocument(disposableStorageRender.stdout, "PersistentVolumeClaim", "chat-app-db-data"),
	"helm.sh/resource-policy: keep",
	"PostgreSQL retention policy after explicit opt-out",
);
assertNotIncludes(
	manifestDocument(disposableStorageRender.stdout, "PersistentVolumeClaim", "chat-app-redis-data"),
	"helm.sh/resource-policy: keep",
	"Redis retention policy after explicit opt-out",
);

const createdGatewayRender = run({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--namespace",
		"chat-app",
		"--kube-version",
		kubeVersion,
		"--api-versions",
		"gateway.networking.k8s.io/v1",
		"-f",
		"helm/chat-app/values.yaml",
		"--set",
		"exposure.gateway.create=true",
	],
	command: "helm",
	name: "Helm template chart-managed Gateway",
	silent: true,
});
assertIncludes(createdGatewayRender.stdout, "from: Selector", "namespace-restricted Gateway listeners");
assertIncludes(
	createdGatewayRender.stdout,
	'kubernetes.io/metadata.name: "chat-app"',
	"Gateway route namespace selector",
);
assertNotIncludes(createdGatewayRender.stdout, "from: All", "unrestricted cross-namespace Gateway routes");

const digestRender = run({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"-f",
		"helm/chat-app/values.yaml",
		"--set-string",
		`images.server.digest=sha256:${"0".repeat(64)}`,
	],
	command: "helm",
	name: "Helm template immutable image digest override",
	silent: true,
});
assertIncludes(digestRender.stdout, `chat-app-server@sha256:${"0".repeat(64)}`, "digest-pinned server image");

const noGatewayRender = run({
	args: ["template", "chat-app", "helm/chat-app", "--kube-version", kubeVersion, "-f", "helm/chat-app/values.yaml"],
	command: "helm",
	name: "Helm template production defaults without optional Gateway API CRDs",
	silent: true,
});
assertNotIncludes(noGatewayRender.stdout, "kind: HTTPRoute", "Gateway HTTPRoutes without Gateway API CRDs");

console.log("\nDeployment checks passed.");
