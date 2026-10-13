"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { TransactionInput } from "@/lib/data/transactions";
import type { SharedExpense, Transaction } from "@/lib/types";
import type { ExpensePreset } from "@/components/shared/expense-panel";
import { QuickAddPanel } from "./quick-add-panel";
import { TransactionPanel } from "@/components/forms/transaction-panel";
import { TransferPanel } from "@/components/forms/transfer-panel";
import { ExpensePanel } from "@/components/shared/expense-panel";
import { SettlePanel } from "@/components/shared/settle-panel";
import { ImportPanel } from "@/components/import/import-panel";
import { CardPaymentPanel } from "@/components/accounts/card-payment-panel";
import { CardBalancePanel } from "@/components/accounts/card-balance-panel";

export type SheetState =
  | { type: "quick" }
  | { type: "transaction"; kind?: "expense" | "income"; tx?: Transaction; preset?: Partial<TransactionInput>; onSaved?: (tx: Transaction) => void }
  | { type: "transfer"; tx?: Transaction; preset?: { from?: string; to?: string; amount?: number; description?: string } }
  | { type: "expense"; groupId?: string; expense?: SharedExpense; preset?: ExpensePreset }
  | { type: "settle"; groupId: string; from?: string; to?: string; amount?: number }
  | { type: "import"; accountId?: string }
  | { type: "card_payment"; cardId?: string }
  | { type: "card_balance"; cardId: string };

interface SheetsApi {
  open: (s: SheetState) => void;
  close: () => void;
}

const SheetsContext = createContext<SheetsApi | null>(null);

export function SheetsProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // `key` fuerza un formulario limpio cada vez que se abre.
  const [nonce, setNonce] = useState(0);

  const open = useCallback((s: SheetState) => {
    setNonce((n) => n + 1);
    setSheet(s);
  }, []);
  const close = useCallback(() => setSheet(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);
  const onOpenChange = (o: boolean) => !o && close();

  return (
    <SheetsContext.Provider value={api}>
      {children}
      <QuickAddPanel open={sheet?.type === "quick"} onOpenChange={onOpenChange} />
      {sheet?.type === "transaction" && <TransactionPanel key={nonce} open onOpenChange={onOpenChange} {...sheet} />}
      {sheet?.type === "transfer" && <TransferPanel key={nonce} open onOpenChange={onOpenChange} tx={sheet.tx} preset={sheet.preset} />}
      {sheet?.type === "expense" && (
        <ExpensePanel key={nonce} open onOpenChange={onOpenChange} groupId={sheet.groupId} expense={sheet.expense} preset={sheet.preset} />
      )}
      {sheet?.type === "settle" && (
        <SettlePanel key={nonce} open onOpenChange={onOpenChange} groupId={sheet.groupId} from={sheet.from} to={sheet.to} amount={sheet.amount} />
      )}
      {sheet?.type === "import" && <ImportPanel key={nonce} open onOpenChange={onOpenChange} accountId={sheet.accountId} />}
      {sheet?.type === "card_payment" && <CardPaymentPanel key={nonce} open onOpenChange={onOpenChange} cardId={sheet.cardId} />}
      {sheet?.type === "card_balance" && <CardBalancePanel key={nonce} open onOpenChange={onOpenChange} cardId={sheet.cardId} />}
    </SheetsContext.Provider>
  );
}

export function useSheets(): SheetsApi {
  const ctx = useContext(SheetsContext);
  if (!ctx) throw new Error("useSheets debe usarse dentro de SheetsProvider");
  return ctx;
}
