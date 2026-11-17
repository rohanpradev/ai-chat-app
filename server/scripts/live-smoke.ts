/** Opt-in integration checks: real auth, PostgreSQL, Redis, and billed Gateway calls. */
/** biome-ignore-all lint/suspicious/noConsole: Report synthetic smoke results to the CLI. */
import assert from "node:assert/strict";
import {
	AIEvaluationResponseSchema,
	AIPlanResponseSchema,
	type MyUIMessage,
	safeValidateMyUIMessages
} from "@chat-app/shared";
import { DefaultChatTransport, readUIMessageStream } from "ai";
import { selectablePdf } from "../src/test/pdf-fixture";

if (Bun.env.LIVE_TEST_ALLOW_BILLING !== "1" || !Bun.env.LIVE_TEST_DB_URL || !Bun.env.LIVE_TEST_REDIS_URL) {
	throw new Error(
		"Set LIVE_TEST_ALLOW_BILLING=1, LIVE_TEST_DB_URL, and LIVE_TEST_REDIS_URL to use disposable services."
	);
}
if (!Bun.env.AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is required.");

const origin = "http://127.0.0.1:5300";
Object.assign(Bun.env, {
	AI_TOOL_APPROVAL_SECRET: Bun.randomUUIDv7() + Bun.randomUUIDv7(),
	BETTER_AUTH_SECRET: Bun.randomUUIDv7() + Bun.randomUUIDv7(),
	BETTER_AUTH_URL: origin,
	CLIENT_URL: origin,
	CORS_ORIGINS: origin,
	DB_URL: Bun.env.LIVE_TEST_DB_URL,
	LANGFUSE_PUBLIC_KEY: "",
	LANGFUSE_SECRET_KEY: "",
	LOG_LEVEL: "silent",
	MCP_SERVERS: "[]",
	NODE_ENV: "production",
	REDIS_URL: Bun.env.LIVE_TEST_REDIS_URL,
	SENTRY_DSN: ""
});

const { default: app } = await import("../src/app");
const { closeDatabase, db } = await import("../src/db");
const { users } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");
const { redis } = await import("bun");
const model = Bun.env.LIVE_TEST_MODEL ?? "openai/gpt-5-mini";
const runId = Bun.randomUUIDv7();
const userIds: string[] = [];
const results: Array<{ check: string; status: "pass" | "fail" | "skip"; durationMs: number; detail?: string }> = [];

function session() {
	const cookies = new Map<string, string>();
	const send = async (path: string, init: RequestInit = {}) => {
		const headers = new Headers(init.headers);
		headers.set("Origin", origin);
		headers.set("Cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
		const response = await app.fetch(new Request(new URL(path, origin), { ...init, headers }));
		for (const cookie of response.headers.getSetCookie()) {
			const pair = cookie.split(";", 1)[0] ?? "";
			const index = pair.indexOf("=");
			if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
		}
		return response;
	};
	const json = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
		const response = await send(path, {
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			headers: { "Content-Type": "application/json" },
			method,
			signal: AbortSignal.timeout(150_000)
		});
		assert(response.ok, `${method} ${path}: HTTP ${response.status}`);
		return response.json();
	};
	return { json, send };
}

const primary = session();
const secondary = session();
const userMessage = (text: string): MyUIMessage => ({
	id: `user-${Bun.randomUUIDv7()}`,
	parts: [{ text, type: "text" }],
	role: "user"
});
const textOf = (message: MyUIMessage) =>
	message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");

async function check(name: string, run: () => Promise<void>) {
	const started = performance.now();
	try {
		await run();
		results.push({ check: name, durationMs: Math.round(performance.now() - started), status: "pass" });
	} catch (error) {
		// Only our assertions describe failures; never print provider payloads, headers, or credentials.
		results.push({
			check: name,
			detail:
				error instanceof assert.AssertionError
					? error.message.split("\n")[0]
					: `Request failed (${error instanceof Error ? error.name : "unknown error"}); inspect locally with private diagnostics.`,
			durationMs: Math.round(performance.now() - started),
			status: "fail"
		});
	}
	console.log(JSON.stringify(results.at(-1)));
}

async function stream(
	messages: MyUIMessage[],
	options: {
		chatId?: string;
		tools?: string[];
		trigger?: "submit-message" | "regenerate-message";
		signal?: AbortSignal;
		onUpdate?: (message: MyUIMessage) => void;
	} = {}
) {
	const transport = new DefaultChatTransport<MyUIMessage>({
		api: `${origin}/api/ai/text-stream`,
		body: { agentMode: "assistant", model, tools: options.tools ?? [] },
		fetch: Object.assign(
			(_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => primary.send("/api/ai/text-stream", init),
			{ preconnect: fetch.preconnect }
		)
	});
	const chunks = await transport
		.sendMessages({
			abortSignal: options.signal ?? AbortSignal.timeout(150_000),
			chatId: options.chatId ?? `live-${Bun.randomUUIDv7()}`,
			messageId: undefined,
			messages,
			trigger: options.trigger ?? "submit-message"
		})
		.catch((error: unknown) => assert.fail(`Chat transport failed (${error instanceof Error ? error.name : "unknown"})`));
	let final: MyUIMessage | undefined;
	let updates = 0;
	for await (const message of readUIMessageStream<MyUIMessage>({
		message: messages.at(-1)?.role === "assistant" ? messages.at(-1) : undefined,
		onError: (error) => {
			assert.fail(`Chat stream failed (${error instanceof Error ? error.name : "unknown"})`);
		},
		stream: chunks,
		terminateOnError: true
	})) {
		final = message;
		updates++;
		options.onUpdate?.(message);
	}
	assert(final, "Stream must produce an assistant message");
	assert(updates > 1, "Stream must emit incremental updates");
	assert((await safeValidateMyUIMessages([final])).success, "Stream must obey the shared UI-message contract");
	return final;
}

async function saved(chatId: string, predicate: (messages: MyUIMessage[]) => boolean) {
	for (let attempt = 0; attempt < 40; attempt++) {
		const payload = await primary.json(`/api/conversations/${chatId}`);
		if (predicate(payload.data.messages)) return payload.data;
		await Bun.sleep(50);
	}
	assert.fail("Completed stream must persist before reload");
}

let conversationId = "";
let firstUser: MyUIMessage;
let firstAnswer: MyUIMessage;
let documentId = "";

try {
	await check("auth registration, persisted sessions, and isolation", async () => {
		assert.equal((await primary.send("/api/conversations")).status, 401);
		for (const [index, account] of [primary, secondary].entries()) {
			const payload = await account.json("/api/auth/sign-up/email", {
				email: `audit-${runId}-${index}@example.com`,
				name: "Synthetic Live Audit",
				password: `Audit-${runId}-password`
			});
			assert(payload.user?.id, "Registration must create a user");
			userIds.push(payload.user.id);
			assert.equal((await account.json("/api/auth/get-session")).user.id, payload.user.id);
		}
	});
	assert.equal(userIds.length, 2, "Auth is required for remaining checks");

	await check("live Gateway model discovery", async () => {
		const payload = await primary.json("/api/ai/models");
		assert(
			payload.data.some((entry: { id: string; source: string }) => entry.id === model && entry.source === "api"),
			"Selected model must exist in the live Gateway catalog"
		);
	});
	await check("conversation CRUD and cross-user authorization", async () => {
		conversationId = (await primary.json("/api/conversations", { title: "Synthetic audit" })).data.id;
		assert.equal((await secondary.send(`/api/conversations/${conversationId}`)).status, 404);
		await primary.json(`/api/conversations/${conversationId}`, { title: "Renamed synthetic audit" }, "PUT");
		assert.equal((await primary.json(`/api/conversations/${conversationId}`)).data.title, "Renamed synthetic audit");
	});
	await check("actual model streaming and persistence", async () => {
		firstUser = userMessage("Remember the synthetic code word COBALT. Reply with exactly COBALT.");
		firstAnswer = await stream([firstUser], { chatId: conversationId });
		assert.match(textOf(firstAnswer), /COBALT/);
		assert.equal(firstAnswer.metadata?.model, model);
		await saved(conversationId, (messages) => {
			const answer = messages[1];
			return messages.length === 2 && answer !== undefined && textOf(answer).includes("COBALT");
		});
	});
	await check("saved history replay and follow-up", async () => {
		const history = (await primary.json(`/api/conversations/${conversationId}`)).data.messages;
		const answer = await stream(
			[...history, userMessage("What was the synthetic code word? Reply with that word only.")],
			{ chatId: conversationId }
		);
		assert.match(textOf(answer), /COBALT/);
		await saved(conversationId, (messages) => messages.length === 4);
	});
	await check("regeneration replaces the response and persists", async () => {
		const history = (await primary.json(`/api/conversations/${conversationId}`)).data.messages;
		const answer = await stream(history.slice(0, -1), { chatId: conversationId, trigger: "regenerate-message" });
		assert.match(textOf(answer), /COBALT/);
		await saved(conversationId, (messages) => messages.length === 4 && messages.at(-1)?.id === answer.id);
	});
	await check("live stream cancellation preserves the accepted prompt", async () => {
		const chatId = (await primary.json("/api/conversations", { title: "Cancelled synthetic audit" })).data.id;
		const controller = new AbortController();
		await stream([userMessage("Write the numbers from 1 to 2000, one number per line.")], {
			chatId,
			onUpdate: (message) => {
				if (textOf(message)) controller.abort();
			},
			signal: controller.signal
		}).catch((error: unknown) => {
			if (!controller.signal.aborted) throw error;
		});
		assert(controller.signal.aborted, "Cancellation must happen during actual generated text");
		await saved(chatId, (messages) => messages[0]?.role === "user");
	});
	await check("schema-validated structured planning", async () => {
		const result = AIPlanResponseSchema.parse(
			await primary.json("/api/ai/plan", { model, prompt: "Plan a tiny accessible todo list. Keep every field concise." })
		);
		assert(result.data.steps.length > 0);
		assert(result.metadata.usage.totalTokens > 0);
	});
	await check("schema-validated LLM judge", async () => {
		const result = AIEvaluationResponseSchema.parse(
			await primary.json("/api/ai/evaluate", { input: "What is 2+2?", model, output: "4", reference: "4" })
		);
		assert(result.data.score >= 0.8, "Correct arithmetic should receive a high score");
	});
	await check("Jev live typed evaluation", async () => {
		const result = await primary.json("/api/jev/evaluate", {
			questions: [{ id: "containsGreeting", instructions: "Does the text contain a greeting?", type: "boolean" }],
			state: "Hello, welcome to the synthetic audit.",
			stateFormat: "text"
		});
		assert(result.answers.containsGreeting.probability > 0.5);
	});
	await check("Jev JSON-array compatibility", async () => {
		const result = await primary.json("/api/jev/evaluate", {
			questions: [{ id: "hasOrchid", instructions: "Does any JSON item have project ORCHID?", type: "boolean" }],
			state: JSON.stringify([{ project: "ORCHID" }]),
			stateFormat: "json"
		});
		assert(result.answers.hasOrchid.probability > 0.5);
	});
	await check("text ingestion with real embeddings", async () => {
		const result = await primary.json("/api/embeddings/ingest", {
			content:
				"The synthetic project ORCHID has release code COBALT and launches on the planet Mars. Its maintenance window is Tuesday at 03:00 UTC.",
			title: "Synthetic ORCHID handbook"
		});
		documentId = result.data.document.id;
		assert.equal(result.data.dimensions, 1536);
		assert(result.data.chunks.length > 0);
	});
	await check("file upload and vectorization", async () => {
		const form = new FormData();
		form.set(
			"file",
			new File(["Synthetic second document. ORCHID uses the COBALT release code."], "audit.md", { type: "text/markdown" })
		);
		const response = await primary.send("/api/embeddings/upload", { body: form, method: "POST" });
		assert.equal(response.status, 201);
	});
	await check("PDF upload, extraction, and real vectorization", async () => {
		const form = new FormData();
		form.set("file", selectablePdf());
		const response = await primary.send("/api/embeddings/upload", { body: form, method: "POST" });
		assert.equal(response.status, 201);
		assert.match((await response.json()).data.chunks[0].content, /Upload extraction works/);
	});
	await check("model reads a PDF chat attachment", async () => {
		const attachment = selectablePdf();
		const prompt = userMessage("What exact sentence is printed in this PDF? Reply only with that sentence.");
		prompt.parts.push({
			filename: attachment.name,
			mediaType: "application/pdf",
			type: "file",
			url: `data:application/pdf;base64,${Buffer.from(await attachment.arrayBuffer()).toString("base64")}`
		});
		assert.match(textOf(await stream([prompt])), /Upload extraction works/i);
	});
	await check("database vector search and tenant isolation", async () => {
		const result = await primary.json("/api/embeddings/search", {
			documentId,
			includeContent: true,
			minScore: 0,
			query: "What is ORCHID's release code?"
		});
		assert(result.data.results.some((entry: { content?: string }) => entry.content?.includes("COBALT")));
		const other = await secondary.json("/api/embeddings/search", {
			documentId,
			minScore: 0,
			query: "ORCHID release code"
		});
		assert.equal(other.data.results.length, 0);
	});
	await check("grounded RAG answer with citations", async () => {
		const result = await primary.json("/api/embeddings/rag", {
			documentId,
			minScore: 0,
			model,
			query: "What is ORCHID's release code?"
		});
		assert.match(result.data.answer, /COBALT/);
		assert.match(result.data.answer, /\[1\]/);
		assert(result.data.sources.length > 0);
	});
	for (const approved of [false, true]) {
		if (!Bun.env.SERPER_API_KEY) {
			results.push({ check: "live search approvals", detail: "SERPER_API_KEY missing", durationMs: 0, status: "skip" });
			break;
		}
		await check(`signed search approval ${approved ? "accepted" : "denied"}`, async () => {
			const chatId = `live-search-${Bun.randomUUIDv7()}`;
			const question = userMessage(
				"Call the serper web search tool now with query 'Vercel AI Gateway documentation'. Do not answer from memory."
			);
			const proposal = await stream([question], { chatId, tools: ["serper"] });
			const pending = proposal.parts.find((part) => part.type === "tool-serper" && part.state === "approval-requested");
			assert(
				pending?.type === "tool-serper" && pending.state === "approval-requested",
				"Model must request approval before network search"
			);
			assert(pending.approval.signature, "Tool approval must be signed");
			const continued: MyUIMessage = {
				...proposal,
				parts: proposal.parts.map((part) =>
					part === pending ? { ...pending, approval: { ...pending.approval, approved }, state: "approval-responded" } : part
				)
			};
			const answer = await stream([question, continued], { chatId, tools: ["serper"] });
			assert(
				answer.parts.some(
					(part) => part.type === "tool-serper" && part.state === (approved ? "output-available" : "output-denied")
				),
				"Tool must respect the approval decision"
			);
		});
	}
	await check("MCP authorization with no configured connections", async () => {
		assert.deepEqual((await primary.json("/api/mcp/servers")).servers, []);
		assert.equal(
			(
				await primary.send("/api/mcp/inspect", {
					body: JSON.stringify({ serverId: "unavailable" }),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				})
			).status,
			404
		);
	});
	results.push({
		check: "external MCP server execution",
		detail: "No connection configured for disposable users",
		durationMs: 0,
		status: "skip"
	});
	await check("profile read, update and cache invalidation", async () => {
		await primary.json("/api/profile");
		const form = new FormData();
		form.set("name", "Updated Synthetic Audit");
		assert.equal((await primary.send("/api/profile", { body: form, method: "PATCH" })).status, 200);
		assert.equal((await primary.json("/api/profile")).data.name, "Updated Synthetic Audit");
	});
	await check("usage settlement reports billed tokens", async () => {
		const usage = (await primary.json("/api/ai/usage")).data;
		assert(usage.ai.requests.used > 0 && usage.ai.tokens.used > 0);
		assert(usage.embedding.tokens.used > 0 && usage.embedding.storageBytes.used > 0);
	});
	await check("deletion and logout revoke access", async () => {
		await primary.json(`/api/embeddings/documents/${documentId}`, undefined, "DELETE");
		await primary.json(`/api/conversations/${conversationId}`, undefined, "DELETE");
		assert.equal((await primary.send(`/api/conversations/${conversationId}`)).status, 404);
		await primary.json("/api/auth/sign-out", {});
		assert.equal((await primary.send("/api/conversations")).status, 401);
	});
} finally {
	for (const userId of userIds) await db.delete(users).where(eq(users.id, userId));
	redis.close();
	await closeDatabase();
	console.log(JSON.stringify({ model, results, runId }, null, 2));
}

if (results.some((result) => result.status === "fail")) process.exitCode = 1;
