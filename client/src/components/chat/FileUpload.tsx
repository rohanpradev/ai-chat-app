import { PaperclipIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFilesChange: (files: FileList | undefined) => void;
  files: FileList | undefined;
}

export function FileUpload({ onFilesChange, files }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilesChange(event.target.files || undefined);
  };

  const clearFiles = () => {
    onFilesChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
          <PaperclipIcon size={16} />
          Attach
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,application/pdf,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.html,.css,.xml,.csv"
        />
      </div>

      {files && files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(files).map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
            >
              <span className="truncate max-w-32">{file.name}</span>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={clearFiles}>
            <XIcon size={12} />
          </Button>
        </div>
      )}
    </div>
  );
}
