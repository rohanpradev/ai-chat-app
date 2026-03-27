import { type AgentMode, type AIModelDefinition, type AIModelId, agentModes } from "@chat-app/shared";
import type { ChatStatus } from "ai";
import { GlobeIcon } from "lucide-react";
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
import { AgentModePanel } from "@/components/chat/AgentModePanel";

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
  onMessageSend: (message: PromptInputMessage) => void;
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

function PromptSubmit({ input, status }: Readonly<{ input: string; status: ChatStatus }>) {
  const attachments = usePromptInputAttachments();
  const hasAttachments = attachments.files.length > 0;
  const isStreaming = status === "streaming";

  return <PromptInputSubmit disabled={!input && !hasAttachments && !isStreaming} status={status} />;
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
  showAgentGuide = false,
  status,
}: Readonly<ChatInputProps>) {
  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    onMessageSend(message);
    setInput("");
  };

  return (
    <div className="mt-4 space-y-3">
      {showAgentGuide ? (
        <AgentModePanel agentMode={agentMode} availableModels={availableModels} model={model} webSearch={webSearch} />
      ) : null}
      <PromptInput
        onSubmit={handleSubmit}
        className="mt-0"
        multiple
        accept="image/*,application/pdf,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.html,.css,.xml,.csv"
        maxFiles={10}
        maxFileSize={10 * 1024 * 1024}
        onError={(err) => {
          const errorMessage = typeof err === "object" && "message" in err ? err.message : "File upload error";
          console.error("File upload error:", errorMessage);
        }}
      >
        <PromptInputAttachmentsDisplay />
        <PromptInputBody>
          <PromptInputTextarea onChange={(e) => setInput(e.target.value)} value={input} />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputButton variant={webSearch ? "default" : "ghost"} onClick={() => setWebSearch(!webSearch)}>
              <GlobeIcon size={16} />
              <span>Web Search</span>
            </PromptInputButton>
            <PromptInputSelect onValueChange={(value) => setAgentMode(value as AgentMode)} value={agentMode}>
              <PromptInputSelectTrigger>
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
            <PromptInputSelect onValueChange={(value) => setModel(value as AIModelId)} value={model}>
              <PromptInputSelectTrigger>
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
          <PromptSubmit input={input} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
