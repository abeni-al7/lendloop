"use client";

import { SignInButton } from "@clerk/nextjs";

export function SignInPrompt({ what }: { what: string }) {
  return (
    <div className="pegboard min-h-full px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-xl rounded-lg bg-board-raised p-8">
        <h1 className="display text-3xl font-extrabold">Sign in first</h1>
        <p className="mt-2 text-on-board-soft">You need to sign in to {what}.</p>
        <SignInButton mode="modal">
          <button className="mt-6 h-11 rounded-md bg-paint px-5 font-semibold text-paint-ink hover:bg-[#ffd451]">
            Sign in to lend or borrow
          </button>
        </SignInButton>
      </div>
    </div>
  );
}
