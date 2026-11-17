import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const rootDir = new URL("..", import.meta.url);
const boolEnv = (name) => ["1", "true", "yes", "on"].includes((process.env[name] ?? "").toLowerCase());

const kubeVersions = process.env.KUBE_VERSION ? [process.env.KUBE_VERSION] : ["1.35.9", "1.36.5", "1.37.1"];
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

const expectFailure = ({ args, command, input, name, stderrIncludes }) => {
	console.log(`\n==> ${name}`);
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		input,
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

const readTracked = (path) => readFileSync(new URL(path, rootDir), "utf8");
const readYaml = (path) => Bun.YAML.parse(readTracked(path));
const envExample = readTracked(".env.example");
const imageDefaults = readYaml("compose.yml").services;
const chartValues = readYaml("helm/chat-app/values.yaml");
const localChartValues = readYaml("helm/chat-app/values.local.yaml.template");
const testChartValues = readYaml("helm/chat-app/values.test.yaml");
const traefikValues = readYaml("k8s/traefik-values.test.yaml");
const imagePin = ({ repository, tag, digest }) => `${repository}:${tag}@${digest}`;
const exampleValue = (key) => new RegExp(`^${key}=(.+)$`, "m").exec(envExample)?.[1];
const servicePins = {};
for (const [service, variable] of [
	["docker-socket-proxy", "DOCKER_SOCKET_PROXY_IMAGE"],
	["traefik", "TRAEFIK_IMAGE"],
	["db", "POSTGRES_IMAGE"],
	["redis", "REDIS_IMAGE"],
]) {
	const image = exampleValue(variable);
	assert.match(image ?? "", /:[^@\s]+@sha256:[a-f0-9]{64}$/, `${variable} must pin a tag and digest`);
	assert.equal(imageDefaults[service].image, `\${${variable}:-${image}}`, `${service} Compose image default`);
	servicePins[service] = image;
}

const ciWorkflow = readYaml(".github/workflows/ci.yml");
assert.equal(ciWorkflow.jobs["database-regressions"].services.postgres.image, servicePins.db, "CI PostgreSQL image");
assert.equal(imagePin(chartValues.images.db), servicePins.db, "Production PostgreSQL image");
assert.equal(imagePin(localChartValues.images.db), servicePins.db, "Local PostgreSQL image");
assert.equal(imagePin(localChartValues.images.redis), servicePins.redis, "Local Redis image");
assert.equal(imagePin(testChartValues.images.redis), servicePins.redis, "CI Redis image");
assert.equal(traefikValues.image.registry, exampleValue("TRAEFIK_IMAGE_REGISTRY"), "Local Traefik registry");
assert.equal(traefikValues.image.repository, exampleValue("TRAEFIK_IMAGE_REPOSITORY"), "Local Traefik repository");
assert.equal(imagePin(traefikValues.image).replace(/^library\//, ""), servicePins.traefik, "CI Traefik image");
assert.equal(traefikValues.image.tag, exampleValue("TRAEFIK_IMAGE_TAG"), "Local Traefik image tag");
assert.equal(traefikValues.image.digest, exampleValue("TRAEFIK_IMAGE_DIGEST"), "Local Traefik image digest");
assert.equal(traefikValues.versionOverride, exampleValue("TRAEFIK_VERSION_OVERRIDE"), "Local Traefik version override");
for (const image of [chartValues.images.redis, chartValues.tests.image]) {
	assert.match(image.digest, /^sha256:[a-f0-9]{64}$/, `${image.repository} must pin an image digest`);
}

run({
	args: ["scripts/check-toolchain.mjs"],
	command: process.execPath,
	name: "Check runtime and container toolchain pins",
});

run({
	args: ["scripts/check-helm-runtime-config.mjs"],
	command: process.execPath,
	name: "Check Helm credential, port, and volume configuration regressions",
});

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

for (const serviceName of ["client", "server", "migrate"]) {
	const service = composeConfig.services?.[serviceName];
	if (!service?.cap_drop?.includes("ALL")) {
		throw new Error(`${serviceName} must drop all Linux capabilities.`);
	}
}

const redisService = composeConfig.services?.redis;
if (
	redisService?.cap_drop?.length ||
	redisService?.cap_add?.length ||
	!redisService?.security_opt?.includes("no-new-privileges:true")
) {
	throw new Error(
		"Redis must retain its official image startup privileges for permission repair and privilege dropping.",
	);
}

const { db, client, server, migrate } = composeConfig.services;
assert.match(db.healthcheck.test[1], /pg_isready -h 127\.0\.0\.1/, "Compose waits for PostgreSQL TCP readiness");
assert.deepEqual(redisService.healthcheck.test, ["CMD", "redis-cli", "-e", "ping"]);
assert.equal(migrate.depends_on.db.condition, "service_healthy");
assert.equal(server.depends_on.migrate.condition, "service_completed_successfully");
assert.equal(client.healthcheck.test.at(-1), "http://127.0.0.1:8080/health");
assert.match(server.healthcheck.test.at(-1), /'\/ready'/);
assert.equal(server.labels["traefik.http.services.api.loadbalancer.healthcheck.path"], "/ready");
assert.equal(server.stop_grace_period, "40s", "Compose allows the API to drain and close resources");
assert.equal(traefikService.stop_grace_period, "40s");
assert.ok(traefikCommand.includes("--entrypoints.websecure.transport.lifecycle.gracetimeout=30s"));

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
	const [major, minor] = supportedKubeVersion.split(".");
	const version = { gitVersion: `v${supportedKubeVersion}`, major, minor };
	run({
		args: ["scripts/check-k8s-versions.mjs"],
		command: "bun",
		input: JSON.stringify({ clientVersion: version, serverVersion: version }),
		name: `Accept Kubernetes prerequisites (${supportedKubeVersion})`,
	});
	run({
		args: ["lint", "--strict", "--kube-version", supportedKubeVersion, "helm/chat-app", ...helmValueArgs],
		command: "helm",
		name: `Helm lint (Kubernetes ${supportedKubeVersion})`,
	});
}

expectFailure({
	args: ["scripts/check-k8s-versions.mjs"],
	command: "bun",
	input: JSON.stringify({
		clientVersion: { gitVersion: "v1.33.9", major: "1", minor: "33" },
		serverVersion: { gitVersion: "v1.36.5", major: "1", minor: "36+" },
	}),
	name: "Reject unsupported kubectl/server version skew",
	stderrIncludes: "Upgrade kubectl to within one minor version",
});

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
	[`docker.io/pgvector/pgvector@${chartValues.images.db.digest}`, "pgvector-enabled PostgreSQL image"],
	[`dhi.io/redis@${chartValues.images.redis.digest}`, "Redis image"],
	[`curlimages/curl@${chartValues.tests.image.digest}`, "Helm test image"],
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

for (const component of ["db", "redis"]) {
	const { spec } = Bun.YAML.parse(manifestDocument(defaultGatewayRender.stdout, "StatefulSet", `chat-app-${component}`));
	const [container] = spec.template.spec.containers;
	for (const probe of ["startupProbe", "readinessProbe", "livenessProbe"]) {
		const command = container[probe].exec.command;
		if (component === "db") {
			assert.match(command.at(-1), /pg_isready -h 127\.0\.0\.1/, `${component} ${probe} checks the TCP listener`);
		} else {
			assert.deepEqual(command, ["redis-cli", "-e", "ping"], `${component} ${probe} fails on Redis errors`);
		}
	}
	assert.ok(container.startupProbe.periodSeconds * container.startupProbe.failureThreshold >= 300);
	if (component === "redis") {
		assert.equal(container.args[container.args.indexOf("--maxmemory") + 1], "512mb");
		assert.equal(container.resources.limits.memory, "1280Mi", "Redis has headroom for persistence rewrites");
	}
}

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
	args: ["template", "chat-app", "helm/chat-app", "--kube-version", kubeVersion, "--set", "db.enabled=false"],
	command: "helm",
	name: "Require an external database host when the chart database is disabled",
	stderrIncludes: "externalDatabase.host",
});

const disposableStorageRender = run({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
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

const httpGatewayRender = run({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"--api-versions",
		"gateway.networking.k8s.io/v1",
		"--set",
		"exposure.gateway.create=true",
		"--set",
		"exposure.gateway.tls.enabled=false",
	],
	command: "helm",
	name: "Render HTTP-only Gateway",
	silent: true,
});
assertNotIncludes(
	manifestDocument(httpGatewayRender.stdout, "Gateway", '"traefik-gateway"'),
	"protocol: HTTPS",
	"HTTPS listener without a certificate",
);
expectFailure({
	args: [
		"template",
		"chat-app",
		"helm/chat-app",
		"--kube-version",
		kubeVersion,
		"--set",
		"server.terminationGracePeriodSeconds=30",
	],
	command: "helm",
	name: "Require enough time for API drain and shutdown",
	stderrIncludes: "server.terminationGracePeriodSeconds must be at least 40",
});

console.log("\nDeployment checks passed.");
