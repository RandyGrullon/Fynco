import type { Metadata } from "next";
import { MemoriaVista } from "@/components/finanzas/memoria-vista";

export const metadata: Metadata = { title: "Memoria" };

export default function MemoriaPage() {
  return <MemoriaVista />;
}
