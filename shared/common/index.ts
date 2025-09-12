export const models = [
	{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
	{ id: "DeepSeek-R1-0528", name: "DeepSeek R1" },
];

export type ModelName = (typeof models)[number]["id"];

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
