import type { ChatStatus } from "ai";
import { GlobeIcon } from "lucide-react";
import type { ClipboardEvent } from "react";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { FileUpload } from "@/components/chat/FileUpload";
import { ToolSelector } from "@/components/chat/ToolSelector";
import { models } from "@/utils";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  selectedTools: string[];
  setSelectedTools: (tools: string[]) => void;
  files: FileList | undefined;
  setFiles: (files: FileList | undefined) => void;
  onSubmit: (e: React.FormEvent) => void;
  onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  status: ChatStatus;
}

export function ChatInput({
  input,
  setInput,
  model,
  setModel,
  webSearch,
  setWebSearch,
  selectedTools,
  setSelectedTools,
  files,
  setFiles,
  onSubmit,
  onPaste,
  status,
}: ChatInputProps) {
  return (
    <PromptInput onSubmit={onSubmit} className="mt-4">
      <FileUpload files={files} onFilesChange={setFiles} />
      <PromptInputTextarea onChange={(e) => setInput(e.target.value)} value={input} onPaste={onPaste} />
      <PromptInputToolbar>
        <PromptInputTools>
          <PromptInputButton variant={webSearch ? "default" : "ghost"} onClick={() => setWebSearch(!webSearch)}>
            <GlobeIcon size={16} />
            <span>Search</span>
          </PromptInputButton>
          <ToolSelector selectedTools={selectedTools} onToolsChange={setSelectedTools} />
          <PromptInputModelSelect onValueChange={setModel} value={model}>
            <PromptInputModelSelectTrigger>
              <PromptInputModelSelectValue />
            </PromptInputModelSelectTrigger>
            <PromptInputModelSelectContent>
              {models.map((model) => (
                <PromptInputModelSelectItem key={model.id} value={model.id}>
                  {model.name}
                </PromptInputModelSelectItem>
              ))}
            </PromptInputModelSelectContent>
          </PromptInputModelSelect>
        </PromptInputTools>
        <PromptInputSubmit disabled={!input} status={status} />
      </PromptInputToolbar>
    </PromptInput>
  );
}
