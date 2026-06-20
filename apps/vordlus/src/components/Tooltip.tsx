"use client";

import { useState, useId, type ReactNode } from "react";

type Props = {
  text: string;
  children: ReactNode;
};

export function Tooltip({ text, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        className="cursor-help text-muted hover:text-ink outline-none"
      >
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute z-50 left-full ml-2 top-1/2 -translate-y-1/2 w-[260px] bg-paper border border-rule text-[11.5px] text-ink leading-snug px-3 py-2 shadow-sm"
        >
          {text}
        </span>
      )}
    </span>
  );
}
