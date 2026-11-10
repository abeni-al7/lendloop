"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSession } from "@/components/convex-client-provider";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ToolIcon } from "@/components/tool-icon";
import { Button, EmptyState, PageHeading } from "@/components/ui";
import { CATEGORIES, categoryLabel, errorMessage, formatDay, toolRef, type Category } from "@/lib/format";

export default function MyListingsPage() {
  const { isLoading, isSignedIn } = useSession();
  const tools = useQuery(api.tools.mine, isSignedIn ? {} : "skip");

  if (!isLoading && !isSignedIn) return <SignInPrompt what="list your tools" />;

  return (
    <div className="px-4 pt-8 pb-16 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <PageHeading title="My listings" lead="Tools you lend to the street." />
          <div className="mt-8">
            {tools === undefined ? (
              <div className="h-40 rounded-lg border-2 border-dashed border-board-line" aria-busy="true" />
            ) : tools.length === 0 ? (
              <EmptyState title="You haven't listed a tool yet.">Add your first one with the form.</EmptyState>
            ) : (
              <ul className="enamel overflow-hidden rounded-lg">
                {tools.map((tool) => (
                  <ListingRow key={tool._id} tool={tool} />
                ))}
              </ul>
            )}
          </div>
        </div>
        <NewToolForm />
      </div>
    </div>
  );
}

type Mine = FunctionReturnType<typeof api.tools.mine>[number];

function ListingRow({ tool }: { tool: Mine }) {
  const remove = useMutation(api.tools.remove);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-enamel-line px-4 py-4 last:border-b-0 sm:px-6">
      <ToolIcon category={tool.category} className={clsx("h-10 w-10", tool.out ? "text-rust-ink" : "text-ink")} />
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-tight font-bold">
          <Link href={`/tools/${tool._id}`} className="hover:underline">
            {tool.name}
          </Link>
          <span className="ml-2 text-sm font-semibold text-ink-soft">{toolRef(tool.ref)}</span>
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          {categoryLabel(tool.category)}, lent {tool.timesLent} time{tool.timesLent === 1 ? "" : "s"}
        </p>
      </div>
      <p className={clsx("text-sm font-semibold", tool.out?.overdue ? "text-rust-ink" : "text-ink")}>
        {tool.out
          ? tool.out.overdue
            ? `Late: ${tool.out.borrowerFirstName} had it until ${formatDay(tool.out.until)}`
            : `With ${tool.out.borrowerFirstName} until ${formatDay(tool.out.until)}`
          : "Home"}
        {tool.pendingCount > 0 && (
          <Link href="/incoming" className="ml-3 rounded-full bg-paint px-2.5 py-1 text-paint-ink">
            {tool.pendingCount} waiting
          </Link>
        )}
      </p>
      <div className="flex gap-2">
        {confirming ? (
          <>
            <Button
              size="sm"
              variant="danger"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await remove({ toolId: tool._id as Id<"tools"> });
                } catch (e) {
                  setError(errorMessage(e));
                  setBusy(false);
                  setConfirming(false);
                }
              }}
            >
              Yes, remove it
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)} aria-label={`Remove ${tool.name}`}>
            Remove
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="w-full text-sm font-semibold text-rust-ink">
          {error}
        </p>
      )}
    </li>
  );
}

function NewToolForm() {
  const create = useMutation(api.tools.create);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("power");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Give the tool a name, at least 2 letters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await create({ name, category, note: note || undefined });
      setAdded(name.trim());
      setName("");
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="new" onSubmit={submit} noValidate className="enamel h-fit scroll-mt-6 rounded-lg p-6 lg:sticky lg:top-6">
      <h2 className="text-2xl font-bold">List a tool</h2>
      <p className="mt-1 text-ink-soft">Neighbors see the name, the category and your first name.</p>
      <label className="mt-5 block">
        <span className="text-sm font-semibold">Name</span>
        <input
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cordless drill, 18 V"
          aria-invalid={!!error}
          className="mt-1 h-11 w-full rounded-md border border-enamel-line bg-white px-3 placeholder:text-ink-soft"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-semibold">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="mt-1 h-11 w-full rounded-md border border-enamel-line bg-white px-3"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-semibold">Note (optional)</span>
        <textarea
          value={note}
          maxLength={200}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Two batteries, charger in the case"
          className="mt-1 w-full rounded-md border border-enamel-line bg-white px-3 py-2 placeholder:text-ink-soft"
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-rust-ink">
          {error}
        </p>
      )}
      <p aria-live="polite" className="mt-3 text-sm font-semibold text-leaf">
        {added && !error ? `${added} is on the board.` : ""}
      </p>
      <Button type="submit" busy={busy} className="mt-2 w-full">
        Put it on the board
      </Button>
    </form>
  );
}
