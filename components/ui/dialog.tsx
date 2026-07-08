"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DialogOverlayProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onClose?: () => void;
};

export function DialogOverlay({
  children,
  className,
  contentClassName,
  onClose,
}: DialogOverlayProps) {
  return (
    <div
      aria-modal="true"
      className={cn(
        "fixed bottom-0 left-0 right-0 top-0 z-[100] grid place-items-center bg-background/80 p-4 backdrop-blur-sm",
        className,
      )}
      role="dialog"
      onClick={onClose}
    >
      <div
        className={cn("w-full", contentClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
