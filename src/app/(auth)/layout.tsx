import Link from "next/link";
import { LogoMark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col px-5 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="flex flex-1 flex-col justify-center gap-6 pb-4">
        <div className="flex items-center justify-center gap-2.5">
          <LogoMark size={44} />
          <span className="text-2xl font-extrabold tracking-tight">Fynco</span>
        </div>
        {children}
      </div>
      <footer className="flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/legal/privacidad" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Privacidad
        </Link>
        <Link href="/legal/terminos" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Términos
        </Link>
      </footer>
    </main>
  );
}
