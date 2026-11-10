"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import clsx from "clsx";
import { ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSession } from "@/components/convex-client-provider";
import { LoanRow } from "@/components/loan-list";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ToolIcon } from "@/components/tool-icon";
import { Button, EmptyState, PageHeading } from "@/components/ui";
import { categoryLabel, errorMessage, timeAgo, toolRef } from "@/lib/format";

const TABS = [
  { id: "loans", label: "All loans" },
  { id: "listings", label: "Listings" },
  { id: "neighbors", label: "Neighbors" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const { isLoading, isSignedIn } = useSession();
  const me = useQuery(api.users.me, isSignedIn ? {} : "skip");
  const [tab, setTab] = useState<Tab>("loans");

  if (!isLoading && !isSignedIn) return <SignInPrompt what="open the admin page" />;
  if (me && me.role !== "admin") {
    return (
      <div className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-xl rounded-lg bg-board-raised p-8">
          <h1 className="display text-3xl font-extrabold">Admins only</h1>
          <p className="mt-2 text-on-board-soft">This page is for the people who look after the board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-8 pb-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeading title="Admin" lead="See every loan, remove any listing, and mark trusted lenders." />
        <AutomationFailures enabled={me?.role === "admin"} />
        <div role="tablist" aria-label="Admin sections" className="mt-8 flex gap-1 border-b border-board-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={clsx(
                "relative h-12 px-4 font-semibold transition-colors",
                tab === t.id ? "text-paint" : "text-on-board-soft hover:text-on-board",
              )}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-4 bottom-0 h-[3px] bg-paint" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
          {me?.role === "admin" &&
            (tab === "loans" ? <AllLoans /> : tab === "listings" ? <AllListings /> : <Neighbors />)}
        </div>
      </div>
    </div>
  );
}

function AutomationFailures({ enabled }: { enabled: boolean }) {
  const failures = useQuery(api.loans.automationFailures, enabled ? {} : "skip");
  if (!failures?.length) return null;
  return (
    <div role="status" className="mt-6 rounded-lg border-2 border-rust p-4">
      <p className="font-semibold text-rust">
        {failures.length} automation run{failures.length > 1 ? "s" : ""} failed. Latest {timeAgo(failures[0].at)}:{" "}
        {failures[0].detail ?? "no detail"}
      </p>
    </div>
  );
}

function AllLoans() {
  const loans = useQuery(api.loans.all);
  if (loans === undefined) return <Skeleton />;
  if (loans.length === 0) return <EmptyState title="No loans yet." />;
  const overdue = loans.filter((l) => l.overdue).length;
  return (
    <>
      <p className="mb-3 text-on-board-soft">
        {loans.length} loans. {overdue ? `${overdue} overdue.` : "None overdue."}
      </p>
      <ul className="enamel overflow-hidden rounded-lg">
        {loans.map((loan) => (
          <LoanRow key={loan._id} loan={loan} who={`${loan.borrower.firstName} borrows from ${loan.owner.firstName}`} />
        ))}
      </ul>
    </>
  );
}

function AllListings() {
  const tools = useQuery(api.tools.list, {});
  const remove = useMutation(api.tools.remove);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  if (tools === undefined) return <Skeleton />;
  return (
    <>
      {error && (
        <p role="alert" className="mb-3 font-semibold text-rust">
          {error}
        </p>
      )}
      <ul className="enamel overflow-hidden rounded-lg">
        {tools.map((tool) => (
          <li key={tool._id} className="flex flex-wrap items-center gap-4 border-b border-enamel-line px-4 py-3 last:border-b-0 sm:px-6">
            <ToolIcon category={tool.category} className="h-9 w-9 text-ink" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {tool.name} <span className="ml-1 text-sm font-semibold text-ink-soft">{toolRef(tool.ref)}</span>
              </p>
              <p className="text-sm text-ink-soft">
                {categoryLabel(tool.category)}, listed by {tool.isMine ? "you" : tool.owner.firstName}
              </p>
            </div>
            {pending === tool._id ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    setError(null);
                    try {
                      await remove({ toolId: tool._id as Id<"tools"> });
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                    setPending(null);
                  }}
                >
                  Yes, remove {toolRef(tool.ref)}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPending(null)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setPending(tool._id)} aria-label={`Remove ${tool.name}`}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Neighbors() {
  const users = useQuery(api.users.list);
  const setTrusted = useMutation(api.users.setTrustedLender);
  const [error, setError] = useState<string | null>(null);
  if (users === undefined) return <Skeleton />;
  return (
    <>
      {error && (
        <p role="alert" className="mb-3 font-semibold text-rust">
          {error}
        </p>
      )}
      <ul className="enamel overflow-hidden rounded-lg">
        {users.map((u) => (
          <li key={u._id} className="flex flex-wrap items-center gap-4 border-b border-enamel-line px-4 py-3 last:border-b-0 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-bold">
                {u.firstName}
                {u.role === "admin" && <span className="rounded bg-board px-1.5 text-xs text-on-board">Admin</span>}
                {u.trustedLender && <ShieldCheck className="h-4 w-4 text-leaf" aria-label="Trusted lender" />}
              </p>
              <p className="text-sm text-ink-soft">
                {u.toolCount} tool{u.toolCount === 1 ? "" : "s"} listed, {u.returnedCount} loan
                {u.returnedCount === 1 ? "" : "s"} completed
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold">
              Trusted lender
              <input
                type="checkbox"
                role="switch"
                checked={u.trustedLender}
                onChange={async (e) => {
                  setError(null);
                  try {
                    await setTrusted({ userId: u._id, trusted: e.target.checked });
                  } catch (err) {
                    setError(errorMessage(err));
                  }
                }}
                className="h-5 w-5 accent-[#2f7d4a]"
              />
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function Skeleton() {
  return <div className="h-40 rounded-lg border-2 border-dashed border-board-line" aria-busy="true" />;
}

