import { Suspense } from "react";
import { Board } from "@/components/board";

export default function HomePage() {
  return (
    <Suspense>
      <Board />
    </Suspense>
  );
}
