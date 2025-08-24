import { z } from "@hono/zod-openapi";

export const ValidationErrorSchema = z
	.object({
		field: z.string().describe("Field name with validation error"),
		message: z.string().describe("Validation error message"),
	})
	.openapi({
		description: "Validation error details",
		title: "ValidationError",
	});

export const CommonErrorResponseSchema = z
	.object({
		message: z.string().describe("Error message"),
	})
	.openapi({
		description: "Standard error response",
		title: "CommonErrorResponse",
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
