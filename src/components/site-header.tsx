"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import clsx from "clsx";
import { api } from "../../convex/_generated/api";
import { useSession } from "./convex-client-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const { isLoading, isSignedIn } = useSession();
  const me = useQuery(api.users.me, isSignedIn ? {} : "skip");
  const counts = useQuery(api.loans.counts, isSignedIn ? {} : "skip");

  const links = [
    { href: "/", label: "Board" },
    ...(isSignedIn
      ? [
          { href: "/listings", label: "My listings" },
          { href: "/requests", label: "My requests", badge: counts?.myOverdue, late: true },
          { href: "/incoming", label: "Incoming", badge: counts?.incomingPending },
          ...(me?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
        ]
      : []),
  ];

  return (
    <header className="border-b border-board-line bg-board">
      <div className="flex h-16 items-center gap-6 px-4 sm:px-8">
        <Link href="/" className="display text-2xl font-extrabold text-paint">
          LendLoop
        </Link>
        <nav aria-label="Main" className="hidden flex-1 md:block">
          <NavLinks links={links} pathname={pathname} />
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {isLoading ? (
            <span className="h-9 w-9 rounded-full bg-board-raised" aria-hidden="true" />
          ) : isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="h-10 rounded-md bg-paint px-4 font-semibold text-paint-ink transition-colors hover:bg-[#ffd451]">
                Sign in to lend or borrow
              </button>
            </SignInButton>
          )}
        </div>
      </div>
      {links.length > 1 && (
        <nav aria-label="Main" className="overflow-x-auto border-t border-board-line px-4 md:hidden">
          <NavLinks links={links} pathname={pathname} />
        </nav>
      )}
    </header>
  );
}

type NavLink = { href: string; label: string; badge?: number; late?: boolean };

function NavLinks({ links, pathname }: { links: NavLink[]; pathname: string }) {
  return (
    <ul className="flex gap-1 whitespace-nowrap">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/tools") : pathname.startsWith(link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex h-12 items-center gap-2 px-3 text-[15px] font-semibold transition-colors md:h-16",
                active ? "text-paint" : "text-on-board-soft hover:text-on-board",
              )}
            >
              {link.label}
              {!!link.badge && (
                <span
                  className={clsx(
                    "min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-bold",
                    link.late ? "bg-rust text-paint-ink" : "bg-paint text-paint-ink",
                  )}
                >
                  {link.badge}
                  <span className="sr-only">{link.late ? " overdue" : " waiting"}</span>
                </span>
              )}
              {active && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-paint" aria-hidden="true" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
