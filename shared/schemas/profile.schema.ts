import { z } from "@hono/zod-openapi";

const profileFields = {
	createdAt: z.iso.datetime().describe("Account creation timestamp"),
	email: z.email().describe("The email address of the user").openapi({ format: "email", type: "string" }),
	emailVerified: z.boolean().describe("Whether the email address has been verified"),
	id: z.uuid().describe("The unique identifier of the user").openapi({ format: "uuid", type: "string" }),
	name: z.string().describe("The username of the user"),
	profileImage: z.string().nullable().optional().describe("URL to the profile picture"),
	updatedAt: z.iso.datetime().describe("Profile update timestamp"),
} as const;

export const UserProfileDataSchema = z.object(profileFields);

export const BasicUserProfileDataSchema = z.object(profileFields);

export const UpdateProfileRequestSchema = z.object({
	name: z.string().trim().min(3).max(30).describe("The new name of the user"),
	profileImage: z
		.instanceof(File)
		.optional()
		.describe("Profile picture file")
		.openapi({ format: "binary", type: "string" }),
	removeProfileImage: z.enum(["true", "false"]).optional().describe("Set to true to remove the current profile picture"),
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

export type GetProfileResponse = z.infer<typeof GetProfileResponseSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;
