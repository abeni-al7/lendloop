import type { Category } from "@/lib/format";

/**
 * Tool silhouettes, drawn like the painted outlines on a shadow board.
 * One stroke weight across the set. Decorative: the tool name is always next to it.
 */
const PATHS: Record<Category, React.ReactNode> = {
  power: (
    <>
      <path d="M6 14h24a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H6z" />
      <path d="M34 19h8" />
      <path d="M14 24l-2 16h10l2-16" />
      <path d="M12 34h10" />
    </>
  ),
  hand: (
    <>
      <path d="M10 10h18v8H10z" />
      <path d="M19 18v24" />
      <path d="M28 12h6" />
      <path d="M33 30l7 7a3 3 0 0 1-4 4l-7-7" />
    </>
  ),
  garden: (
    <>
      <path d="M24 4v24" />
      <path d="M19 4h10" />
      <path d="M16 28h16v6a8 8 0 0 1-16 0z" />
    </>
  ),
  ladders: (
    <>
      <path d="M15 4l-3 40M33 4l3 40" />
      <path d="M14.5 12h19M13.9 20h20.4M13.3 28h21.6M12.7 36h22.8" />
    </>
  ),
  cleaning: (
    <>
      <path d="M16 18h16v24H16z" />
      <path d="M20 18v-6h8v6" />
      <path d="M28 12h8" />
      <path d="M38 8l3-2M39 12h3M38 16l3 2" />
    </>
  ),
  other: (
    <>
      <path d="M6 18h36v22H6z" />
      <path d="M17 18v-6h14v6" />
      <path d="M6 27h36" />
      <path d="M21 25v4h6v-4" />
    </>
  ),
};

export function ToolIcon({ category, className }: { category: Category; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[category]}
    </svg>
  );
}
