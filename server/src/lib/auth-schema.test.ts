import { describe, expect, it } from "bun:test";
import { AUTH_PASSWORD_MIN_LENGTH, LoginUserRequestSchema, RegisterUserRequestSchema } from "@chat-app/shared";

const registration = {
	confirmPassword: "password",
	email: "person@example.com",
	name: "Person",
	password: "password"
};

describe("auth request schemas", () => {
	it("requires the current minimum for new passwords", () => {
		const shortPassword = "a".repeat(AUTH_PASSWORD_MIN_LENGTH - 1);
		const minimumPassword = "a".repeat(AUTH_PASSWORD_MIN_LENGTH);

		expect(
			RegisterUserRequestSchema.safeParse({
				...registration,
				confirmPassword: shortPassword,
				password: shortPassword
			}).success
		).toBe(false);
		expect(
			RegisterUserRequestSchema.safeParse({
				...registration,
				confirmPassword: minimumPassword,
				password: minimumPassword
			}).success
		).toBe(true);
	});

	it("does not apply the new-registration minimum to existing-account sign in", () => {
		expect(LoginUserRequestSchema.safeParse({ email: registration.email, password: "legacy" }).success).toBe(true);
	});
});
