-- Tarjetas de crédito: día de corte y día límite de pago (día del mes, 1-31).
-- Si el mes es más corto (p. ej. 31 en febrero), la app usa el último día del mes.
alter table public.accounts
  add column if not exists statement_day smallint check (statement_day between 1 and 31),
  add column if not exists payment_due_day smallint check (payment_due_day between 1 and 31);
