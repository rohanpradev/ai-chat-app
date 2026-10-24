import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const rootDir = new URL("..", import.meta.url);
const render = (overrides = {}) => {
	const result = spawnSync(
		"helm",
		["template", "chat-app", "helm/chat-app", "--namespace", "runtime-config", "-f", "-"],
		{
			cwd: rootDir,
			encoding: "utf8",
			input: JSON.stringify(overrides),
			timeout: 30_000,
		},
	);
	if (result.error) throw result.error;
	assert.equal(result.status, 0, `Helm render failed: ${result.stderr}`);
	return result.stdout;
};

const document = (manifest, kind, name) => {
	const found = manifest
		.split(/^---\s*$/m)
		.find((part) => part.includes(`kind: ${kind}\n`) && part.includes(`\n  name: ${name}\n`));
	assert.ok(found, `${kind}/${name} must render`);
	return found;
};

const value = (manifest, kind, name, key) => {
	const match = document(manifest, kind, name).match(new RegExp(`^  ${key}: (".*")$`, "m"));
	assert.ok(match, `${kind}/${name} must contain quoted ${key}`);
	return JSON.parse(match[1]);
};

const failures = [];
const check = (name, run) => {
	try {
		run();
		console.log(`${name}: passed`);
	} catch (error) {
		failures.push(new Error(name, { cause: error }));
	}
};

check("Credential URL components round-trip without changing passwords", () => {
	const username = "user @:/?#&+%";
	const password = "pāss @:/?#&+% word";
	const database = "database /?#&+%";
	const manifest = render({
		config: { env: { DB_NAME: database, DB_USER: username } },
		secrets: { app: { data: { DB_PASSWORD: password, REDIS_AUTH: password }, existingSecret: "" }, create: true },
	});
	const dbUrl = new URL(value(manifest, "Secret", "chat-app-app-secrets", "DB_URL"));
	assert.equal(decodeURIComponent(dbUrl.username), username);
	assert.equal(decodeURIComponent(dbUrl.password), password);
	assert.equal(decodeURIComponent(dbUrl.pathname.slice(1)), database);
	const redisUrl = new URL(value(manifest, "Secret", "chat-app-app-secrets", "REDIS_URL"));
	assert.equal(decodeURIComponent(redisUrl.password), password);
	const explicit = "postgres://reader:already%23encoded@db.example:6432/external?sslmode=require";
	assert.equal(
		value(
			render({ secrets: { app: { data: { DB_URL: explicit }, existingSecret: "" }, create: true } }),
			"Secret",
			"chat-app-app-secrets",
			"DB_URL",
		),
		explicit,
	);
});

check("Custom service ports preserve actual listeners and proxy targets", () => {
	const manifest = render({
		client: { service: { port: 8081 } },
		config: { env: { SERVER_PORT: "9000" } },
		db: { service: { port: 5433 } },
		redis: { service: { port: 6380 } },
		secrets: { app: { existingSecret: "" }, create: true },
		server: { service: { port: 8082 } },
	});
	for (const [component, kind, listener, servicePort, name] of [
		["client", "Deployment", 8080, 8081, "http"],
		["server", "Deployment", 9000, 8082, "http"],
		["db", "StatefulSet", 5432, 5433, "postgres"],
		["redis", "StatefulSet", 6379, 6380, "redis"],
	]) {
		const resourceName = `chat-app-${component}`;
		assert.match(document(manifest, kind, resourceName), new RegExp(`name: ${name}\\n\\s+containerPort: ${listener}\\n`));
		const service = document(manifest, "Service", resourceName);
		assert.match(service, new RegExp(`port: ${servicePort}\\n\\s+targetPort: ${name}\\n`));
		const policy = document(manifest, "NetworkPolicy", resourceName);
		assert.match(policy, new RegExp(`port: ${listener}\\n`));
		assert.doesNotMatch(policy, new RegExp(`port: ${servicePort}\\n`));
	}
	const nginx = document(manifest, "ConfigMap", "chat-app-client-nginx");
	assert.equal(
		(nginx.match(/proxy_pass http:\/\/chat-app-server\.runtime-config\.svc\.cluster\.local:8082;/g) ?? []).length,
		2,
	);
	assert.equal(value(manifest, "ConfigMap", "chat-app-env", "SERVER_PORT"), "9000");
	assert.equal(value(manifest, "ConfigMap", "chat-app-env", "DB_PORT"), "5433");
	assert.equal(value(manifest, "ConfigMap", "chat-app-env", "REDIS_PORT"), "6380");
	assert.equal(new URL(value(manifest, "Secret", "chat-app-app-secrets", "DB_URL")).port, "5433");
	assert.equal(new URL(value(manifest, "Secret", "chat-app-app-secrets", "REDIS_URL")).port, "6380");
});

check("External database and Redis ports remain independent of bundled services", () => {
	const manifest = render({
		db: { enabled: false },
		externalDatabase: { host: "db.external.test", port: "6432" },
		externalRedis: { host: "redis.external.test", port: "6381" },
		redis: { enabled: false },
		secrets: { app: { existingSecret: "" }, create: true },
	});
	assert.equal(value(manifest, "ConfigMap", "chat-app-env", "DB_PORT"), "6432");
	assert.equal(value(manifest, "ConfigMap", "chat-app-env", "REDIS_PORT"), "6381");
	assert.equal(new URL(value(manifest, "Secret", "chat-app-app-secrets", "DB_URL")).port, "6432");
	assert.equal(new URL(value(manifest, "Secret", "chat-app-app-secrets", "REDIS_URL")).port, "6381");
});

check("Redis declares non-root ownership for its mounted data volume", () => {
	const redis = document(render(), "StatefulSet", "chat-app-redis");
	for (const field of [
		"runAsNonRoot: true",
		"runAsUser: 65532",
		"runAsGroup: 65532",
		"fsGroup: 65532",
		"fsGroupChangePolicy: OnRootMismatch",
		"readOnlyRootFilesystem: true",
	]) {
		assert.ok(redis.includes(field), `Redis must declare ${field}`);
	}
	assert.match(redis, /drop:\n\s+- ALL/);
	assert.match(redis, /mountPath: \/data/);
	assert.doesNotMatch(redis, /add:\n/);
});

if (failures.length > 0) throw new AggregateError(failures, "Helm runtime configuration checks failed");
console.log("Helm runtime configuration checks passed.");
