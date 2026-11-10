"use client";

import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { dayCount, errorMessage, formatDay, formatRange, timeAgo, todayUTC, toolRef } from "@/lib/format";
import { ToolIcon } from "./tool-icon";
import { Button } from "./ui";

export type Loan = FunctionReturnType<typeof api.loans.myRequests>[number];

export function StatusChip({ loan }: { loan: Loan }) {
  if (loan.overdue) {
    const late = dayCount(loan.endDate, todayUTC()) - 1;
    return <Chip className="bg-rust-ink text-white">Overdue {late} day{late === 1 ? "" : "s"}</Chip>;
  }
  switch (loan.status) {
    case "requested":
      return <Chip className="bg-paint text-paint-ink">Waiting for answer</Chip>;
    case "approved":
      return <Chip className="bg-leaf text-white">{loan.startDate > todayUTC() ? "Approved" : "Out now"}</Chip>;
    case "declined":
      return <Chip className="border border-ink-soft text-ink-soft">Declined</Chip>;
    case "returned":
      return <Chip className="border border-ink-soft text-ink-soft">Returned</Chip>;
  }
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-flex h-7 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

const EVENT_TEXT: Record<Loan["events"][number]["kind"], (loan: Loan) => string> = {
  owner_notified: (l) => `${l.owner.firstName} got a notice`,
  borrower_notified: (l) => `${l.borrower.firstName} got a notice`,
  reminder_sent: (l) => `Reminder sent to ${l.borrower.firstName}`,
  notify_failed: () => "Notice could not be sent",
  workflow_failed: () => "Automation failed",
};

/** What the automations did on this loan, newest first. */
function Activity({ loan }: { loan: Loan }) {
  if (loan.events.length === 0) return null;
  const [latest, ...rest] = loan.events;
  const failed = latest.kind === "notify_failed" || latest.kind === "workflow_failed";
  return (
    <details className="group mt-2 text-sm">
      <summary
        className={clsx(
          "inline-flex cursor-pointer list-none items-center gap-2 rounded",
          failed ? "font-semibold text-rust-ink" : "text-ink-soft",
          rest.length === 0 && "pointer-events-none",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {EVENT_TEXT[latest.kind](loan)} <time dateTime={new Date(latest.at).toISOString()}>{timeAgo(latest.at)}</time>
        {rest.length > 0 && <span className="underline">+{rest.length} more</span>}
      </summary>
      {rest.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-3.5 text-ink-soft">
          {rest.map((e) => (
            <li key={e._id}>
              {EVENT_TEXT[e.kind](loan)} {timeAgo(e.at)}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export type Action = {
  label: string;
  variant?: "primary" | "outline" | "danger" | "paint";
  run: () => Promise<unknown>;
};

export function LoanRow({ loan, who, actions = [] }: { loan: Loan; who: string; actions?: Action[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const days = dayCount(loan.startDate, loan.endDate);

  return (
    <li className="grid gap-x-6 gap-y-3 border-b border-enamel-line px-4 py-4 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-start sm:px-6">
      {loan.tool && <ToolIcon category={loan.tool.category} className="hidden h-12 w-12 text-ink sm:block" />}
      <div className="min-w-0">
        <p className="text-lg leading-tight font-bold">
          {loan.tool ? (
            loan.tool.removed ? (
              loan.tool.name
            ) : (
              <Link href={`/tools/${loan.tool._id}`} className="hover:underline">
                {loan.tool.name}
              </Link>
            )
          ) : (
            "Removed tool"
          )}
          {loan.tool && <span className="ml-2 text-sm font-semibold text-ink-soft">{toolRef(loan.tool.ref)}</span>}
        </p>
        <p className="mt-0.5 text-ink-soft">{who}</p>
        {loan.message && <p className="mt-2 max-w-prose border-l-2 border-enamel-line pl-3 text-[15px]">“{loan.message}”</p>}
        <Activity loan={loan} />
      </div>
      <div>
        <p className="font-semibold">{formatRange(loan.startDate, loan.endDate)}</p>
        <p className="text-sm text-ink-soft">
          {days} day{days === 1 ? "" : "s"}
          {loan.status === "returned" && loan.returnedAt ? `, back ${timeAgo(loan.returnedAt)}` : ""}
          {loan.overdue ? `, due ${formatDay(loan.endDate)}` : ""}
        </p>
        <div className="mt-2">
          <StatusChip loan={loan} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {actions.map((a) => (
          <Button
            key={a.label}
            size="sm"
            variant={a.variant}
            busy={busy === a.label}
            disabled={busy !== null}
            onClick={async () => {
              setBusy(a.label);
              setError(null);
              try {
                await a.run();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            {a.label}
          </Button>
        ))}
        {error && (
          <p role="alert" className="w-full text-sm font-semibold text-rust-ink sm:text-right">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

export function LoanSection({ title, loans, empty, children }: { title: string; loans: Loan[]; empty?: string; children: (loan: Loan) => React.ReactNode }) {
  if (loans.length === 0 && !empty) return null;
  return (
    <section className="mt-10" aria-labelledby={`s-${title}`}>
      <h2 id={`s-${title}`} className="text-xl font-bold">
        {title} <span className="font-semibold text-on-board-soft">{loans.length}</span>
      </h2>
      {loans.length === 0 ? (
        <p className="mt-3 text-on-board-soft">{empty}</p>
      ) : (
        <ul className="enamel mt-3 overflow-hidden rounded-lg">{loans.map(children)}</ul>
      )}
    </section>
  );
}
