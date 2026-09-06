import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const image = process.argv[2] ?? "chat-app-client:latest";
const containerArgs = [
	"run",
	"--rm",
	"--network=none",
	"--read-only",
	"--cap-drop=ALL",
	"--security-opt=no-new-privileges:true",
	"--tmpfs=/tmp:size=64m,mode=1777",
	"--tmpfs=/run:size=16m,mode=0777",
	"--tmpfs=/var/cache/nginx:size=64m,mode=0777",
];

const inspectConfiguration = (name, args) => {
	const result = spawnSync("docker", [...containerArgs, ...args], {
		encoding: "utf8",
		timeout: 30_000,
	});
	if (result.error) throw result.error;
	assert.equal(result.status, 0, `${name} failed:\n${result.stdout}\n${result.stderr}`);
	assert.match(result.stderr, /syntax is ok/);
	assert.match(result.stderr, /test is successful/);
	console.log(`${name}: passed`);
	return result.stdout;
};

// Exercise the image's default, direct Nginx entrypoint without a shell.
const direct = inspectConfiguration("Direct Nginx startup", ["--add-host=server:127.0.0.1", image, "-T"]);
assert.ok(direct.includes("proxy_pass http://server:3000;"));

// Match Compose's writable configuration mount and runtime substitution filter.
const rendered = inspectConfiguration("Compose Nginx template startup", [
	"--tmpfs=/etc/nginx/conf.d:size=1m,mode=0777",
	"--env=BASE_API_SLUG=runtime-api",
	"--env=SERVER_HOST=127.0.0.1",
	"--env=SERVER_PORT=4321",
	"--env=NGINX_ENVSUBST_FILTER=^(BASE_API_SLUG|SERVER_HOST|SERVER_PORT)$",
	"--entrypoint=/docker-entrypoint.sh",
	image,
	"nginx",
	"-T",
]);

for (const directive of [
	"location /runtime-api/",
	"location ~ ^/runtime-api/ai/.*-stream$",
	"proxy_pass http://127.0.0.1:4321;",
	"proxy_set_header Host $host;",
	"proxy_set_header Cookie $http_cookie;",
	"try_files $uri $uri/ /index.html;",
	"proxy_buffering off;",
]) {
	assert.ok(rendered.includes(directive), `Runtime configuration is missing: ${directive}`);
}
// biome-ignore lint/suspicious/noTemplateCurlyInString: Check the literal Nginx template token.
assert.ok(!rendered.includes("${BASE_API_SLUG}"), "API prefix was not substituted");
console.log("Client container configuration checks passed.");
