/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PromptInput,
  PromptInputTextarea,
  type PromptInputProps,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";

function AttachmentNames() {
  const { files } = usePromptInputAttachments();
  return files.map(({ filename, id }) => <span key={id}>{filename}</span>);
}

function setup(onSubmit: PromptInputProps["onSubmit"], onError?: PromptInputProps["onError"]) {
  render(
    <PromptInput onError={onError} onSubmit={onSubmit}>
      <PromptInputTextarea aria-label="Prompt" />
      <AttachmentNames />
      <button type="submit">Submit</button>
    </PromptInput>,
  );
  const prompt = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Prompt" });
  const form = prompt.form;
  if (!form) throw new Error("Expected a prompt form");

  const attach = (filename: string) => {
    fireEvent.change(screen.getByLabelText("Upload files"), {
      target: { files: [new File([filename], filename, { type: "text/plain" })] },
    });
  };

  return { attach, form, prompt };
}

const readableAttachment = () => ({ ok: true, blob: async () => new Blob(["notes"], { type: "text/plain" }) });

beforeEach(() => {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL(file: File) {
      return `blob:https://example.test/${file.name}`;
    }

    static revokeObjectURL = vi.fn();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PromptInput submission", () => {
  it("reports an unreadable attachment and keeps the draft available for retry", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(readableAttachment());
    vi.stubGlobal("fetch", fetch);
    const onError = vi.fn();
    const onSubmit = vi.fn();
    const { attach, form, prompt } = setup(onSubmit, onError);

    fireEvent.change(prompt, { target: { value: "Read these notes" } });
    attach("notes.txt");
    fireEvent.submit(form);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "file_read" })));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(prompt.value).toBe("Read these notes");
    expect(screen.getByText("notes.txt")).toBeDefined();

    fireEvent.submit(form);
    await waitFor(() => expect(screen.queryByText("notes.txt")).toBeNull());
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      {
        files: [{ filename: "notes.txt", mediaType: "text/plain", type: "file", url: "data:text/plain;base64,bm90ZXM=" }],
        text: "Read these notes",
      },
      expect.anything(),
    );
    expect(prompt.value).toBe("");
  });

  it("deduplicates pending submissions and keeps changes made during a send", async () => {
    const attachmentRead = Promise.withResolvers<ReturnType<typeof readableAttachment>>();
    const send = Promise.withResolvers<void>();
    const fetch = vi.fn().mockReturnValue(attachmentRead.promise);
    vi.stubGlobal("fetch", fetch);
    const onSubmit = vi.fn().mockReturnValue(send.promise);
    const { attach, form, prompt } = setup(onSubmit);

    fireEvent.change(prompt, { target: { value: "First prompt" } });
    attach("first.txt");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);

    attachmentRead.resolve(readableAttachment());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    fireEvent.change(prompt, { target: { value: "Next prompt" } });
    attach("next.txt");
    fireEvent.submit(form);

    await act(async () => send.resolve());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("first.txt")).toBeNull();
    expect(screen.getByText("next.txt")).toBeDefined();
    expect(prompt.value).toBe("Next prompt");
  });
});
