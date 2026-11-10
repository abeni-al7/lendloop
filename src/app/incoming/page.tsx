"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/components/convex-client-provider";
import { LoanRow, LoanSection } from "@/components/loan-list";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState, PageHeading } from "@/components/ui";

export default function IncomingPage() {
  const { isLoading, isSignedIn } = useSession();
  const loans = useQuery(api.loans.incoming, isSignedIn ? {} : "skip");
  const decide = useMutation(api.loans.decide);
  const markReturned = useMutation(api.loans.markReturned);

  if (!isLoading && !isSignedIn) return <SignInPrompt what="answer requests for your tools" />;

  const waiting = loans?.filter((l) => l.status === "requested") ?? [];
  const out = loans?.filter((l) => l.status === "approved") ?? [];
  const past = loans?.filter((l) => l.status === "declined" || l.status === "returned") ?? [];

  return (
    <div className="px-4 pt-8 pb-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeading title="Incoming" lead="Neighbors who want to borrow your tools." />
        {loans === undefined ? (
          <div className="mt-10 h-40 rounded-lg border-2 border-dashed border-board-line" aria-busy="true" />
        ) : loans.length === 0 ? (
          <div className="mt-10">
            <EmptyState title="No requests yet.">
              <Link href="/listings#new" className="text-paint underline">
                List a tool
              </Link>{" "}
              so neighbors can ask for it.
            </EmptyState>
          </div>
        ) : (
          <>
            <LoanSection title="Needs your answer" loans={waiting} empty="Nothing to answer right now.">
              {(loan) => (
                <LoanRow
                  key={loan._id}
                  loan={loan}
                  who={`${loan.borrower.firstName} wants to borrow it`}
                  actions={[
                    { label: "Approve", variant: "primary", run: () => decide({ loanId: loan._id, decision: "approved" }) },
                    { label: "Decline", variant: "outline", run: () => decide({ loanId: loan._id, decision: "declined" }) },
                  ]}
                />
              )}
            </LoanSection>
            <LoanSection title="Lent out" loans={out}>
              {(loan) => (
                <LoanRow
                  key={loan._id}
                  loan={loan}
                  who={`With ${loan.borrower.firstName}`}
                  actions={[{ label: "Mark returned", variant: "primary", run: () => markReturned({ loanId: loan._id }) }]}
                />
              )}
            </LoanSection>
            <LoanSection title="Past" loans={past}>
              {(loan) => <LoanRow key={loan._id} loan={loan} who={`Borrowed by ${loan.borrower.firstName}`} />}
            </LoanSection>
          </>
        )}
      </div>
    </div>
  );
}
