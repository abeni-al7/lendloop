// Vite (via Vitest) replaces import.meta.glob at build time.
export const modules = (import.meta as unknown as { glob: (p: string) => Record<string, () => Promise<unknown>> }).glob(
  "../convex/**/*.ts",
);
