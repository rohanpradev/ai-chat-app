import {
	AIEvaluationRequestSchema,
	AIEvaluationResponseSchema,
	AIPlanRequestSchema,
	AIPlanResponseSchema,
	AIStreamResponseHeaders,
	AvailableModelsResponseSchema,
	ChatRequestSchema,
	CommonBadRequestResponseSchema,
	CommonErrorResponseSchema,
	CommonUnauthorizedResponseSchema
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import { notFoundSchema } from "@/lib/constants";
import { asRouteMiddleware } from "@/lib/hono-compat";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { jsonContent } from "@/lib/openapi";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { aiRateLimit } from "@/middlewares/rate-limit";

const tags = ["AI"];
const authenticated = asRouteMiddleware(authMiddleware);
const aiLimiter = asRouteMiddleware(aiRateLimit);

export const aiStream = createRoute({
	description: "AI UI message stream API",
	method: "post",
	middleware: [authenticated, aiLimiter],
	path: "/ai/text-stream",
	request: {
		body: {
			content: {
				"application/json": {
					schema: ChatRequestSchema
				}
			},
			description: "Schema for AI chat requests with model selection and approved tool access"
		}
	},
	responses: {
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(CommonBadRequestResponseSchema, "Invalid request payload"),
		[HttpStatusCodes.NO_CONTENT]: { description: "No information provided" },
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "AI not found"),
		[HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(CommonErrorResponseSchema, "Too many AI requests"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized"),
		[HttpStatusCodes.OK]: {
			content: {
				"text/event-stream": {
					schema: {
						description: "Server-Sent Events stream using Vercel AI SDK UI message stream protocol",
						example: String.raw`data: {"type":"start","messageId":"msg_123"}\n\ndata: {"type":"text-start","id":"text-1"}\n\ndata: {"type":"text-delta","id":"text-1","delta":"Hello"}\n\ndata: {"type":"text-end","id":"text-1"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n`,
						type: "string"
					}
				}
			},
			description: "A stream of UI message events",
			headers: AIStreamResponseHeaders
		}
	},
	security: [{ CookieAuth: [] }],
	summary: "Streams AI responses as UI message events.",
	tags
});

export type AIStreamRoute = typeof aiStream;

export const getAvailableModels = createRoute({
	description: "Get currently available OpenAI chat-capable models for this deployment",
	method: "get",
	middleware: [authenticated, aiLimiter],
	path: "/ai/models",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(AvailableModelsResponseSchema, "Available AI models"),
		[HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(CommonErrorResponseSchema, "Too many AI requests"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Lists provider-backed AI models for the model selector.",
	tags
});

export type GetAvailableModelsRoute = typeof getAvailableModels;

export const generatePlan = createRoute({
	description:
		"Generates a schema-validated AI task plan for routing, tool selection, risk analysis, and evaluation checks.",
	method: "post",
	middleware: [authenticated, aiLimiter],
	path: "/ai/plan",
	request: {
		body: {
			content: {
				"application/json": {
					schema: AIPlanRequestSchema
				}
			},
			description: "Prompt and optional context to convert into a structured execution plan"
		}
	},
	responses: {
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(CommonBadRequestResponseSchema, "Invalid request payload"),
		[HttpStatusCodes.OK]: jsonContent(AIPlanResponseSchema, "Structured AI plan"),
		[HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(CommonErrorResponseSchema, "Too many AI requests"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Generates a structured AI work plan.",
	tags
});

export type GeneratePlanRoute = typeof generatePlan;

export const evaluateOutput = createRoute({
	description:
		"Runs a schema-validated LLM-as-judge evaluation against an assistant output, optional context, reference, and rubric.",
	method: "post",
	middleware: [authenticated, aiLimiter],
	path: "/ai/evaluate",
	request: {
		body: {
			content: {
				"application/json": {
					schema: AIEvaluationRequestSchema
				}
			},
			description: "Input/output pair plus optional evidence and rubric"
		}
	},
	responses: {
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(CommonBadRequestResponseSchema, "Invalid request payload"),
		[HttpStatusCodes.OK]: jsonContent(AIEvaluationResponseSchema, "Structured AI evaluation"),
		[HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(CommonErrorResponseSchema, "Too many AI requests"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Evaluates an AI output with an LLM-as-judge rubric.",
	tags
});

export type EvaluateOutputRoute = typeof evaluateOutput;
