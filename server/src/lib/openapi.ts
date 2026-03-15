import type { Hook } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppBindings } from "@/lib/types";

export const defaultHook: Hook<unknown, AppBindings, string, unknown> = (result, c) => {
	if (!result.success) {
		return c.json(
			{
				error: {
					issues: result.error.issues,
					name: result.error.name
				},
				success: result.success
			},
			HttpStatusCodes.UNPROCESSABLE_ENTITY
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
