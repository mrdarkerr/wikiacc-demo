"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type SelectProps = {
  "aria-label"?: string;
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange?: (event: { target: { value: string } }) => void;
  onValueChange?: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
  required?: boolean;
  triggerClassName?: string;
  value: string;
};

const EMPTY_OPTION: SelectOption = { label: "", value: "" };

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      "aria-label": ariaLabel,
      children,
      className,
      containerClassName,
      contentClassName,
      disabled,
      id,
      name,
      onChange,
      onValueChange,
      options,
      placeholder = "انتخاب کنید",
      triggerClassName,
      value,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const childOptions = React.useMemo(() => {
      return React.Children.toArray(children).flatMap((child) => {
        if (!React.isValidElement(child) || child.type !== "option") {
          return [];
        }

        const props = child.props as {
          children?: React.ReactNode;
          disabled?: boolean;
          value?: string | number;
        };

        return {
          disabled: props.disabled,
          label: React.Children.toArray(props.children).join(""),
          value: props.value === undefined ? "" : String(props.value),
        };
      });
    }, [children]);
    const resolvedOptions = options ?? childOptions;
    const selectedOption =
      resolvedOptions.find((option) => option.value === value) ?? EMPTY_OPTION;
    const selectedLabel = selectedOption.label || placeholder;

    React.useEffect(() => {
      function closeOnOutside(event: MouseEvent) {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
        }
      }

      function closeOnEscape(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }

      document.addEventListener("mousedown", closeOnOutside);
      document.addEventListener("keydown", closeOnEscape);

      return () => {
        document.removeEventListener("mousedown", closeOnOutside);
        document.removeEventListener("keydown", closeOnEscape);
      };
    }, []);

    return (
      <div className={cn("relative", containerClassName)} ref={rootRef}>
        {name ? <input name={name} type="hidden" value={value} /> : null}
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-right text-sm ring-offset-background transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !selectedOption.label && "text-muted-foreground",
            className,
            triggerClassName,
          )}
          disabled={disabled}
          id={id}
          ref={ref}
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open ? (
          <div
            className={cn(
              "absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-auto rounded-md border border-border bg-card p-1 text-card-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/10",
              contentClassName,
            )}
            role="listbox"
          >
            {resolvedOptions.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-right text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
                    selected && "bg-accent text-accent-foreground",
                  )}
                  disabled={option.disabled}
                  key={`${option.value}-${option.label}`}
                  role="option"
                  type="button"
                  onClick={() => {
                    onValueChange?.(option.value);
                    onChange?.({ target: { value: option.value } });
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {selected ? <Check className="size-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
