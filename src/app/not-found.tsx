import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-xl font-extrabold">Esta página no existe</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Puede que el enlace esté mal escrito o que lo hayan borrado.</p>
      <Button asChild>
        <Link href="/inicio">Ir al inicio</Link>
      </Button>
    </main>
  );
}
