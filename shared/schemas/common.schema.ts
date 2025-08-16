import { z } from "@hono/zod-openapi";

export const CommonErrorResponseSchema = z
	.object({
		message: z.string().describe("Error message"),
	})
	.openapi({
		description: "Standard error response",
		title: "CommonErrorResponse",
	});

export const SuccessMessageResponseSchema = z
	.object({
		message: z.string().describe("Success message"),
	})
	.openapi({
		description: "Standard success response with message",
		title: "SuccessMessageResponse",
	});

export const ValidationErrorSchema = z.object({
	message: z.string().describe("Error description"),
	path: z.string().describe("Field with error"),
});

export const CommonBadRequestResponseSchema = z
	.object({
		errors: z.array(ValidationErrorSchema).optional().describe("Validation errors"),
		message: z.string().describe("Error message"),
	})
	.openapi({
		description: "Standard bad request response with validation errors",
		title: "CommonBadRequestResponse",
	});

export const CommonUnauthorizedResponseSchema = z
	.object({
		message: z.string().describe("Unauthorized access message"),
	})
	.openapi({
		description: "Standard unauthorized response",
		title: "CommonUnauthorizedResponse",
	});

export const CommonNotFoundResponseSchema = z
	.object({
		message: z.string().describe("Resource not found message"),
	})
	.openapi({
		description: "Standard not found response",
		title: "CommonNotFoundResponse",
	});
