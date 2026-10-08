import Link from "next/link";
import { LogoMark } from "@/components/brand";

// Páginas públicas (fuera de la app): política de privacidad y términos.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-8 md:pt-14">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <LogoMark size={36} />
        <span className="text-xl font-extrabold tracking-tight">Fynco</span>
      </Link>
      <article className="mt-8 flex flex-col gap-8 text-[15px] leading-7 text-foreground/90 [&_li]:pl-1 [&_strong]:font-bold [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground">
        {children}
      </article>
      <nav aria-label="Más información" className="mt-12 flex flex-wrap gap-x-6 gap-y-1 border-t border-secondary pt-6 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Volver a Fynco
        </Link>
        <Link href="/legal/privacidad" className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Privacidad
        </Link>
        <Link href="/legal/terminos" className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Términos
        </Link>
        <a href="mailto:support@fynco.app" className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          support@fynco.app
        </a>
      </nav>
    </main>
  );
}
