import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorDisplayProps {
  error: Error;
  onRetry: () => void;
  onClear: () => void;
}

export function ErrorDisplay({ error, onRetry, onClear }: ErrorDisplayProps) {
  return (
    <div className="flex items-start gap-3 p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20 dark:border-red-800">
      <AlertCircleIcon className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Something went wrong</div>
        <div className="text-sm text-red-700 dark:text-red-300 mb-3">{error.message}</div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-8 text-xs border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            <RefreshCwIcon className="w-3 h-3 mr-1" />
            Retry
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            className="h-8 text-xs text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
