import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type BrandMarkProps = ComponentProps<"span"> & {
  label?: string;
};

function BrandMark({ className, label, ...props }: BrandMarkProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-violet-500/20 ring-1 ring-white/20",
        className,
      )}
      role={label ? "img" : undefined}
      {...props}
    >
      <svg aria-hidden="true" className="size-[68%]" fill="none" viewBox="0 0 32 32">
        <path
          d="M8.75 9.5h14.5A2.75 2.75 0 0 1 26 12.25v7a2.75 2.75 0 0 1-2.75 2.75H16l-5.25 3.75V22h-2A2.75 2.75 0 0 1 6 19.25v-7A2.75 2.75 0 0 1 8.75 9.5Z"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M11.5 14h9M11.5 18h5.75" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <circle cx="21.25" cy="18" fill="currentColor" r="1.15" />
      </svg>
    </span>
  );
}

export { BrandMark };
