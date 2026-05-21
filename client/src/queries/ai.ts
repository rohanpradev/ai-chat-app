import type { AIEvaluationRequest, AIPlanRequest } from "@chat-app/shared";
import { useMutation } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";

export const useGenerateAiPlan = () => {
  const api = getApiClient();

  return useMutation({
    mutationFn: (payload: AIPlanRequest) => api.ai.plan(payload),
    mutationKey: ["ai", "plan"] as const,
  });
};

export const useEvaluateAiOutput = () => {
  const api = getApiClient();

  return useMutation({
    mutationFn: (payload: AIEvaluationRequest) => api.ai.evaluate(payload),
    mutationKey: ["ai", "evaluate"] as const,
  });
};
