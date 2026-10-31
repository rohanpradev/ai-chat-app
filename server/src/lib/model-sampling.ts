// Original GPT-5 reasoning models reject temperature, including dated snapshots.
// Later model families have different reasoning-dependent capabilities; preserve
// their existing options rather than inferring support from a broad name prefix.
// https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2
export const modelTemperature = (modelId: string, temperature: number): number | undefined =>
	/^openai\/gpt-5(?:-(?:mini|nano))?(?:-\d{4}-\d{2}-\d{2})?$/.test(modelId) ? undefined : temperature;
