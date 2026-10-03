const defaults: Record<string, string> = {
	AI_GATEWAY_API_KEY: "test-gateway-key",
	BETTER_AUTH_SECRET: "test_secret_minimum_32_characters",
	CLIENT_URL: "http://localhost:5173",
	DB_URL: "postgres://postgres:postgres@localhost:5432/chatapp",
	JWT_SECRET: "test_secret_minimum_32_characters",
	NODE_ENV: "test",
	REDIS_URL: "redis://localhost:6379",
	SERPER_API_KEY: "test-serper-key"
};

for (const [key, value] of Object.entries(defaults)) {
	if (!Bun.env[key]) {
		Bun.env[key] = value;
	}
}
