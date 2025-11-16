import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  className?: string;
  disabled?: boolean;
}

export function AvatarUpload({ value, onChange, className, disabled }: AvatarUploadProps) {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onChange(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "relative cursor-pointer transition-all duration-200",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        <Avatar className="h-24 w-24">
          <AvatarImage src={value} alt="Profile" />
          <AvatarFallback className="text-lg">
            <Camera className="h-8 w-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        
        {/* Overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity duration-200",
            isHovered && !disabled && "opacity-100"
          )}
        >
          <Upload className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Remove button */}
      {value && !disabled && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}