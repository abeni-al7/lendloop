"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useAction, useConvexAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <StoreUser>{children}</StoreUser>
    </ConvexProviderWithClerk>
  );
}

type Session = { isLoading: boolean; isSignedIn: boolean };
const SessionContext = createContext<Session>({ isLoading: true, isSignedIn: false });

/** Signed in AND the Convex user record exists, so protected queries can run. */
export function useSession() {
  return useContext(SessionContext);
}

function StoreUser({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { userId } = useAuth();
  const store = useAction(api.users.store);
  // Which Clerk user we stored, so a new sign-in waits for its own record.
  const [storedFor, setStoredFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;
    store()
      .then(() => !cancelled && setStoredFor(userId))
      .catch(() => !cancelled && setStoredFor(null));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId, store]);

  const ready = isAuthenticated && !!userId && storedFor === userId;
  const value: Session = {
    isLoading: isLoading || (isAuthenticated && !ready),
    isSignedIn: ready,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
