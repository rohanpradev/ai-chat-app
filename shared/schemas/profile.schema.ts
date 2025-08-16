import { z } from "@hono/zod-openapi";
import { CommonBadRequestResponseSchema, CommonErrorResponseSchema } from "./common.schema";

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
		.instanceof(File)
		.optional()
		.describe("Profile picture image file (JPEG, PNG, WebP)")
		.openapi({ format: "binary", type: "string" }),
});

export const GetProfileResponseSchema = z.object({
	data: BasicUserProfileDataSchema,
	message: z.string().describe("Register success message"),
});

export const UpdateProfileResponseSchema = z.object({
	data: UserProfileDataSchema,
	message: z.string().describe("Update success message"),
});

export const ProfileErrorResponseSchema = CommonErrorResponseSchema;
export const BadRequestResponseSchema = CommonBadRequestResponseSchema;
