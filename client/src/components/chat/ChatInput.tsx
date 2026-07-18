import {
  type AgentMode,
  type AIModelDefinition,
  type AIModelId,
  agentModes,
  isAgentMode,
  isAvailableModelId,
} from "@chat-app/shared";
import type { ChatStatus } from "ai";
import { GlobeIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";

const LazyAgentModePanel = lazy(async () => {
  const { AgentModePanel } = await import("@/components/chat/AgentModePanel");
  return { default: AgentModePanel };
});

interface ChatInputProps {
  availableModels: AIModelDefinition[];
  input: string;
  setInput: (value: string) => void;
  agentMode: AgentMode;
  setAgentMode: (value: AgentMode) => void;
  model: AIModelId;
  setModel: (value: AIModelId) => void;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  onMessageSend: (message: PromptInputMessage) => void | Promise<void>;
  onStop: () => void;
  showAgentGuide?: boolean;
  status: ChatStatus;
}

type AgentOption = (typeof agentModes)[number];
type ModelOption = AIModelDefinition;

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment data={attachment} key={attachment.id} onRemove={() => attachments.remove(attachment.id)}>
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

function PromptSubmit({ input, onStop, status }: Readonly<{ input: string; onStop: () => void; status: ChatStatus }>) {
  const attachments = usePromptInputAttachments();
  const hasAttachments = attachments.files.length > 0;
  const isGenerating = status === "submitted" || status === "streaming";

  return (
    <PromptInputSubmit
      className="rounded-full"
      disabled={!input.trim() && !hasAttachments && !isGenerating}
      onStop={onStop}
      status={status}
    />
  );
}

export function ChatInput({
  availableModels,
  input,
  setInput,
  agentMode,
  setAgentMode,
  model,
  setModel,
  webSearch,
  setWebSearch,
  onMessageSend,
  onStop,
  showAgentGuide = false,
  status,
}: Readonly<ChatInputProps>) {
  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    const hasText = Boolean(text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    await onMessageSend({ ...message, text });
    setInput("");
  };

  const handleAgentModeChange = (value: string) => {
    if (isAgentMode(value)) {
      setAgentMode(value);
    }
  };

  const handleModelChange = (value: string) => {
    if (isAvailableModelId(value, availableModels)) {
      setModel(value);
    }
  };

  return (
    <div className="space-y-3">
      {showAgentGuide ? (
        <Suspense fallback={null}>
          <LazyAgentModePanel
            agentMode={agentMode}
            availableModels={availableModels}
            model={model}
            webSearch={webSearch}
          />
        </Suspense>
      ) : null}
      <PromptInput
        onSubmit={handleSubmit}
        className="mt-0 rounded-[28px] [&_[data-slot=input-group]]:rounded-[28px] [&_[data-slot=input-group]]:border-border/70 [&_[data-slot=input-group]]:bg-card/90 [&_[data-slot=input-group]]:shadow-lg [&_[data-slot=input-group]]:shadow-black/5 dark:[&_[data-slot=input-group]]:bg-card/70 dark:[&_[data-slot=input-group]]:shadow-black/20"
        multiple
        accept="image/*,application/pdf,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.html,.css,.xml,.csv"
        maxFiles={3}
        maxFileSize={5 * 1024 * 1024}
        onError={(err) => {
          const errorMessage = typeof err === "object" && "message" in err ? err.message : "File upload error";
          toast.error(errorMessage);
        }}
      >
        <PromptInputAttachmentsDisplay />
        <PromptInputBody>
          <PromptInputTextarea
            className="min-h-20 px-5 pt-5 text-base sm:text-base"
            disabled={status !== "ready" && status !== "error"}
            onChange={(e) => setInput(e.target.value)}
            value={input}
          />
        </PromptInputBody>
        <PromptInputFooter className="flex-wrap px-2.5 pb-2.5">
          <PromptInputTools className="flex-wrap gap-1.5">
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger className="rounded-full" />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
                <PromptInputActionAddScreenshot />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputButton
              aria-label="Toggle web search"
              aria-pressed={webSearch}
              className="rounded-full"
              variant={webSearch ? "default" : "ghost"}
              onClick={() => setWebSearch(!webSearch)}
            >
              <GlobeIcon size={16} />
              <span className="hidden sm:inline">Web Search</span>
            </PromptInputButton>
            <PromptInputSelect onValueChange={handleAgentModeChange} value={agentMode}>
              <PromptInputSelectTrigger aria-label="Agent mode" className="rounded-full">
                <PromptInputSelectValue />
              </PromptInputSelectTrigger>
              <PromptInputSelectContent>
                {agentModes.map((agentOption: AgentOption) => (
                  <PromptInputSelectItem key={agentOption.id} value={agentOption.id}>
                    {agentOption.name}
                  </PromptInputSelectItem>
                ))}
              </PromptInputSelectContent>
            </PromptInputSelect>
            <PromptInputSelect onValueChange={handleModelChange} value={model}>
              <PromptInputSelectTrigger aria-label="AI model" className="rounded-full">
                <PromptInputSelectValue />
              </PromptInputSelectTrigger>
              <PromptInputSelectContent>
                {availableModels.map((modelOption: ModelOption) => (
                  <PromptInputSelectItem key={modelOption.id} value={modelOption.id}>
                    {modelOption.name}
                  </PromptInputSelectItem>
                ))}
              </PromptInputSelectContent>
            </PromptInputSelect>
          </PromptInputTools>
          <PromptSubmit input={input} onStop={onStop} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
