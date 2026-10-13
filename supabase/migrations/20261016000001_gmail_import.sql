-- =====================================================================
-- Importar movimientos desde los correos de alertas del banco (Gmail).
--
-- Flujo: la persona conecta su Gmail (OAuth, solo lectura) → el servidor
-- busca las alertas del banco → reglas fijas (o la IA si el formato es
-- desconocido) sacan monto, moneda, tarjeta y comercio → se registra el
-- movimiento en la cuenta cuya terminación coincide. Lo que no se puede
-- asignar con seguridad queda "por revisar".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Nuevo origen de movimientos: 'email'
-- ---------------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'voice', 'assistant', 'recurring', 'import', 'email'));

-- ---------------------------------------------------------------------
-- 2) Conexión con Gmail (una por persona)
--    El token de actualización se guarda CIFRADO con una llave que solo
--    tiene el servidor (GMAIL_TOKEN_KEY): el navegador solo ve texto cifrado.
-- ---------------------------------------------------------------------
create table public.gmail_connections (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,
  -- Búsqueda de Gmail con la que se encuentran las alertas.
  query text not null default 'from:notificaciones@popularenlinea.com'
    check (length(trim(query)) between 1 and 300),
  -- Solo se importan correos recibidos desde este momento (los saldos iniciales ya cubren lo anterior).
  import_since timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) Cada correo procesado: evita duplicados y guarda lo que hay que revisar
-- ---------------------------------------------------------------------
create table public.email_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  gmail_id text not null check (length(gmail_id) between 1 and 64),
  received_at timestamptz not null,
  sender text not null default '' check (length(sender) <= 200),
  subject text not null default '' check (length(subject) <= 200),
  status text not null check (status in ('added', 'review', 'ignored', 'error')),
  parser text not null default 'rules' check (parser in ('rules', 'ai')),
  kind text check (kind in ('expense', 'income', 'cash_withdrawal', 'refund', 'other')),
  amount bigint check (amount is null or amount > 0), -- centavos, en la moneda del correo
  currency char(3),
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  merchant text check (merchant is null or length(merchant) <= 120),
  occurred_on date,
  account_id uuid references public.accounts (id) on delete set null,
  transaction_id uuid references public.transactions (id) on delete set null,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  constraint email_imports_once unique (user_id, gmail_id)
);
create index email_imports_user_idx on public.email_imports (user_id, received_at desc);
create index email_imports_review_idx on public.email_imports (user_id) where status = 'review';

-- ---------------------------------------------------------------------
-- RLS: cada quien ve y toca solo lo suyo
-- ---------------------------------------------------------------------
alter table public.gmail_connections enable row level security;
alter table public.email_imports enable row level security;

create policy gmail_connections_all on public.gmail_connections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy email_imports_select on public.email_imports for select to authenticated
  using (user_id = auth.uid());
create policy email_imports_insert on public.email_imports for insert to authenticated
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
    and (transaction_id is null or exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()))
  );
create policy email_imports_update on public.email_imports for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
    and (transaction_id is null or exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()))
  );
create policy email_imports_delete on public.email_imports for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.gmail_connections, public.email_imports from anon;
