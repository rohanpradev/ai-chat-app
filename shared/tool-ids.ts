export const enabledRequestToolIds = ["serper"] as const;
export type EnabledRequestToolId = (typeof enabledRequestToolIds)[number];

export const webSearchToolId: EnabledRequestToolId = "serper";
