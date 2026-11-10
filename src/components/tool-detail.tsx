"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  addDays,
  categoryLabel,
  dayCount,
  errorMessage,
  formatDay,
  formatRange,
  todayUTC,
  toolRef,
} from "@/lib/format";
import { useSession } from "./convex-client-provider";
import { SignInPrompt } from "./sign-in-prompt";
import { ToolIcon } from "./tool-icon";
import { Button } from "./ui";

export function ToolDetail() {
  const { id } = useParams<{ id: string }>();
  const { isLoading, isSignedIn } = useSession();
  const tool = useQuery(api.tools.get, isSignedIn ? { toolId: id } : "skip");

  if (!isLoading && !isSignedIn) return <SignInPrompt what="see this tool and ask to borrow it" />;

  return (
    <div className="pegboard min-h-full px-4 pt-6 pb-16 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-on-board-soft hover:text-on-board">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the board
        </Link>

        {tool === undefined ? (
          <div className="mt-6 h-80 rounded-lg border-2 border-dashed border-board-line" aria-busy="true" />
        ) : tool === null ? (
          <div className="mt-6 rounded-lg bg-board-raised p-8">
            <h1 className="display text-3xl font-extrabold">This tool is no longer on the board</h1>
            <p className="mt-2 text-on-board-soft">The owner or an admin removed it.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.1fr]">
            <section
              aria-labelledby="tool-name"
              className={clsx(
                "flex flex-col rounded-lg p-6",
                tool.out
                  ? clsx("border-2 border-dashed", tool.out.overdue ? "border-rust" : "border-paint")
                  : "enamel",
              )}
            >
              <div className="flex items-start justify-between">
                <ToolIcon
                  category={tool.category}
                  className={clsx(
                    "h-32 w-32",
                    tool.out ? (tool.out.overdue ? "text-rust" : "text-paint") : "text-ink",
                  )}
                />
                <span className={clsx("text-sm font-semibold", tool.out ? "text-on-board-soft" : "text-ink-soft")}>
                  {toolRef(tool.ref)}
                </span>
              </div>
              <h1 id="tool-name" className="display mt-6 text-4xl leading-none font-extrabold">
                {tool.name}
              </h1>
              <dl className={clsx("mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2", tool.out ? "text-on-board" : "")}>
                <dt className={tool.out ? "text-on-board-soft" : "text-ink-soft"}>Category</dt>
                <dd>{categoryLabel(tool.category)}</dd>
                <dt className={tool.out ? "text-on-board-soft" : "text-ink-soft"}>Owner</dt>
                <dd className="flex items-center gap-1.5">
                  {tool.isMine ? "You" : tool.owner.firstName}
                  {tool.owner.trustedLender && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-leaf">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Trusted lender
                    </span>
                  )}
                </dd>
                <dt className={tool.out ? "text-on-board-soft" : "text-ink-soft"}>Now</dt>
                <dd className="font-semibold">
                  {tool.out
                    ? tool.out.overdue
                      ? `Late, was due ${formatDay(tool.out.until!)}`
                      : tool.out.until
                      ? `Out until ${formatDay(tool.out.until)}`
                      : "Out on loan"
                    : "Home"}
                </dd>
              </dl>
              {tool.note && (
                <p className={clsx("mt-5 max-w-prose", tool.out ? "text-on-board-soft" : "text-ink-soft")}>
                  {tool.note}
                </p>
              )}
            </section>

            <section aria-labelledby="borrow-title" className="enamel rounded-lg p-6">
              {tool.isMine ? (
                <OwnerPanel pendingCount={tool.pendingCount} />
              ) : tool.myOpenRequest ? (
                <OpenRequestPanel request={tool.myOpenRequest} ownerName={tool.owner.firstName} />
              ) : (
                <RequestForm toolId={tool._id} ownerName={tool.owner.firstName} booked={tool.booked} />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function OwnerPanel({ pendingCount }: { pendingCount: number }) {
  return (
    <>
      <h2 id="borrow-title" className="text-2xl font-bold">
        This is your tool
      </h2>
      <p className="mt-2 text-ink-soft">
        {pendingCount
          ? `${pendingCount} neighbor${pendingCount > 1 ? "s want" : " wants"} to borrow it.`
          : "Nobody has asked for it yet."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/incoming" className="inline-flex h-11 items-center rounded-md bg-board px-5 font-semibold text-on-board hover:bg-board-raised">
          Answer requests
        </Link>
        <Link href="/listings" className="inline-flex h-11 items-center rounded-md border border-ink px-5 font-semibold hover:bg-enamel-2">
          Manage my listings
        </Link>
      </div>
    </>
  );
}

function OpenRequestPanel({
  request,
  ownerName,
}: {
  request: { loanId: Id<"loans">; status: string; startDate: string; endDate: string };
  ownerName: string;
}) {
  const withdraw = useMutation(api.loans.withdraw);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approved = request.status === "approved";
  return (
    <>
      <h2 id="borrow-title" className="text-2xl font-bold">
        {approved ? "It's booked for you" : `Waiting for ${ownerName}`}
      </h2>
      <p className="mt-2 text-ink-soft">
        {approved
          ? `${ownerName} said yes for ${formatRange(request.startDate, request.endDate)}. Bring it back by the last day.`
          : `You asked for ${formatRange(request.startDate, request.endDate)}. ${ownerName} gets a notice and answers here.`}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/requests" className="inline-flex h-11 items-center rounded-md bg-board px-5 font-semibold text-on-board hover:bg-board-raised">
          See my requests
        </Link>
        {!approved && (
          <Button
            variant="outline"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await withdraw({ loanId: request.loanId });
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Withdraw request
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-rust-ink">
          {error}
        </p>
      )}
    </>
  );
}

function RequestForm({
  toolId,
  ownerName,
  booked,
}: {
  toolId: Id<"tools">;
  ownerName: string;
  booked: { start: string; end: string }[];
}) {
  const request = useMutation(api.loans.request);
  const today = todayUTC();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clash = booked.find((b) => start <= b.end && b.start <= end);
  const days = end >= start ? dayCount(start, end) : 0;
  const localError =
    end < start ? "The end date is before the start date." : days > 30 ? "A loan can be 30 days at most." : clash ? `Already booked ${formatRange(clash.start, clash.end)}.` : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (localError) return;
    setBusy(true);
    setError(null);
    try {
      await request({ toolId, startDate: start, endDate: end, message: message || undefined });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2 id="borrow-title" className="text-2xl font-bold">
        Ask {ownerName} to borrow it
      </h2>
      <p className="mt-1 text-ink-soft">Pick the days you need it. Up to 30 days.</p>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-semibold">From</span>
          <input
            type="date"
            required
            value={start}
            min={today}
            max={addDays(today, 90)}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-enamel-line bg-white px-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">To (last day)</span>
          <input
            type="date"
            required
            value={end}
            min={start}
            max={addDays(start || today, 29)}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={!!localError}
            aria-describedby="date-help"
            className="mt-1 h-11 w-full rounded-md border border-enamel-line bg-white px-3 aria-invalid:border-rust-ink"
          />
        </label>
      </div>
      <p id="date-help" className={clsx("mt-2 text-sm", localError ? "font-semibold text-rust-ink" : "text-ink-soft")}>
        {localError ?? `${days} day${days === 1 ? "" : "s"}, ${formatRange(start, end)}.`}
      </p>

      {booked.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="font-semibold">Already booked</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {booked.map((b) => (
              <li key={b.start} className="rounded border border-dashed border-ink-soft px-2 py-0.5 text-ink-soft">
                {formatRange(b.start, b.end)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="mt-5 block">
        <span className="text-sm font-semibold">Message to {ownerName} (optional)</span>
        <textarea
          value={message}
          maxLength={280}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. For the front hedge. I can pick it up Saturday morning."
          className="mt-1 w-full rounded-md border border-enamel-line bg-white px-3 py-2 placeholder:text-ink-soft"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 font-semibold text-rust-ink">
          {error}
        </p>
      )}
      <Button type="submit" busy={busy} disabled={!!localError} className="mt-5 w-full sm:w-auto">
        Ask to borrow
      </Button>
    </form>
  );
}
