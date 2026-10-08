import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/supabase/server";
import { JoinGroup } from "./join-group";
import { LogoMark } from "@/components/brand";

export const metadata = { title: "Unirse a un grupo" };

export default async function UnirsePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { user } = await getServerUser();
  const next = `/unirse/${encodeURIComponent(code)}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
      <LogoMark size={48} />
      {user ? (
        <JoinGroup code={code} />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Te invitaron a un grupo</h1>
            <p className="mt-2 text-muted-foreground">Entra o crea tu cuenta en Fynco para ver los gastos compartidos y saber quién le debe a quién.</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Button asChild size="lg">
              <Link href={`/signup?next=${encodeURIComponent(next)}`}>Crear cuenta</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={`/login?next=${encodeURIComponent(next)}`}>Ya tengo cuenta</Link>
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
