const minimum = Number(process.env.K8S_MIN_MINOR ?? 35);
const maximum = Number(process.env.K8S_MAX_MINOR ?? 37);

const minorVersion = (version, label) => {
	if (version?.major !== "1" || !/^\d+\+?$/.test(version?.minor ?? "")) {
		throw new Error(`Unable to determine ${label} Kubernetes 1.x version.`);
	}
	return Number.parseInt(version.minor, 10);
};

if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
	throw new Error("K8S_MIN_MINOR and K8S_MAX_MINOR must be an ordered pair of integer minor versions.");
}

const { clientVersion, serverVersion } = JSON.parse(await Bun.stdin.text());
const serverMinor = minorVersion(serverVersion, "server");
const clientMinor = minorVersion(clientVersion, "kubectl client");

if (serverMinor < minimum || serverMinor > maximum) {
	throw new Error(`Kubernetes 1.${minimum}-1.${maximum} is required; current server is ${serverVersion.gitVersion}.`);
}

if (Math.abs(clientMinor - serverMinor) > 1) {
	throw new Error(
		`kubectl ${clientVersion.gitVersion} is incompatible with server ${serverVersion.gitVersion}. Upgrade kubectl to within one minor version of the server.`,
	);
}

console.log(
	`Kubernetes versions are compatible (kubectl ${clientVersion.gitVersion}, server ${serverVersion.gitVersion}).`,
);
