"use client";

import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export default function AsistentePage() {
  // useSearchParams (?voz=1) necesita un límite de Suspense.
  return (
    <Suspense fallback={null}>
      <AssistantChat />
    </Suspense>
  );
}
