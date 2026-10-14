"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { AccountSelect, AmountField, DateField, Field, Segmented } from "@/components/forms/fields";
import { BigMoney } from "@/components/money";
import { useAccountMutations, useAccounts } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { todayISO } from "@/lib/dates";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";

/**
 * "Tarjeta pagada": registra el pago desde la cuenta que elijas. Lo consumido con la tarjeta
 * ya está en su deuda; el dinero sale de la cuenta solo ahora, en la fecha del pago.
 */
export function CardPaymentPanel({
  open,
  onOpenChange,
  cardId,
  amount: presetAmount,
  fromId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId?: string;
  /** Monto ya lleno (p. ej. el corte que toca pagar según el plan). */
  amount?: number;
  fromId?: string | null;
}) {
  const { data: accounts = [] } = useAccounts();
  const m = useAccountMutations();
  const active = accounts.filter((a) => !a.archived_at);
  const cards = active.filter((a) => a.type === "credit");
  const [cardChoice, setCardChoice] = useState(cardId ?? "");
  const card = cards.find((c) => c.id === (cardChoice || cardId)) ?? (cardId ? undefined : cards[0]);
  const debt = card ? Math.max(0, -card.balance) : 0;
  const sources = active.filter((a) => a.type !== "credit" && a.currency === card?.currency);
  const [fromChoice, setFromChoice] = useState(fromId ?? card?.pay_from_account_id ?? "");
  const from = sources.find((a) => a.id === fromChoice) ?? sources.find((a) => a.is_default) ?? sources[0];
  const presetIsTotal = presetAmount == null || presetAmount === debt;
  const [mode, setMode] = useState<"total" | "other">(debt > 0 && presetIsTotal ? "total" : "other");
  const [amount, setAmount] = useState(presetAmount && !presetIsTotal ? centsToInput(presetAmount) : "");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;
    if (!from) return setError("Elige de qué cuenta pagaste.");
    const cents = mode === "total" ? debt : parseMoney(amount);
    if (!cents || cents <= 0) return setError(mode === "total" ? "En Fynco esta tarjeta no tiene deuda. Escribe cuánto pagaste." : "Escribe cuánto pagaste.");
    setError(null);
    try {
      await m.payCard.mutateAsync({ card: card.id, from: from.id, amount: cents, occurred_on: date });
    } catch {
      return; // el aviso global ya mostró el error
    }
    toast({ title: "Pago registrado", description: `${formatMoney(cents, card.currency)} de ${from.name} a ${card.name}` });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Pagar tarjeta" description="El dinero sale de la cuenta que elijas, en la fecha del pago.">
        {!cards.length ? (
          <p className="pb-6 text-sm text-muted-foreground">No tienes tarjetas de crédito. Créala en Cuentas → Nueva cuenta.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {(!cardId || cards.length > 1) && (
              <Field label="Tarjeta" htmlFor="pay-card">
                <AccountSelect id="pay-card" accounts={cards} value={card?.id} onChange={setCardChoice} />
              </Field>
            )}

            {card && (
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-secondary bg-card py-4">
                <span className="text-[13px] font-semibold text-muted-foreground">Debes hoy en {card.name}</span>
                <BigMoney amount={debt} currency={card.currency} className="text-[32px]" />
              </div>
            )}

            <Segmented
              label="Cuánto pagaste"
              value={mode}
              onChange={setMode}
              options={[
                { value: "total", label: debt > 0 ? `Todo (${formatMoney(debt, card?.currency ?? "DOP")})` : "Todo" },
                { value: "other", label: "Otro monto" },
              ]}
            />
            {mode === "other" && <AmountField label="Monto pagado" value={amount} onChange={setAmount} currency={card?.currency ?? "DOP"} autoFocus />}

            <Field label="¿Desde qué cuenta pagaste?" htmlFor="pay-from">
              {sources.length ? (
                <AccountSelect id="pay-from" accounts={sources} value={from?.id} onChange={setFromChoice} />
              ) : (
                <p className="text-sm text-muted-foreground">No tienes cuentas en {card?.currency} para pagar. Crea una en Cuentas o usa Transferir.</p>
              )}
            </Field>
            <Field label="Fecha del pago" htmlFor="pay-date">
              <DateField id="pay-date" value={date} onChange={setDate} />
            </Field>

            {error && (
              <p className="text-sm font-semibold text-negative" role="alert">
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Lo que consumiste ya se contó como gasto; el pago no se cuenta otra vez.</p>

            <PanelFooter>
              <Button type="submit" className="flex-1" disabled={m.payCard.isPending || !from}>
                {m.payCard.isPending && <Loader2 className="animate-spin" />}
                Registrar pago
              </Button>
            </PanelFooter>
          </form>
        )}
      </PanelContent>
    </Panel>
  );
}
