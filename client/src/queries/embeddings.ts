import type { EmbeddingIngestTextRequest, EmbeddingSearchRequest, RagRequest } from "@chat-app/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";
import { EMBEDDING_QUERY_KEY } from "@/utils/query-key";

export const getEmbeddingDocumentsQuery = () => {
  const api = getApiClient();

  return queryOptions({
    queryFn: () => api.embeddings.list(),
    queryKey: EMBEDDING_QUERY_KEY.documents,
    staleTime: 30 * 1000,
  });
};

export const useUploadEmbeddingDocument = () => {
  const api = getApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { file: File; metadata?: Record<string, unknown>; title?: string }) =>
      api.embeddings.upload(payload),
    mutationKey: EMBEDDING_QUERY_KEY.upload,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EMBEDDING_QUERY_KEY.documents });
    },
  });
};

export const useIngestEmbeddingText = () => {
  const api = getApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: EmbeddingIngestTextRequest) => api.embeddings.ingestText(payload),
    mutationKey: ["embeddings", "ingest"] as const,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EMBEDDING_QUERY_KEY.documents });
    },
  });
};

export const useDeleteEmbeddingDocument = () => {
  const api = getApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.embeddings.delete(id),
    mutationKey: ["embeddings", "delete"] as const,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EMBEDDING_QUERY_KEY.documents });
    },
  });
};

export const useSearchEmbeddings = () => {
  const api = getApiClient();

  return useMutation({
    mutationFn: (payload: EmbeddingSearchRequest) => api.embeddings.search(payload),
    mutationKey: EMBEDDING_QUERY_KEY.search,
  });
};

export const useRagQuestion = () => {
  const api = getApiClient();

  return useMutation({
    mutationFn: (payload: RagRequest) => api.embeddings.rag(payload),
    mutationKey: EMBEDDING_QUERY_KEY.rag,
  });
};
