import {
  AIStreamResponseHeaders,
  ChatRequestSchema,
  CommonBadRequestResponseSchema,
  CommonUnauthorizedResponseSchema,
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { asRouteMiddleware } from "@/lib/hono-compat";
import { notFoundSchema } from "@/lib/constants";
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
      description: "Schema for ai chat request with model and webSearch",
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
            example:
              'data: {"type":"start","messageId":"msg_123"}\\n\\ndata: {"type":"text-start","id":"text-1"}\\n\\ndata: {"type":"text-delta","id":"text-1","delta":"Hello"}\\n\\ndata: {"type":"text-end","id":"text-1"}\\n\\ndata: {"type":"finish"}\\n\\ndata: [DONE]\\n\\n',
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
