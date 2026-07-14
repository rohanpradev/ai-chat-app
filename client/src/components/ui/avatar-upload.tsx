import { Camera, Upload, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"] as const;

interface AvatarUploadProps {
  value?: string | null;
  onChange: (value: string | undefined) => void;
  onFileChange?: (file: File | null) => void;
  className?: string;
  disabled?: boolean;
}

export function AvatarUpload({
  value,
  onChange,
  onFileChange,
  className,
  disabled,
}: Readonly<AvatarUploadProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type as (typeof ACCEPTED_AVATAR_TYPES)[number])) {
      toast.error("Choose a GIF, JPEG, PNG, or WebP image.");
      resetFileInput();
      return;
    }

    if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
      toast.error("Profile images must be smaller than 5 MB.");
      resetFileInput();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        toast.error("Unable to preview this image.");
        resetFileInput();
        return;
      }

      onChange(reader.result);
      onFileChange?.(file);
    };
    reader.onerror = () => {
      toast.error("Unable to read this image.");
      resetFileInput();
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange(undefined);
    onFileChange?.(null);
    resetFileInput();
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={value ? "Choose a different profile image" : "Choose a profile image"}
        className={cn(
          "group relative rounded-full outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50 hover:scale-100",
        )}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <Avatar className="size-24 border bg-muted shadow-sm">
          <AvatarImage src={value ?? undefined} alt="Profile image preview" />
          <AvatarFallback className="text-lg">
            <Camera className="size-8 text-muted-foreground" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>

        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/65 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Upload className="size-6 text-background" aria-hidden="true" />
        </span>
      </button>

      {value && !disabled ? (
        <Button
          type="button"
          aria-label="Remove profile image"
          className="absolute -right-2 -top-2 size-7 rounded-full"
          onClick={handleRemove}
          size="icon"
          variant="destructive"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES.join(",")}
        aria-label="Profile image file"
        className="sr-only"
        disabled={disabled}
        onChange={handleFileSelect}
        tabIndex={-1}
      />
    </div>
  );
}
