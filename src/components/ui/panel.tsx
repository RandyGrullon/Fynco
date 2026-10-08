"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Panel: hoja inferior en móvil, diálogo centrado en escritorio.
 * Es el contenedor de todos los formularios (gasto, transferencia, dividir…).
 */
const Panel = DialogPrimitive.Root;
const PanelTrigger = DialogPrimitive.Trigger;
const PanelClose = DialogPrimitive.Close;

const PanelContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string; hideTitle?: boolean }
>(({ className, children, title, description, hideTitle, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border border-border bg-background shadow-2xl outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300",
        "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:data-[state=closed]:slide-out-to-bottom-4 md:data-[state=open]:slide-in-from-bottom-4",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-secondary md:hidden" aria-hidden="true" />
      <div className={cn("flex items-start justify-between gap-3 px-5 pb-2 pt-3", hideTitle && "sr-only")}>
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-lg font-extrabold tracking-tight">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close
          className="-mr-1.5 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-safe">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
PanelContent.displayName = "PanelContent";

/** Pie fijo del panel para los botones de acción. */
function PanelFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sticky bottom-0 -mx-5 mt-4 flex gap-2.5 border-t border-muted bg-background px-5 pb-1 pt-3", className)} {...props} />;
}

export { Panel, PanelTrigger, PanelClose, PanelContent, PanelFooter };
