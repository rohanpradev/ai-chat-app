import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const redirectSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const redirectSearchValidator = zodValidator(redirectSearchSchema);
