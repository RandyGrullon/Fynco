import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getServerUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerUser();
  if (!user) redirect("/login");
  return <AppShell user={{ id: user.id, email: user.email ?? null }}>{children}</AppShell>;
}
