export const enabledRequestToolIds = ["serper", "mcp"] as const;
export type EnabledRequestToolId = (typeof enabledRequestToolIds)[number];

export const webSearchToolId: EnabledRequestToolId = "serper";
