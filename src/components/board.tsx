"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { CATEGORIES, categoryLabel, formatDay, toolRef, type Category } from "@/lib/format";
import { useSession } from "./convex-client-provider";
import { ToolIcon } from "./tool-icon";

type SignedInTool = FunctionReturnType<typeof api.tools.list>[number];
type PublicTool = FunctionReturnType<typeof api.tools.listPublic>[number];

export function Board() {
  const { isLoading, isSignedIn } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("category");
  const active = CATEGORIES.some((c) => c.id === raw) ? (raw as Category) : null;

  const publicTools = useQuery(api.tools.listPublic, !isLoading && !isSignedIn ? {} : "skip");
  const tools = useQuery(api.tools.list, isSignedIn ? {} : "skip");
  const all: (SignedInTool | PublicTool)[] | undefined = isSignedIn ? tools : publicTools;
  const shown = all?.filter((t) => !active || t.category === active);

  const setCategory = (id: Category | null) => {
    router.replace(id ? `/?category=${id}` : "/", { scroll: false });
  };

  const homeCount = tools?.filter((t) => !t.out).length;

  return (
    <div className="pegboard min-h-full px-4 pt-8 pb-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="max-w-2xl">
            <h1 className="display text-4xl font-extrabold text-on-board sm:text-5xl">The board</h1>
            <p className="mt-2 text-lg text-on-board-soft">
              {all === undefined
                ? "Loading the tools on Elm Street…"
                : isSignedIn
                  ? `${homeCount} of ${all.length} tools are home right now. Pick one to see free dates.`
                  : `${all.length} tools shared on Elm Street. Sign in to borrow one or lend your own.`}
            </p>
          </div>
          {isSignedIn && (
            <Link
              href="/listings#new"
              className="ml-auto inline-flex h-11 items-center rounded-md bg-paint px-5 font-semibold text-paint-ink transition-colors hover:bg-[#ffd451]"
            >
              List a tool
            </Link>
          )}
        </div>

        <div role="group" aria-label="Filter by category" className="mt-8 flex flex-wrap gap-2">
          <FilterButton pressed={!active} onClick={() => setCategory(null)} label="All" count={all?.length} />
          {CATEGORIES.map((c) => (
            <FilterButton
              key={c.id}
              pressed={active === c.id}
              onClick={() => setCategory(c.id)}
              label={c.label}
              count={all?.filter((t) => t.category === c.id).length}
            />
          ))}
        </div>

        {isSignedIn && <Legend />}

        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-3 sm:gap-4">
          {shown === undefined
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="h-48 rounded-lg border-2 border-dashed border-board-line" aria-hidden="true" />
              ))
            : shown.map((tool) =>
                "owner" in tool ? <Plate key={tool._id} tool={tool} /> : <PublicPlate key={tool._id} tool={tool} />,
              )}
        </ul>

        {shown?.length === 0 && (
          <div className="mt-2 rounded-lg border-2 border-dashed border-board-line p-8 text-center">
            <p className="text-lg font-semibold">
              {active ? `No ${categoryLabel(active).toLowerCase()} on the board yet.` : "The board is empty."}
            </p>
            {isSignedIn ? (
              <Link href="/listings#new" className="mt-2 inline-block text-paint underline">
                List the first one
              </Link>
            ) : (
              <p className="mt-1 text-on-board-soft">Sign in to list the first one.</p>
            )}
          </div>
        )}

        {!isLoading && !isSignedIn && all && all.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-4 rounded-lg bg-board-raised p-6">
            <p className="max-w-xl text-on-board">
              Signed-in neighbors see who owns each tool, which ones are home, and can ask to borrow for a few days.
            </p>
            <SignInButton mode="modal">
              <button className="ml-auto h-11 rounded-md bg-paint px-5 font-semibold text-paint-ink hover:bg-[#ffd451]">
                Sign in to lend or borrow
              </button>
            </SignInButton>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton(props: { pressed: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={clsx(
        "h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
        props.pressed
          ? "border-paint bg-paint text-paint-ink"
          : "border-board-line bg-board text-on-board hover:border-on-board-soft",
      )}
    >
      {props.label}
      {props.count !== undefined && (
        <span className={clsx("ml-1.5", props.pressed ? "text-paint-ink/70" : "text-on-board-soft")}>
          {props.count}
        </span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-board-soft">
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-6 rounded-sm bg-enamel" aria-hidden="true" /> Home, ready to borrow
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-6 rounded-sm border-2 border-dashed border-paint" aria-hidden="true" /> Out on loan
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-6 rounded-sm border-2 border-dashed border-rust" aria-hidden="true" /> Late (only the two neighbors
        and admins see this)
      </span>
    </p>
  );
}

function PublicPlate({ tool }: { tool: PublicTool }) {
  return (
    <li className="enamel flex min-h-48 flex-col rounded-lg p-4">
      <ToolIcon category={tool.category} className="h-16 w-16 text-ink" />
      <div className="mt-auto">
        <p className="text-lg leading-tight font-bold">{tool.name}</p>
        <p className="mt-1 text-sm text-ink-soft">{categoryLabel(tool.category)}</p>
      </div>
    </li>
  );
}

function Plate({ tool }: { tool: SignedInTool }) {
  const out = tool.out;
  const late = out?.overdue;
  return (
    <li>
      <Link
        href={`/tools/${tool._id}`}
        className={clsx(
          "group flex h-full min-h-48 flex-col rounded-lg p-4 transition-[transform,background-color] duration-200 ease-out-quart hover:-translate-y-0.5",
          out
            ? clsx("border-2 border-dashed bg-board/60", late ? "border-rust" : "border-paint")
            : "enamel hover:bg-white",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <ToolIcon
            category={tool.category}
            className={clsx("h-16 w-16", out ? (late ? "text-rust" : "text-paint") : "text-ink")}
          />
          <span className={clsx("text-xs font-semibold", out ? "text-on-board-soft" : "text-ink-soft")}>
            {toolRef(tool.ref)}
          </span>
        </div>
        <div className="mt-auto">
          <p className={clsx("text-lg leading-tight font-bold", out && "text-on-board")}>{tool.name}</p>
          <p className={clsx("mt-1 flex items-center gap-1 text-sm", out ? "text-on-board-soft" : "text-ink-soft")}>
            {tool.isMine ? "Yours" : tool.owner.firstName}
            {tool.owner.trustedLender && !tool.isMine && (
              <ShieldCheck className="h-4 w-4 text-leaf" aria-label="Trusted lender" />
            )}
          </p>
          <p
            className={clsx(
              "mt-2 text-sm font-semibold",
              late ? "text-rust" : out ? "text-paint" : tool.myOpenRequest ? "text-ink" : "text-leaf",
            )}
          >
            {late
              ? `Late, was due ${formatDay(out.until!)}`
              : out
                ? out.until
                  ? `Out until ${formatDay(out.until)}`
                  : "Out on loan"
                : tool.isMine && tool.pendingCount
                  ? `${tool.pendingCount} request${tool.pendingCount > 1 ? "s" : ""} waiting`
                  : tool.myOpenRequest?.status === "requested"
                    ? "You asked to borrow it"
                    : tool.myOpenRequest?.status === "approved"
                      ? "Booked for you"
                      : "Home"}
          </p>
        </div>
      </Link>
    </li>
  );
}
