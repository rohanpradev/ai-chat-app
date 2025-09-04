import { z } from "@hono/zod-openapi";

export const UserProfileDataSchema = z.object({
	email: z.email().describe("The email address of the user").openapi({ format: "email", type: "string" }),
	id: z.uuid().describe("The unique identifier of the user").openapi({ format: "uuid", type: "string" }),
	name: z.string().describe("The username of the user"),
	profileImage: z.string().nullable().optional().describe("URL to the profile picture"),
});

export const BasicUserProfileDataSchema = z.object({
	email: z.email().describe("The email address of the user").openapi({ format: "email", type: "string" }),
	id: z.uuid().describe("The unique identifier of the user").openapi({ format: "uuid", type: "string" }),
	name: z.string().describe("The username of the user"),
});

export const UpdateProfileRequestSchema = z.object({
	name: z.string().describe("The new name of the user"),
	profileImage: z
		.string()
		.optional()
		.describe("Profile picture as base64 string")
		.openapi({ type: "string", format: "byte" })
});

export const GetProfileResponseSchema = z.object({
	data: BasicUserProfileDataSchema,
	message: z.string().describe("Profile retrieval success message"),
});

export const UpdateProfileResponseSchema = z.object({
	data: UserProfileDataSchema,
	message: z.string().describe("Update success message"),
});

export const ProfileErrorResponseSchema = z
	.object({
		message: z.string().describe("Error message"),
	})
	.openapi({
		description: "Profile error response",
		title: "ProfileErrorResponse",
	});

export const BadRequestResponseSchema = z
	.object({
		message: z.string().describe("Bad request error message"),
	})
	.openapi({
		description: "Bad request response",
		title: "BadRequestResponse",
	});
