import { z } from "zod";

export const redirectSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});
