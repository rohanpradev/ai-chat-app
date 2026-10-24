import { expect, test } from "bun:test";
import { gatewayRuntimeConfiguration, runGatewayRuntime } from "./check-k8s-gateway.mjs";

const context = "kind-chat-app-runtime";
const fixtureRunner = ({
	failRuntime = false,
	existingApp = false,
	failNamespace = false,
	existingCrds = false,
} = {}) => {
	const calls = [];
	const run = (command, args, options = {}) => {
		calls.push({ args, command, options });
		if (command === "kind") return "chat-app-runtime\n";
		if (command === "kubectl" && args.includes("version")) return "{}";
		if (command === "kubectl" && args.includes("get") && args.includes("crd"))
			return JSON.stringify({ items: existingCrds ? [{ spec: { group: "gateway.networking.k8s.io" } }] : [] });
		if (command === "kubectl" && args.includes("get") && args.includes("namespace"))
			return existingApp ? "namespace/chat-app-gateway-runtime" : "";
		if (command === "kubectl" && args.includes("create") && failNamespace) throw new Error("Namespace exists");
		if (command === "helm" && args[0] === "show") return "---\nkind: CustomResourceDefinition\n";
		if (command === process.execPath && args.includes("scripts/check-k8s-runtime.mjs") && failRuntime)
			throw new Error("Gateway runtime failed");
		return "";
	};
	return { calls, run };
};

test("refuses a non-kind context before contacting or mutating any cluster", () => {
	const { calls, run } = fixtureRunner();
	expect(() => runGatewayRuntime({ context: "production", run })).toThrow("kind");
	expect(calls).toHaveLength(0);
});

test("refuses an existing app namespace before installing the test controller", () => {
	const { calls, run } = fixtureRunner({ existingApp: true });
	expect(() => runGatewayRuntime({ context, run })).toThrow("already exists");
	expect(
		calls.some((call) => call.args.includes("create") || call.args.includes("install") || call.args.includes("apply")),
	).toBe(false);
});

test("refuses existing Gateway resources before mutating cluster-wide CRDs", () => {
	const { calls, run } = fixtureRunner({ existingCrds: true });
	expect(() => runGatewayRuntime({ context, run })).toThrow("fresh disposable cluster");
	expect(
		calls.some((call) => call.args.includes("create") || call.args.includes("install") || call.args.includes("apply")),
	).toBe(false);
});

test("never removes a controller namespace that it failed to create", () => {
	const { calls, run } = fixtureRunner({ failNamespace: true });
	expect(() => runGatewayRuntime({ context, run })).toThrow("Namespace exists");
	expect(calls.some((call) => call.args.includes("delete") || call.args.includes("uninstall"))).toBe(false);
});

test("runs Gateway traffic against the isolated fixture and cleans up even on runtime failure", () => {
	const { calls, run } = fixtureRunner({ failRuntime: true });
	expect(() => runGatewayRuntime({ context, run })).toThrow("Gateway runtime failed");
	const runtime = calls.find(
		(call) => call.command === process.execPath && call.args.includes("scripts/check-k8s-runtime.mjs"),
	);
	expect(runtime?.options.env.K8S_TEST_NAMESPACE).toBe(gatewayRuntimeConfiguration.appNamespace);
	expect(runtime?.options.env.K8S_TEST_GATEWAY_SERVICE).toBe(gatewayRuntimeConfiguration.release);
	expect(runtime?.options.env.K8S_TEST_GATEWAY_NAMESPACE).toBe(gatewayRuntimeConfiguration.controllerNamespace);
	const install = calls.find((call) => call.command === "helm" && call.args[0] === "install");
	expect(install?.args).toContain(gatewayRuntimeConfiguration.chartVersion);
	for (const call of calls.filter((call) => call.command === "kubectl")) {
		expect(call.args.slice(0, 2)).toEqual(["--context", context]);
	}
	for (const call of calls.filter(
		(call) => call.command === "helm" && ["install", "uninstall"].includes(call.args[0]),
	)) {
		expect(call.args).toContain("--kube-context");
		expect(call.args).toContain(context);
	}
	expect(calls.some((call) => call.command === "helm" && call.args[0] === "uninstall")).toBe(true);
	expect(calls.at(-1)?.args).toEqual([
		"--context",
		context,
		"delete",
		"namespace",
		gatewayRuntimeConfiguration.controllerNamespace,
		"--wait=false",
	]);
});
