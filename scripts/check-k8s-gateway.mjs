import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = new URL("..", import.meta.url);
const rootPath = fileURLToPath(rootDir);
const managedPath = `${fileURLToPath(new URL("scripts/bin", rootDir))}${delimiter}${process.env.PATH ?? ""}`;

export const gatewayRuntimeConfiguration = Object.freeze({
	appNamespace: "chat-app-gateway-runtime",
	chart: "oci://ghcr.io/traefik/helm/traefik",
	chartVersion: "42.1.2",
	controllerNamespace: "traefik",
	gatewayApiVersion: "v1.6.3",
	release: "chat-app-gateway-traefik",
	values: "k8s/traefik-values.test.yaml",
});

const runCommand = (command, args, { capture = false, env = process.env, input, optional = false } = {}) => {
	const result = spawnSync(command, args, {
		cwd: rootPath,
		encoding: "utf8",
		env: { ...env, PATH: managedPath },
		input,
		maxBuffer: 16 * 1024 * 1024,
		stdio: capture ? "pipe" : input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
		timeout: 660_000,
	});
	if (result.error || result.status !== 0) {
		if (!optional) throw new Error(`${command} ${args[0]} failed: ${result.error?.message ?? result.status}`);
		console.error(`Optional Gateway diagnostic failed: ${command} ${args[0]}`);
	}
	return result.stdout?.trim() ?? "";
};

// This helper owns only a fresh test controller namespace and Helm release.
// CRDs remain until the disposable kind cluster is removed by its owner.
export const runGatewayRuntime = ({ context, run = runCommand } = {}) => {
	if (!/^kind-[a-z0-9][a-z0-9.-]*$/.test(context ?? "")) {
		throw new Error("Gateway runtime checks require an explicit disposable kind-* context.");
	}
	const clusters = run("kind", ["get", "clusters"], { capture: true }).split(/\s+/);
	if (!clusters.includes(context.slice(5)))
		throw new Error("The requested context is not a registered local kind cluster.");
	const config = gatewayRuntimeConfiguration;
	const kubeArgs = ["--context", context];
	const helmArgs = ["--kube-context", context, "--namespace", config.controllerNamespace];
	const versions = run("kubectl", [...kubeArgs, "version", "--output=json"], { capture: true });
	run("bun", ["--no-env-file", "scripts/check-k8s-versions.mjs"], { input: versions });
	if (
		run("kubectl", [...kubeArgs, "get", "namespace", config.appNamespace, "--ignore-not-found", "-o", "name"], {
			capture: true,
		})
	) {
		throw new Error(`Test namespace ${config.appNamespace} already exists; refusing to reuse it.`);
	}
	const existingCrds = JSON.parse(run("kubectl", [...kubeArgs, "get", "crd", "-o", "json"], { capture: true }));
	if (
		!Array.isArray(existingCrds.items) ||
		existingCrds.items.some((crd) => ["gateway.networking.k8s.io", "traefik.io"].includes(crd.spec?.group))
	) {
		throw new Error(
			"Gateway runtime checks require a fresh disposable cluster without existing Gateway API or Traefik CRDs.",
		);
	}
	let namespaceCreated = false;
	let installAttempted = false;
	let failed = false;
	let failure;
	const cleanupErrors = [];
	try {
		run("kubectl", [...kubeArgs, "create", "namespace", config.controllerNamespace]);
		namespaceCreated = true;
		run("kubectl", [
			...kubeArgs,
			"apply",
			"--server-side",
			"-f",
			`https://github.com/kubernetes-sigs/gateway-api/releases/download/${config.gatewayApiVersion}/standard-install.yaml`,
		]);
		run("kubectl", [
			...kubeArgs,
			"wait",
			"--for=condition=Established",
			"crd/gateways.gateway.networking.k8s.io",
			"crd/httproutes.gateway.networking.k8s.io",
			"--timeout=90s",
		]);
		const controllerCrds = run("helm", ["show", "crds", config.chart, "--version", config.chartVersion], {
			capture: true,
		});
		if (!controllerCrds.includes("kind: CustomResourceDefinition"))
			throw new Error("The pinned Traefik chart did not return its CRDs.");
		run("kubectl", [...kubeArgs, "apply", "--server-side", "-f", "-"], { input: controllerCrds });
		run("kubectl", [...kubeArgs, "wait", "--for=condition=Established", "crd/middlewares.traefik.io", "--timeout=90s"]);
		installAttempted = true;
		run("helm", [
			"install",
			config.release,
			config.chart,
			...helmArgs,
			"--version",
			config.chartVersion,
			"--skip-crds",
			"--values",
			config.values,
			"--wait",
			"--timeout",
			"5m",
			"--hide-notes",
		]);
		run("kubectl", [...kubeArgs, "wait", "--for=condition=Accepted", "gatewayclass/traefik", "--timeout=90s"]);
		run(process.execPath, ["scripts/check-k8s-runtime.mjs", context], {
			env: {
				...process.env,
				K8S_TEST_GATEWAY_NAMESPACE: config.controllerNamespace,
				K8S_TEST_GATEWAY_SERVICE: config.release,
				K8S_TEST_NAMESPACE: config.appNamespace,
			},
		});
	} catch (error) {
		failed = true;
		failure = error;
		if (namespaceCreated) {
			run("kubectl", [...kubeArgs, "--namespace", config.controllerNamespace, "get", "pods,services,events"], {
				optional: true,
			});
			run(
				"kubectl",
				[...kubeArgs, "--namespace", config.controllerNamespace, "logs", `deployment/${config.release}`, "--tail=100"],
				{ optional: true },
			);
		}
	} finally {
		const cleanup = (command, args) => {
			try {
				run(command, args);
			} catch (error) {
				cleanupErrors.push(error);
			}
		};
		if (installAttempted)
			cleanup("helm", ["uninstall", config.release, ...helmArgs, "--ignore-not-found", "--wait", "--timeout", "2m"]);
		if (namespaceCreated)
			cleanup("kubectl", [...kubeArgs, "delete", "namespace", config.controllerNamespace, "--wait=false"]);
		if (cleanupErrors.length > 0 && failed) {
			console.error("Gateway test controller cleanup also failed; remove the disposable kind cluster.");
		}
	}
	if (failed) throw failure;
	if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, "Gateway test controller cleanup failed");
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	runGatewayRuntime({ context: process.argv[2] });
}
