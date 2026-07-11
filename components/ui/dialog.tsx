"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DialogOverlayProps = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onClose?: () => void;
};

export function DialogOverlay({
  ariaLabel,
  children,
  className,
  contentClassName,
  onClose,
}: DialogOverlayProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPortalRoot(document.body);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!portalRoot) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalRoot]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      aria-label={ariaLabel}
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-[100] m-0 h-[100dvh] w-[100vw] overflow-hidden bg-background/80 backdrop-blur-sm",
        className,
      )}
      role="dialog"
      style={{ inset: 0, margin: 0 }}
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
    </div>,
    portalRoot,
  );
}
