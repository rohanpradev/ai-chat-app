import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const rootDir = new URL("..", import.meta.url);
const boolEnv = (name) => ["1", "true", "yes", "on"].includes((process.env[name] ?? "").toLowerCase());

const packageJson = JSON.parse(await readFile(new URL("package.json", rootDir), "utf8"));
const bunVersion = packageJson.packageManager?.replace(/^bun@/, "") || "1";
const kubeVersion = process.env.KUBE_VERSION ?? "1.36.2";

const valuesFiles = [
	"helm/chat-app/values.yaml",
	existsSync(new URL("helm/chat-app/values.local.yaml", rootDir))
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

if (existsSync(new URL(".env", rootDir)) && !boolEnv("DEPLOY_CHECK_USE_VALUES_TEMPLATE")) {
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

const dockerInfo = run({
	args: ["info"],
	command: "docker",
	name: "Check Docker daemon",
	optional: true,
	silent: true,
});

const dockerBuildChecksEnabled = dockerInfo.status === 0 && !boolEnv("DEPLOY_CHECK_SKIP_DOCKER_BUILD_CHECKS");
if (dockerBuildChecksEnabled) {
	const publicBunImage = `oven/bun:${bunVersion}-alpine`;
	const commonBuildArgs = [
		"--build-arg",
		`BUN_DEV_IMAGE=${publicBunImage}`,
		"--build-arg",
		`BUN_RUNTIME_IMAGE=${publicBunImage}`,
		"--build-arg",
		"NGINX_IMAGE=nginx:1.31.3-alpine3.24",
	];

	run({
		args: ["build", "--check", ...commonBuildArgs, "--target", "server-prod", "."],
		command: "docker",
		name: "Dockerfile build check: server-prod",
	});
	run({
		args: ["build", "--check", ...commonBuildArgs, "--target", "client-prod", "."],
		command: "docker",
		name: "Dockerfile build check: client-prod",
	});
	run({
		args: ["build", "--check", "--build-arg", `BUN_DEV_IMAGE=${publicBunImage}`, "-f", "server/Dockerfile.migrate", "."],
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

run({
	args: ["lint", "--strict", "--kube-version", kubeVersion, "helm/chat-app", ...helmValueArgs],
	command: "helm",
	name: "Helm lint",
});

run({
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
	["docker.io/pgvector/pgvector:0.8.5-pg18-trixie", "pgvector-enabled PostgreSQL image"],
	["dhi.io/redis:8.8.1-debian13", "Redis image"],
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
]) {
	assertIncludes(defaultGatewayRender.stdout, needle, label);
}

const noGatewayRender = run({
	args: ["template", "chat-app", "helm/chat-app", "--kube-version", kubeVersion, "-f", "helm/chat-app/values.yaml"],
	command: "helm",
	name: "Helm template production defaults without optional Gateway API CRDs",
	silent: true,
});
assertNotIncludes(noGatewayRender.stdout, "kind: HTTPRoute", "Gateway HTTPRoutes without Gateway API CRDs");

console.log("\nDeployment checks passed.");
