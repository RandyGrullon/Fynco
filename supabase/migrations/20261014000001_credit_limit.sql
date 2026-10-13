-- Tarjetas de crédito: límite de crédito en centavos (opcional).
alter table public.accounts
  add column if not exists credit_limit bigint check (credit_limit is null or credit_limit > 0);
