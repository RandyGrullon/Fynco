import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-6 pt-10">
      <div className="flex flex-1 flex-col justify-center gap-8 pb-8">
        <div className="flex items-center justify-center gap-2.5">
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-xl font-extrabold text-primary-foreground">
            F
          </span>
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
