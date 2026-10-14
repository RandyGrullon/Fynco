import type { Metadata } from "next";
import { PlanVista } from "@/components/finanzas/plan-vista";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return <PlanVista />;
}
