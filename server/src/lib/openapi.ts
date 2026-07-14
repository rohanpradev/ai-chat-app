import type { Hook } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppBindings } from "@/lib/types";

export const defaultHook: Hook<unknown, AppBindings, string, unknown> = (result, c) => {
	if (!result.success) {
		return c.json(
			{
				errors: result.error.issues.map((issue) => ({
					field: issue.path.join(".") || "request",
					message: issue.message
				})),
				message: "Invalid request payload"
			},
			HttpStatusCodes.BAD_REQUEST
		);
	}
};

export const jsonContent = <T>(schema: T, description: string) => ({
	content: {
		"application/json": {
			schema
		}
	},
	description
});

export const jsonBody = <T>(schema: T, description: string) => ({
	...jsonContent(schema, description),
	required: true as const
});

export const createMessageObjectSchema = (exampleMessage = "Hello World") =>
	z
		.object({
			message: z.string()
		})
		.openapi({
			example: {
				message: exampleMessage
			}
		});
