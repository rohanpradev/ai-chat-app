import { models } from "@chat-app/shared";
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
import { ToolSelector } from "@/components/chat/ToolSelector";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  selectedTools: string[];
  setSelectedTools: (tools: string[]) => void;
  onMessageSend: (message: PromptInputMessage) => void;
  status: ChatStatus;
}

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

function PromptSubmit({ input, status }: { input: string; status: ChatStatus }) {
  const attachments = usePromptInputAttachments();
  const hasAttachments = attachments.files.length > 0;
  const isStreaming = status === "streaming";

  return <PromptInputSubmit disabled={!input && !hasAttachments && !isStreaming} status={status} />;
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
  onMessageSend,
  status,
}: ChatInputProps) {
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
    <PromptInput
      onSubmit={handleSubmit}
      className="mt-4"
      multiple
      accept="image/*,application/pdf,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.html,.css,.xml,.csv"
      maxFiles={10}
      maxFileSize={10 * 1024 * 1024} // 10MB
      onError={(err) => {
        const errorMessage = typeof err === "object" && "message" in err ? err.message : "File upload error";
        console.error("File upload error:", errorMessage);
        // You could add a toast notification here
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
            <span>Search</span>
          </PromptInputButton>
          <ToolSelector selectedTools={selectedTools} onToolsChange={setSelectedTools} />
          <PromptInputSelect onValueChange={setModel} value={model}>
            <PromptInputSelectTrigger>
              <PromptInputSelectValue />
            </PromptInputSelectTrigger>
            <PromptInputSelectContent>
              {models.map((model) => (
                <PromptInputSelectItem key={model.id} value={model.id}>
                  {model.name}
                </PromptInputSelectItem>
              ))}
            </PromptInputSelectContent>
          </PromptInputSelect>
        </PromptInputTools>
        <PromptSubmit input={input} status={status} />
      </PromptInputFooter>
    </PromptInput>
  );
}
