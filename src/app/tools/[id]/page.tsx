import { Suspense } from "react";
import { ToolDetail } from "@/components/tool-detail";

export default function ToolPage() {
  return (
    <Suspense>
      <ToolDetail />
    </Suspense>
  );
}
