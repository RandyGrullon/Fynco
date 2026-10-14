import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Campo con etiqueta, ayuda y error. */
export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-semibold text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
