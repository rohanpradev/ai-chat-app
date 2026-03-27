import type { MyUIMessage } from "@chat-app/shared";

type MessagePart = MyUIMessage["parts"][number];

const terminalToolStates = ["approval-responded", "output-available", "output-denied", "output-error"] as const;

type TerminalToolState = (typeof terminalToolStates)[number];

const hasTypePrefix = (value: unknown, prefix: string): value is string =>
	typeof value === "string" && value.startsWith(prefix);

const isTerminalToolState = (state: string): state is TerminalToolState =>
	terminalToolStates.includes(state as TerminalToolState);

const shouldKeepPart = (part: MessagePart) => {
	if (!hasTypePrefix(part.type, "tool-")) {
		return true;
	}

	if (!("state" in part) || typeof part.state !== "string") {
		return true;
	}

	return isTerminalToolState(part.state);
};

const normalizeAssistantMessage = (message: MyUIMessage): MyUIMessage => {
	if (message.role !== "assistant") {
		return message;
	}

	return {
		...message,
		parts: message.parts.filter(shouldKeepPart)
	};
};

export const normalizeMessagesForAgent = (messages: readonly MyUIMessage[]): MyUIMessage[] =>
	messages.map(normalizeAssistantMessage).filter((message) => message.parts.length > 0);
