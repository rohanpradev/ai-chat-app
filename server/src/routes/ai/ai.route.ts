import {
  AIStreamResponseHeaders,
  AvailableModelsResponseSchema,
  ChatRequestSchema,
  CommonBadRequestResponseSchema,
  CommonUnauthorizedResponseSchema,
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import { notFoundSchema } from "@/lib/constants";
import { asRouteMiddleware } from "@/lib/hono-compat";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { jsonContent } from "@/lib/openapi";
import { authMiddleware } from "@/middlewares/auth-middleware";

const tags = ["AI"];
const authenticated = asRouteMiddleware(authMiddleware);

export const aiStream = createRoute({
  description: "AI UI message stream API",
  method: "post",
  middleware: [authenticated],
  path: "/ai/text-stream",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatRequestSchema,
        },
      },
      description:
        "Schema for AI chat requests with model selection and approved tool access",
    },
  },
  responses: {
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      CommonBadRequestResponseSchema,
      "Invalid request payload",
    ),
    [HttpStatusCodes.NO_CONTENT]: { description: "No information provided" },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "AI not found"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      CommonUnauthorizedResponseSchema,
      "Unauthorized",
    ),
    [HttpStatusCodes.OK]: {
      content: {
        "text/event-stream": {
          schema: {
            description:
              "Server-Sent Events stream using Vercel AI SDK UI message stream protocol",
            example: String.raw`data: {"type":"start","messageId":"msg_123"}\n\ndata: {"type":"text-start","id":"text-1"}\n\ndata: {"type":"text-delta","id":"text-1","delta":"Hello"}\n\ndata: {"type":"text-end","id":"text-1"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n`,
            type: "string",
          },
        },
      },
      description: "A stream of UI message events",
      headers: AIStreamResponseHeaders,
    },
  },
  security: [{ CookieAuth: [] }],
  summary: "Streams AI responses as UI message events.",
  tags,
});

export type AIStreamRoute = typeof aiStream;

export const getAvailableModels = createRoute({
  description:
    "Get currently available OpenAI chat-capable models for this deployment",
  method: "get",
  middleware: [authenticated],
  path: "/ai/models",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      AvailableModelsResponseSchema,
      "Available AI models",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      CommonUnauthorizedResponseSchema,
      "Unauthorized",
    ),
  },
  security: [{ CookieAuth: [] }],
  summary: "Lists provider-backed AI models for the model selector.",
  tags,
});

export type GetAvailableModelsRoute = typeof getAvailableModels;
