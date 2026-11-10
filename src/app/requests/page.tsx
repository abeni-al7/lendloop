"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/components/convex-client-provider";
import { LoanRow, LoanSection } from "@/components/loan-list";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState, PageHeading } from "@/components/ui";

export default function MyRequestsPage() {
  const { isLoading, isSignedIn } = useSession();
  const loans = useQuery(api.loans.myRequests, isSignedIn ? {} : "skip");
  const withdraw = useMutation(api.loans.withdraw);

  if (!isLoading && !isSignedIn) return <SignInPrompt what="see your requests" />;

  const waiting = loans?.filter((l) => l.status === "requested") ?? [];
  const borrowing = loans?.filter((l) => l.status === "approved") ?? [];
  const past = loans?.filter((l) => l.status === "declined" || l.status === "returned") ?? [];

  return (
    <div className="px-4 pt-8 pb-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeading title="My requests" lead="Tools you asked to borrow, and what happened next." />
        {loans === undefined ? (
          <div className="mt-10 h-40 rounded-lg border-2 border-dashed border-board-line" aria-busy="true" />
        ) : loans.length === 0 ? (
          <div className="mt-10">
            <EmptyState title="You haven't asked for anything yet.">
              <Link href="/" className="text-paint underline">
                Find a tool on the board
              </Link>
            </EmptyState>
          </div>
        ) : (
          <>
            <LoanSection title="Borrowing" loans={borrowing}>
              {(loan) => (
                <LoanRow
                  key={loan._id}
                  loan={loan}
                  who={`From ${loan.owner.firstName}. ${loan.owner.firstName} marks it returned when it's back.`}
                />
              )}
            </LoanSection>
            <LoanSection title="Waiting for an answer" loans={waiting}>
              {(loan) => (
                <LoanRow
                  key={loan._id}
                  loan={loan}
                  who={`Asked ${loan.owner.firstName}`}
                  actions={[{ label: "Withdraw", variant: "outline", run: () => withdraw({ loanId: loan._id }) }]}
                />
              )}
            </LoanSection>
            <LoanSection title="Past" loans={past}>
              {(loan) => <LoanRow key={loan._id} loan={loan} who={`From ${loan.owner.firstName}`} />}
            </LoanSection>
          </>
        )}
      </div>
    </div>
  );
}
