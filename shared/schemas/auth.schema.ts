import { z } from "@hono/zod-openapi";

const MAX_PROFILE_IMAGE_DATA_URL_LENGTH = 7 * 1024 * 1024;
const ProfileImageDataUrlSchema = z
	.string()
	.max(MAX_PROFILE_IMAGE_DATA_URL_LENGTH, "Encoded profile image is too large")
	.regex(
		/^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
		"Profile image must be a GIF, JPEG, PNG, or WebP data URL",
	);

export const UserDataSchema = z
	.object({
		email: z.email().describe("The email address of the user").openapi({ format: "email", type: "string" }),
		id: z.uuid().describe("The unique identifier of the user").openapi({ format: "uuid", type: "string" }),
		name: z.string().describe("The username of the user"),
		profileImage: z.string().nullable().optional().describe("Base64 encoded profile image").openapi({ type: "string" }),
	})
	.openapi({
		description: "User information",
		title: "UserData",
	});

export const RegisterUserRequestSchema = z
	.object({
		confirmPassword: z.string().min(6).max(100).describe("Password confirmation"),
		email: z.email().describe("The email address of the user").openapi({ format: "email", type: "string" }),
		name: z.string().min(3).max(30).describe("The username of the user"),
		password: z.string().min(6).max(100).describe("The password for the user account"),
		profileImage: ProfileImageDataUrlSchema.optional()
			.describe("Optional Base64 encoded profile image")
			.openapi({ type: "string" }),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
	})
	.openapi({
		description: "Request body for registering a new user",
		example: {
			confirmPassword: "XXXXXXXXXXX",
			email: "johndoe@example.com",
			name: "XXXXXXX",
			password: "XXXXXXXXXXX",
			profileImage: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
		},
		title: "RegisterUserRequest",
	});

export const LoginUserRequestSchema = z
	.object({
		email: z.email().describe("The email address of the user").openapi({ format: "email", type: "string" }),
		password: z.string().min(6).max(100).describe("The password for the user account"),
	})
	.openapi({
		description: "Request body for logging in a user",
		example: {
			email: "johndoe@example.com",
			password: "XXXXXXXXXXX",
		},
		title: "LoginUserRequest",
	});

export const RegisterResponseSchema = z
	.object({
		data: UserDataSchema,
		message: z.string().describe("Register success message"),
	})
	.openapi({
		description: "Successful registration response",
		title: "RegisterResponse",
	});

export const LoginResponseSchema = z
	.object({
		data: UserDataSchema,
		message: z.string().describe("Login success message"),
	})
	.openapi({
		description: "Successful login response",
		title: "LoginResponse",
	});

export const LogoutResponseSchema = z
	.object({
		message: z.string().describe("Logout message"),
	})
	.openapi({
		description: "Successful logout response",
		title: "LogoutResponse",
	});

export const MeResponseSchema = z
	.object({
		data: UserDataSchema,
		message: z.string().describe("User is valid"),
	})
	.openapi({
		description: "Current user response",
		title: "MeResponse",
	});

export const ErrorResponseSchema = z
	.object({
		message: z.string().describe("Error message"),
	})
	.openapi({
		description: "Standard error response",
		title: "ErrorResponse",
	});

export const UnauthorizedResponseSchema = z
	.object({
		message: z.string().describe("Unauthorized access message"),
	})
	.openapi({
		description: "Unauthorized response",
		title: "UnauthorizedResponse",
	});
