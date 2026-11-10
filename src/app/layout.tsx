import type { Metadata } from "next";
import { Suspense } from "react";
import { Archivo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: { default: "LendLoop", template: "%s · LendLoop" },
  description: "Borrow and lend tools with your neighbors.",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#1f3529",
    colorText: "#17221b",
    colorBackground: "#eceee7",
    colorInputBackground: "#ffffff",
    borderRadius: "6px",
    fontFamily: "var(--font-archivo), system-ui, sans-serif",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ClerkProvider appearance={clerkAppearance}>
          <ConvexClientProvider>
            <Suspense fallback={<div className="h-16 border-b border-board-line" />}>
              <SiteHeader />
            </Suspense>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-board-line px-4 py-6 text-sm text-on-board-soft sm:px-8">
              LendLoop is a demo. All neighbors and tools on the board are made up.
            </footer>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
