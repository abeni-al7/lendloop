"use client";

import clsx from "clsx";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "paint" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-board text-on-board hover:bg-board-raised",
  paint: "bg-paint text-paint-ink hover:bg-[#ffd451]",
  outline: "border border-ink text-ink hover:bg-enamel-2",
  danger: "border border-rust-ink text-rust-ink hover:bg-rust-ink hover:text-white",
};

export function Button({
  variant = "primary",
  busy = false,
  size = "md",
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        size === "md" ? "h-11 px-5" : "h-9 px-3 text-sm",
        VARIANTS[variant],
        className,
      )}
    >
      {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function PageHeading({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
      <div className="max-w-2xl">
        <h1 className="display text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {lead && <p className="mt-2 text-lg text-on-board-soft">{lead}</p>}
      </div>
      {children && <div className="ml-auto">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-board-line p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-on-board-soft">{children}</div>}
    </div>
  );
}
