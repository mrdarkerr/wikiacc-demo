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
        "fixed inset-0 z-[100] m-0 h-[100dvh] w-[100vw] overflow-hidden bg-background/80 backdrop-blur-sm",
        className,
      )}
      role="dialog"
      onClick={onClose}
    >
      <div className="flex h-full w-full items-center justify-center p-4">
        <div
          className={cn("w-full", contentClassName)}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
