import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

/** An explicit MCP read owns its cancellation and cannot publish a cancelled result. */
export function useMcpRequest<TVariables, TData>(
  request: (variables: TVariables, signal: AbortSignal) => Promise<TData>,
) {
  const controller = useRef<AbortController | null>(null);
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async ({ variables, signal }: { variables: TVariables; signal: AbortSignal }) => {
      const data = await request(variables, signal);
      signal.throwIfAborted();
      return data;
    },
  });
  useEffect(() => () => controller.current?.abort(), []);
  const reset = () => {
    controller.current?.abort();
    controller.current = null;
    mutation.reset();
    setNotice("");
  };
  return {
    data: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    notice,
    reset,
    start: (variables: TVariables) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setNotice("");
      mutation.mutate({ variables, signal: abort.signal });
    },
    cancel: (message: string) => {
      reset();
      setNotice(message);
    },
  };
}
