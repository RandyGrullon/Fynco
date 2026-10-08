-- =====================================================================
-- Fynco v2 — esquema inicial
-- Pegar completo en Supabase → SQL Editor → Run (una sola vez).
-- Montos: bigint en centavos. Signo en `transactions.amount`: + entra, − sale.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.account_type as enum ('checking', 'savings', 'credit', 'investment', 'cash', 'other');
create type public.tx_kind as enum ('income', 'expense', 'transfer', 'shared', 'settlement');
create type public.split_method as enum ('equal', 'exact', 'percent', 'shares');
create type public.recurrence as enum ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');

-- ---------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text,
  avatar_url text,
  default_currency char(3) not null default 'DOP',
  hide_amounts boolean not null default false,
  app_lock_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- PIN: nunca legible por el cliente; solo vía RPC.
create table public.user_secrets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

-- ---------------------------------------------------------------------
-- Cartera personal
-- ---------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  type public.account_type not null default 'checking',
  currency char(3) not null default 'DOP',
  opening_balance bigint not null default 0,
  institution text,
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id);
create unique index accounts_one_default_idx on public.accounts (user_id) where is_default;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade, -- null = del sistema
  name text not null check (length(trim(name)) between 1 and 40),
  kind text not null check (kind in ('income', 'expense')),
  icon text not null default 'circle',
  color text not null default '#9AA0AA',
  sort int not null default 100
);
create index categories_user_idx on public.categories (user_id);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind public.tx_kind not null check (kind in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  description text not null check (length(trim(description)) between 1 and 120),
  category_id uuid references public.categories (id) on delete set null,
  frequency public.recurrence not null,
  start_on date not null,
  end_on date,
  run_count int not null default 0,
  next_run_on date not null,
  weekend_policy text not null default 'keep' check (weekend_policy in ('keep', 'before', 'after')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_on is null or end_on >= start_on)
);
create index recurring_due_idx on public.recurring_rules (next_run_on) where active;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  target_amount bigint not null check (target_amount > 0),
  currency char(3) not null default 'DOP',
  account_id uuid references public.accounts (id) on delete set null, -- progreso = saldo de esta cuenta
  deadline date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);

-- ---------------------------------------------------------------------
-- Compartido (tipo Splitwise)
-- ---------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  currency char(3) not null default 'DOP',
  kind text not null default 'group' check (kind in ('group', 'direct')),
  simplify_debts boolean not null default true,
  invite_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null, -- null = invitado sin cuenta
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  invite_email text,
  role text not null default 'member' check (role in ('owner', 'member')),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, profile_id)
);
create index group_members_profile_idx on public.group_members (profile_id);
create index group_members_group_idx on public.group_members (group_id);
create index group_members_email_idx on public.group_members (lower(invite_email)) where profile_id is null;

create table public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 120),
  amount bigint not null check (amount > 0),
  occurred_on date not null default current_date,
  category_id uuid references public.categories (id) on delete set null,
  split_method public.split_method not null default 'equal',
  note text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_expenses_group_idx on public.shared_expenses (group_id, occurred_on desc);

create table public.expense_payers (
  expense_id uuid not null references public.shared_expenses (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete restrict,
  amount bigint not null check (amount > 0),
  primary key (expense_id, member_id)
);
create index expense_payers_member_idx on public.expense_payers (member_id);

create table public.expense_shares (
  expense_id uuid not null references public.shared_expenses (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete restrict,
  amount bigint not null check (amount >= 0),
  weight numeric, -- porcentaje o partes tal como se capturó (para editar)
  primary key (expense_id, member_id)
);
create index expense_shares_member_idx on public.expense_shares (member_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_member uuid not null references public.group_members (id) on delete restrict,
  to_member uuid not null references public.group_members (id) on delete restrict,
  amount bigint not null check (amount > 0),
  occurred_on date not null default current_date,
  note text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_member <> to_member)
);
create index settlements_group_idx on public.settlements (group_id);

-- ---------------------------------------------------------------------
-- Libro único
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind public.tx_kind not null,
  amount bigint not null check (amount <> 0),
  occurred_on date not null default current_date,
  description text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  transfer_id uuid,
  shared_expense_id uuid references public.shared_expenses (id) on delete cascade,
  settlement_id uuid references public.settlements (id) on delete cascade,
  recurring_rule_id uuid references public.recurring_rules (id) on delete set null,
  occurrence_date date,
  source text not null default 'manual' check (source in ('manual', 'voice', 'assistant', 'recurring', 'import')),
  note text,
  created_at timestamptz not null default now(),
  constraint transactions_sign_check check (
    (kind = 'income' and amount > 0)
    or (kind in ('expense', 'shared') and amount < 0)
    or kind in ('transfer', 'settlement')
  ),
  constraint transactions_recurring_once unique (recurring_rule_id, occurrence_date)
);
create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc, created_at desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_transfer_idx on public.transactions (transfer_id) where transfer_id is not null;
create index transactions_shared_idx on public.transactions (shared_expense_id) where shared_expense_id is not null;

-- ---------------------------------------------------------------------
-- Vistas (respetan RLS del que consulta)
-- ---------------------------------------------------------------------
create view public.account_balances with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.currency,
       a.opening_balance + coalesce(sum(t.amount), 0)::bigint as balance
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
 group by a.id;

create view public.group_member_balances with (security_invoker = true) as
select m.group_id,
       m.id as member_id,
       coalesce(p.paid, 0)::bigint as paid,
       coalesce(s.owed, 0)::bigint as owed,
       coalesce(so.sent, 0)::bigint as settled_sent,
       coalesce(si.received, 0)::bigint as settled_received,
       (coalesce(p.paid, 0) - coalesce(s.owed, 0) + coalesce(so.sent, 0) - coalesce(si.received, 0))::bigint as net
  from public.group_members m
  left join (select member_id, sum(amount) as paid from public.expense_payers group by member_id) p on p.member_id = m.id
  left join (select member_id, sum(amount) as owed from public.expense_shares group by member_id) s on s.member_id = m.id
  left join (select from_member, sum(amount) as sent from public.settlements group by from_member) so on so.from_member = m.id
  left join (select to_member, sum(amount) as received from public.settlements group by to_member) si on si.to_member = m.id;

-- ---------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
     where group_id = p_group_id and profile_id = auth.uid() and left_at is null
  );
$$;

create function public.shares_group_with(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.group_members a
      join public.group_members b on a.group_id = b.group_id
     where a.profile_id = auth.uid() and b.profile_id = p_profile_id
  );
$$;

create function public.recurring_date(p_start date, p_freq public.recurrence, p_n int)
returns date
language sql immutable
as $$
  select case p_freq
    when 'daily' then p_start + p_n
    when 'weekly' then p_start + 7 * p_n
    when 'biweekly' then p_start + 14 * p_n
    when 'monthly' then (p_start + make_interval(months => p_n))::date
    when 'quarterly' then (p_start + make_interval(months => 3 * p_n))::date
    when 'yearly' then (p_start + make_interval(years => p_n))::date
  end;
$$;

create function public.adjust_weekend(p_date date, p_policy text)
returns date
language sql immutable
as $$
  select case
    when p_policy = 'before' and extract(isodow from p_date) = 6 then p_date - 1
    when p_policy = 'before' and extract(isodow from p_date) = 7 then p_date - 2
    when p_policy = 'after' and extract(isodow from p_date) = 6 then p_date + 2
    when p_policy = 'after' and extract(isodow from p_date) = 7 then p_date + 1
    else p_date
  end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Alta de usuario: perfil, cuenta "Efectivo" y vincular invitaciones por email.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.accounts (user_id, name, type, currency, is_default)
  values (new.id, 'Efectivo', 'cash', 'DOP', true);

  -- Las invitaciones por correo NO se vinculan solas: la persona las acepta (accept_invite)
  -- y solo con el correo ya confirmado.
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cambiar tu nombre lo actualiza en tus grupos.
create function public.sync_member_names()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if nullif(trim(new.display_name), '') is not null then
    update public.group_members set display_name = left(trim(new.display_name), 40) where profile_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_sync_member_names
  after update of display_name on public.profiles
  for each row when (new.display_name is distinct from old.display_name)
  execute function public.sync_member_names();

-- Borrar una pata de transferencia borra la otra.
create function public.delete_transfer_pair()
returns trigger
language plpgsql
as $$
begin
  delete from public.transactions where transfer_id = old.transfer_id and id <> old.id;
  return old;
end;
$$;

create trigger transactions_delete_transfer_pair
  after delete on public.transactions
  for each row when (old.transfer_id is not null)
  execute function public.delete_transfer_pair();

-- Recurrentes: la próxima fecha arranca en start_on y se reinicia si cambia el calendario.
create function public.recurring_rules_schedule()
returns trigger
language plpgsql
as $$
declare
  v_n int := 0;
begin
  if tg_op = 'INSERT' then
    new.run_count := 0;
    new.next_run_on := new.start_on;
    return new;
  end if;
  -- Cambiar el calendario o reanudar una regla pausada NO registra movimientos del pasado:
  -- arranca en la primera fecha del nuevo calendario que sea hoy o después.
  if new.start_on is distinct from old.start_on
     or new.frequency is distinct from old.frequency
     or (new.active and not old.active) then
    while public.recurring_date(new.start_on, new.frequency, v_n) < current_date and v_n < 20000 loop
      v_n := v_n + 1;
    end loop;
    new.run_count := v_n;
    new.next_run_on := public.recurring_date(new.start_on, new.frequency, v_n);
  end if;
  return new;
end;
$$;

create trigger recurring_rules_schedule
  before insert or update on public.recurring_rules
  for each row execute function public.recurring_rules_schedule();

-- Datos públicos de las personas con quienes compartes grupo (sin ajustes privados).
-- Corre como su dueño (salta RLS) con el filtro de abajo; security_barrier evita fugas
-- y los permisos la dejan en SOLO LECTURA (una vista simple sería actualizable).
create view public.member_profiles with (security_barrier = true) as
select p.id, p.display_name, p.email, p.avatar_url
  from public.profiles p
 where p.id = auth.uid() or public.shares_group_with(p.id);
revoke all on public.member_profiles from public, anon, authenticated;
grant select on public.member_profiles to authenticated;

-- ---------------------------------------------------------------------
-- RPC: cartera
-- ---------------------------------------------------------------------
create function public.create_transfer(
  p_from uuid,
  p_to uuid,
  p_amount bigint,
  p_to_amount bigint default null,
  p_occurred_on date default current_date,
  p_description text default ''
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid := gen_random_uuid();
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_from = p_to then raise exception 'same_account'; end if;
  if p_amount is null or p_amount <= 0 or coalesce(p_to_amount, p_amount) <= 0 then raise exception 'invalid_amount'; end if;
  if (select count(*) from public.accounts where id in (p_from, p_to) and user_id = v_me) <> 2 then
    raise exception 'invalid_account';
  end if;

  insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description, transfer_id)
  values (v_me, p_from, 'transfer', -p_amount, p_occurred_on, coalesce(p_description, ''), v_id),
         (v_me, p_to, 'transfer', coalesce(p_to_amount, p_amount), p_occurred_on, coalesce(p_description, ''), v_id);
  return v_id;
end;
$$;

create function public.update_transfer(
  p_transfer_id uuid,
  p_amount bigint,
  p_to_amount bigint default null,
  p_occurred_on date default current_date,
  p_description text default ''
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 or coalesce(p_to_amount, p_amount) <= 0 then raise exception 'invalid_amount'; end if;
  update public.transactions
     set amount = case when amount < 0 then -p_amount else coalesce(p_to_amount, p_amount) end,
         occurred_on = p_occurred_on,
         description = coalesce(p_description, '')
   where transfer_id = p_transfer_id and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end;
$$;

create function public.process_recurring(p_user uuid, p_today date)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_date date;
  v_runs int;
  v_guard int;
  v_count int := 0;
begin
  for r in
    select * from public.recurring_rules
     where active and next_run_on <= p_today and (p_user is null or user_id = p_user)
     for update skip locked
  loop
    v_date := r.next_run_on;
    v_runs := r.run_count;
    v_guard := 0;
    while v_date <= p_today and (r.end_on is null or v_date <= r.end_on) and v_guard < 400 loop
      insert into public.transactions
        (user_id, account_id, kind, amount, occurred_on, description, category_id, recurring_rule_id, occurrence_date, source)
      values
        (r.user_id, r.account_id, r.kind,
         case when r.kind = 'income' then r.amount else -r.amount end,
         public.adjust_weekend(v_date, r.weekend_policy), r.description, r.category_id, r.id, v_date, 'recurring')
      on conflict on constraint transactions_recurring_once do nothing;
      if found then v_count := v_count + 1; end if;
      v_runs := v_runs + 1;
      v_date := public.recurring_date(r.start_on, r.frequency, v_runs);
      v_guard := v_guard + 1;
    end loop;

    update public.recurring_rules
       set run_count = v_runs,
           next_run_on = v_date,
           active = not (end_on is not null and v_date > end_on)
     where id = r.id;
  end loop;
  return v_count;
end;
$$;

-- Lo llama la app al abrir (idempotente). `p_today` = fecha local del usuario.
create function public.run_my_recurring(p_today date default current_date)
returns int
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_today not between current_date - 1 and current_date + 1 then p_today := current_date; end if;
  return public.process_recurring(auth.uid(), p_today);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: compartido
-- ---------------------------------------------------------------------
create function public.create_group(
  p_name text,
  p_currency char(3) default 'DOP',
  p_kind text default 'group',
  p_members jsonb default '[]'::jsonb -- [{ "display_name": "Ana", "email": "ana@x.com" }]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_group uuid;
  v_me_name text;
  m jsonb;
  v_email text;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_kind = 'direct' and jsonb_array_length(p_members) <> 1 then raise exception 'direct_needs_one_member'; end if;

  select display_name into v_me_name from public.profiles where id = v_me;

  insert into public.groups (name, currency, kind, created_by)
  values (trim(p_name), upper(p_currency), p_kind, v_me)
  returning id into v_group;

  insert into public.group_members (group_id, profile_id, display_name, role)
  values (v_group, v_me, left(coalesce(nullif(trim(v_me_name), ''), 'Yo'), 40), 'owner');

  -- Los demás entran como invitados; si tienen cuenta, aceptan la invitación desde Compartido.
  for m in select * from jsonb_array_elements(p_members) loop
    v_email := nullif(lower(trim(m ->> 'email')), '');
    insert into public.group_members (group_id, display_name, invite_email)
    values (v_group, left(trim(m ->> 'display_name'), 40), v_email);
  end loop;

  return v_group;
end;
$$;

create function public.add_group_member(p_group_id uuid, p_display_name text, p_email text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_id uuid;
begin
  if not public.is_group_member(p_group_id) then raise exception 'not_a_member'; end if;
  if v_email is not null then
    select id into v_id from public.group_members
     where group_id = p_group_id and profile_id is null and lower(invite_email) = v_email;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.group_members (group_id, display_name, invite_email)
  values (p_group_id, left(trim(p_display_name), 40), v_email)
  returning id into v_id;
  return v_id;
end;
$$;

-- Saca a un miembro (o a uno mismo). Solo si está a mano.
create function public.remove_group_member(p_member_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_net bigint;
begin
  select group_id into v_group from public.group_members where id = p_member_id;
  if v_group is null or not public.is_group_member(v_group) then raise exception 'not_a_member'; end if;
  select net into v_net from public.group_member_balances where member_id = p_member_id;
  if coalesce(v_net, 0) <> 0 then raise exception 'member_has_balance'; end if;

  if exists (select 1 from public.expense_payers where member_id = p_member_id)
     or exists (select 1 from public.expense_shares where member_id = p_member_id)
     or exists (select 1 from public.settlements where from_member = p_member_id or to_member = p_member_id) then
    update public.group_members set left_at = now() where id = p_member_id;
  else
    delete from public.group_members where id = p_member_id;
  end if;
end;
$$;

create function public.update_group_member(p_member_id uuid, p_display_name text, p_email text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.group_members where id = p_member_id;
  if v_group is null or not public.is_group_member(v_group) then raise exception 'not_a_member'; end if;
  update public.group_members
     set display_name = left(trim(p_display_name), 40),
         invite_email = case when profile_id is null then nullif(lower(trim(p_email)), '') else invite_email end
   where id = p_member_id;
end;
$$;

-- Solo se borra un grupo sin historial compartido; si no, se archiva.
create function public.delete_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_group_member(p_group_id) then raise exception 'not_a_member'; end if;
  if exists (select 1 from public.shared_expenses where group_id = p_group_id)
     or exists (select 1 from public.settlements where group_id = p_group_id) then
    raise exception 'group_has_history';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

-- Vista previa para la pantalla "Unirse" (quien no es miembro no puede leer el grupo).
create function public.group_preview(p_code text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'currency', g.currency,
    'is_member', public.is_group_member(g.id),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name, 'claimed', m.profile_id is not null) order by m.created_at)
        from public.group_members m where m.group_id = g.id and m.left_at is null
    ), '[]'::jsonb)
  )
  from public.groups g
  where g.invite_code = p_code and g.archived_at is null;
$$;

-- Unirse por código. `p_claim_member`: ocupar el lugar de un invitado ("Soy Ana").
create function public.join_group(p_code text, p_claim_member uuid default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_group uuid;
  v_name text;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  select id into v_group from public.groups where invite_code = p_code and archived_at is null;
  if v_group is null then raise exception 'invalid_code'; end if;

  if exists (select 1 from public.group_members where group_id = v_group and profile_id = v_me) then
    update public.group_members set left_at = null where group_id = v_group and profile_id = v_me;
    return v_group;
  end if;

  if p_claim_member is not null then
    update public.group_members
       set profile_id = v_me
     where id = p_claim_member and group_id = v_group and profile_id is null;
    if found then return v_group; end if;
    raise exception 'member_already_claimed';
  end if;

  select display_name into v_name from public.profiles where id = v_me;
  insert into public.group_members (group_id, profile_id, display_name)
  values (v_group, v_me, left(coalesce(nullif(trim(v_name), ''), 'Nuevo miembro'), 40));
  return v_group;
end;
$$;

-- Correo confirmado del usuario actual (null si no lo ha confirmado).
create function public.my_confirmed_email()
returns text
language sql stable security definer set search_path = public
as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null;
$$;

-- Invitaciones por correo pendientes de aceptar.
create function public.my_pending_invites()
returns table (member_id uuid, group_id uuid, group_name text, group_kind text, currency char(3), invited_as text, members int, invited_by text)
language sql stable security definer set search_path = public
as $$
  select m.id, g.id, g.name, g.kind, g.currency, m.display_name,
         (select count(*)::int from public.group_members x where x.group_id = g.id and x.left_at is null),
         (select o.display_name from public.group_members o where o.group_id = g.id and o.role = 'owner' limit 1)
    from public.group_members m
    join public.groups g on g.id = m.group_id
   where m.profile_id is null
     and m.left_at is null
     and g.archived_at is null
     and lower(m.invite_email) = public.my_confirmed_email()
     and not exists (select 1 from public.group_members y where y.group_id = g.id and y.profile_id = auth.uid());
$$;

create function public.accept_invite(p_member_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
begin
  select m.group_id into v_group
    from public.group_members m
   where m.id = p_member_id and m.profile_id is null and m.left_at is null
     and lower(m.invite_email) = public.my_confirmed_email();
  if v_group is null then raise exception 'invalid_invite'; end if;
  if exists (select 1 from public.group_members where group_id = v_group and profile_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  update public.group_members set profile_id = auth.uid() where id = p_member_id;
  return v_group;
end;
$$;

-- Rechazar: el lugar queda como invitado sin correo (el historial del grupo no cambia).
create function public.decline_invite(p_member_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.group_members set invite_email = null
   where id = p_member_id and profile_id is null and lower(invite_email) = public.my_confirmed_email();
  if not found then raise exception 'invalid_invite'; end if;
end;
$$;

-- Crea o edita un gasto compartido de forma atómica.
-- p_payers / p_shares: [{ "member_id": uuid, "amount": centavos, "weight": opcional }]
-- p_account_id: cuenta propia con la que pagaste (crea/actualiza tu movimiento 'shared').
create function public.save_shared_expense(
  p_expense_id uuid,
  p_group_id uuid,
  p_description text,
  p_amount bigint,
  p_occurred_on date,
  p_category_id uuid,
  p_split_method public.split_method,
  p_payers jsonb,
  p_shares jsonb,
  p_account_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_sum bigint;
  v_my_paid bigint;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'not_a_member'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  select coalesce(sum((x ->> 'amount')::bigint), 0) into v_sum from jsonb_array_elements(p_payers) x;
  if v_sum <> p_amount then raise exception 'payers_sum_mismatch'; end if;
  select coalesce(sum((x ->> 'amount')::bigint), 0) into v_sum from jsonb_array_elements(p_shares) x;
  if v_sum <> p_amount then raise exception 'shares_sum_mismatch'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_payers || p_shares) x
     where not exists (
       select 1 from public.group_members m
        where m.id = (x ->> 'member_id')::uuid and m.group_id = p_group_id
     )
  ) then
    raise exception 'member_not_in_group';
  end if;

  if p_account_id is not null then
    if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_me) then
      raise exception 'invalid_account';
    end if;
    if (select currency from public.accounts where id = p_account_id) <> (select currency from public.groups where id = p_group_id) then
      raise exception 'currency_mismatch';
    end if;
  end if;

  if p_expense_id is null then
    insert into public.shared_expenses (group_id, description, amount, occurred_on, category_id, split_method, note, created_by)
    values (p_group_id, trim(p_description), p_amount, p_occurred_on, p_category_id, p_split_method, p_note, v_me)
    returning id into v_id;
  else
    update public.shared_expenses
       set description = trim(p_description), amount = p_amount, occurred_on = p_occurred_on,
           category_id = p_category_id, split_method = p_split_method, note = p_note, updated_at = now()
     where id = p_expense_id and group_id = p_group_id
    returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
    delete from public.expense_payers where expense_id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  insert into public.expense_payers (expense_id, member_id, amount)
  select v_id, (x ->> 'member_id')::uuid, (x ->> 'amount')::bigint
    from jsonb_array_elements(p_payers) x
   where (x ->> 'amount')::bigint > 0;

  insert into public.expense_shares (expense_id, member_id, amount, weight)
  select v_id, (x ->> 'member_id')::uuid, (x ->> 'amount')::bigint, nullif(x ->> 'weight', '')::numeric
    from jsonb_array_elements(p_shares) x;

  -- Sincroniza los movimientos personales ligados a este gasto.
  delete from public.transactions t
   where t.shared_expense_id = v_id
     and not exists (
       select 1 from public.expense_payers ep
         join public.group_members m on m.id = ep.member_id
        where ep.expense_id = v_id and m.profile_id = t.user_id
     );

  update public.transactions t
     set amount = -ep.amount, occurred_on = p_occurred_on, description = trim(p_description), category_id = p_category_id
    from public.expense_payers ep
    join public.group_members m on m.id = ep.member_id
   where t.shared_expense_id = v_id and ep.expense_id = v_id and m.profile_id = t.user_id;

  select ep.amount into v_my_paid
    from public.expense_payers ep
    join public.group_members m on m.id = ep.member_id
   where ep.expense_id = v_id and m.profile_id = v_me;

  if v_my_paid is not null and p_account_id is not null then
    update public.transactions set account_id = p_account_id where shared_expense_id = v_id and user_id = v_me;
    if not found then
      insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description, category_id, shared_expense_id)
      values (v_me, p_account_id, 'shared', -v_my_paid, p_occurred_on, trim(p_description), p_category_id, v_id);
    end if;
  end if;

  return v_id;
end;
$$;

create function public.delete_shared_expense(p_expense_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.shared_expenses where id = p_expense_id;
  if v_group is null or not public.is_group_member(v_group) then raise exception 'not_found'; end if;
  delete from public.shared_expenses where id = p_expense_id; -- en cascada: pagadores, partes y movimientos
end;
$$;

-- Registrar un pago entre miembros. Si eres una de las partes y das una cuenta, se mueve tu saldo.
create function public.record_settlement(
  p_group_id uuid,
  p_from_member uuid,
  p_to_member uuid,
  p_amount bigint,
  p_occurred_on date default current_date,
  p_account_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_from_profile uuid;
  v_to_profile uuid;
  v_label text;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'not_a_member'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  select profile_id into v_from_profile from public.group_members where id = p_from_member and group_id = p_group_id;
  if not found then raise exception 'member_not_in_group'; end if;
  select profile_id into v_to_profile from public.group_members where id = p_to_member and group_id = p_group_id;
  if not found then raise exception 'member_not_in_group'; end if;

  if p_account_id is not null then
    if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_me) then raise exception 'invalid_account'; end if;
    if v_me is distinct from v_from_profile and v_me is distinct from v_to_profile then raise exception 'not_a_party'; end if;
    if (select currency from public.accounts where id = p_account_id) <> (select currency from public.groups where id = p_group_id) then
      raise exception 'currency_mismatch';
    end if;
  end if;

  insert into public.settlements (group_id, from_member, to_member, amount, occurred_on, note, created_by)
  values (p_group_id, p_from_member, p_to_member, p_amount, p_occurred_on, p_note, v_me)
  returning id into v_id;

  if p_account_id is not null then
    select 'Pago · ' || g.name into v_label from public.groups g where g.id = p_group_id;
    insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description, settlement_id)
    values (v_me, p_account_id, 'settlement',
            case when v_me = v_from_profile then -p_amount else p_amount end,
            p_occurred_on, v_label, v_id);
  end if;

  return v_id;
end;
$$;

create function public.delete_settlement(p_settlement_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.settlements where id = p_settlement_id;
  if v_group is null or not public.is_group_member(v_group) then raise exception 'not_found'; end if;
  delete from public.settlements where id = p_settlement_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: estadísticas (tu gasto real = gastos propios + TU PARTE de lo compartido)
-- ---------------------------------------------------------------------
create function public.spending_by_category(p_from date, p_to date)
returns table (category_id uuid, currency char(3), total bigint)
language sql stable set search_path = public
as $$
  select x.category_id, x.currency, sum(x.total)::bigint
    from (
      select t.category_id, a.currency, -t.amount as total
        from public.transactions t
        join public.accounts a on a.id = t.account_id
       where t.user_id = auth.uid() and t.kind = 'expense' and t.occurred_on between p_from and p_to
      union all
      select e.category_id, g.currency, es.amount
        from public.expense_shares es
        join public.shared_expenses e on e.id = es.expense_id
        join public.groups g on g.id = e.group_id
        join public.group_members m on m.id = es.member_id
       where m.profile_id = auth.uid() and es.amount > 0 and e.occurred_on between p_from and p_to
    ) x
   group by x.category_id, x.currency;
$$;

create function public.cashflow_by_month(p_from date, p_to date)
returns table (month date, currency char(3), income bigint, expense bigint)
language sql stable set search_path = public
as $$
  select date_trunc('month', x.d)::date as month, x.currency,
         sum(x.income)::bigint, sum(x.expense)::bigint
    from (
      select t.occurred_on as d, a.currency,
             case when t.kind = 'income' then t.amount else 0 end as income,
             case when t.kind = 'expense' then -t.amount else 0 end as expense
        from public.transactions t
        join public.accounts a on a.id = t.account_id
       where t.user_id = auth.uid() and t.kind in ('income', 'expense') and t.occurred_on between p_from and p_to
      union all
      select e.occurred_on, g.currency, 0, es.amount
        from public.expense_shares es
        join public.shared_expenses e on e.id = es.expense_id
        join public.groups g on g.id = e.group_id
        join public.group_members m on m.id = es.member_id
       where m.profile_id = auth.uid() and es.amount > 0 and e.occurred_on between p_from and p_to
    ) x
   group by 1, 2
   order by 1;
$$;

-- ---------------------------------------------------------------------
-- RPC: PIN y cuenta
-- ---------------------------------------------------------------------
create function public.has_pin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_secrets where user_id = auth.uid() and pin_hash is not null);
$$;

create function public.verify_pin(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  s public.user_secrets;
begin
  select * into s from public.user_secrets where user_id = auth.uid() for update;
  if s.pin_hash is null then return jsonb_build_object('ok', false, 'reason', 'no_pin'); end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', s.locked_until);
  end if;

  if crypt(p_pin, s.pin_hash) = s.pin_hash then
    update public.user_secrets set failed_attempts = 0, locked_until = null where user_id = s.user_id;
    return jsonb_build_object('ok', true);
  end if;

  if (s.failed_attempts + 1) % 5 = 0 then
    update public.user_secrets
       set failed_attempts = s.failed_attempts + 1,
           locked_until = now() + make_interval(mins => 5 * ((s.failed_attempts + 1) / 5))
     where user_id = s.user_id
    returning locked_until into s.locked_until;
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', s.locked_until);
  end if;

  update public.user_secrets set failed_attempts = s.failed_attempts + 1, locked_until = null where user_id = s.user_id;
  return jsonb_build_object('ok', false, 'reason', 'wrong_pin', 'attempts_left', 5 - ((s.failed_attempts + 1) % 5));
end;
$$;

create function public.set_pin(p_pin text, p_current text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_check jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'invalid_pin_format'; end if;
  -- Sin excepciones en PIN incorrecto: así el contador de intentos no se revierte.
  if public.has_pin() then
    if p_current is null or p_current = '' then
      return jsonb_build_object('ok', false, 'reason', 'current_required');
    end if;
    v_check := public.verify_pin(p_current);
    if not (v_check ->> 'ok')::boolean then return v_check; end if;
  end if;
  insert into public.user_secrets (user_id, pin_hash)
  values (auth.uid(), crypt(p_pin, gen_salt('bf', 8)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.clear_pin(p_current text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_check jsonb := public.verify_pin(p_current);
begin
  if not (v_check ->> 'ok')::boolean then return v_check; end if;
  update public.user_secrets set pin_hash = null where user_id = auth.uid();
  update public.profiles set app_lock_enabled = false where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

-- Borra al usuario de Auth; todo lo personal cae en cascada.
-- En grupos queda como invitado sin cuenta para no romper el historial de los demás.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- Límite de uso del asistente (controla el costo de la IA)
-- ---------------------------------------------------------------------
create table public.assistant_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index assistant_usage_user_idx on public.assistant_usage (user_id, created_at desc);

-- Límites fijos aquí (no como parámetros) para que el cliente no pueda cambiarlos.
create function public.consume_assistant_quota()
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_hour int;
  v_day int;
begin
  if v_me is null then return false; end if;
  select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
    into v_hour, v_day
    from public.assistant_usage
   where user_id = v_me and created_at > now() - interval '1 day';
  if v_hour >= 40 or v_day >= 200 then return false; end if;
  insert into public.assistant_usage (user_id) values (v_me);
  delete from public.assistant_usage where user_id = v_me and created_at < now() - interval '2 days';
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_secrets enable row level security; -- sin políticas: inaccesible directo
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.goals enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.shared_expenses enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.transactions enable row level security;
alter table public.assistant_usage enable row level security; -- sin políticas: solo vía RPC

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy accounts_all on public.accounts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy categories_select on public.categories for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy categories_write on public.categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy recurring_all on public.recurring_rules for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()));

create policy goals_all on public.goals for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())));

-- Escritura directa solo para ingresos/gastos; transferencias, compartidos y pagos van por RPC.
create policy transactions_select on public.transactions for select to authenticated
  using (user_id = auth.uid());
create policy transactions_insert on public.transactions for insert to authenticated
  with check (
    user_id = auth.uid() and kind in ('income', 'expense')
    and transfer_id is null and shared_expense_id is null and settlement_id is null and recurring_rule_id is null
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = auth.uid() and kind in ('income', 'expense'))
  with check (
    user_id = auth.uid() and kind in ('income', 'expense')
    and transfer_id is null and shared_expense_id is null and settlement_id is null
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );
create policy transactions_delete on public.transactions for delete to authenticated
  using (user_id = auth.uid() and kind in ('income', 'expense', 'transfer'));

create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_member(id)) with check (public.is_group_member(id));

create policy group_members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy shared_expenses_select on public.shared_expenses for select to authenticated
  using (public.is_group_member(group_id));
create policy expense_payers_select on public.expense_payers for select to authenticated
  using (exists (select 1 from public.shared_expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
create policy expense_shares_select on public.expense_shares for select to authenticated
  using (exists (select 1 from public.shared_expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
create policy settlements_select on public.settlements for select to authenticated
  using (public.is_group_member(group_id));

-- Columnas editables directamente (el resto solo vía RPC/trigger).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, default_currency, hide_amounts, app_lock_enabled) on public.profiles to authenticated;
revoke update on public.groups from authenticated;
grant update (name, currency, simplify_debts, archived_at) on public.groups to authenticated;

-- ---------------------------------------------------------------------
-- Permisos. Supabase concede por defecto EXECUTE y ALL a anon y authenticated:
-- se retira todo a anon y se da a authenticated solo lo que la app llama.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema public from anon;

do $$
declare
  f text;
begin
  foreach f in array array[
    -- usadas por las políticas RLS y vistas
    'is_group_member(uuid)',
    'shares_group_with(uuid)',
    -- funciones puras que usa el trigger de recurrentes (corre con el rol del usuario)
    'recurring_date(date, public.recurrence, int)',
    'adjust_weekend(date, text)',
    -- RPCs de la app
    'create_transfer(uuid, uuid, bigint, bigint, date, text)',
    'update_transfer(uuid, bigint, bigint, date, text)',
    'run_my_recurring(date)',
    'create_group(text, char, text, jsonb)',
    'add_group_member(uuid, text, text)',
    'remove_group_member(uuid)',
    'update_group_member(uuid, text, text)',
    'delete_group(uuid)',
    'group_preview(text)',
    'join_group(text, uuid)',
    'my_pending_invites()',
    'accept_invite(uuid)',
    'decline_invite(uuid)',
    'save_shared_expense(uuid, uuid, text, bigint, date, uuid, public.split_method, jsonb, jsonb, uuid, text)',
    'delete_shared_expense(uuid)',
    'record_settlement(uuid, uuid, uuid, bigint, date, uuid, text)',
    'delete_settlement(uuid)',
    'spending_by_category(date, date)',
    'cashflow_by_month(date, date)',
    'has_pin()',
    'verify_pin(text)',
    'set_pin(text, text)',
    'clear_pin(text)',
    'delete_my_account()',
    'consume_assistant_quota()'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- Funciones que se creen después tampoco quedan abiertas a anon.
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------
-- Tiempo real para que los gastos del grupo aparezcan al instante
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shared_expenses, public.settlements, public.group_members;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Categorías del sistema
-- ---------------------------------------------------------------------
insert into public.categories (user_id, name, kind, icon, color, sort) values
  (null, 'Comida',          'expense', 'utensils',       '#FFB86B', 10),
  (null, 'Supermercado',    'expense', 'shopping-cart',  '#C8F05A', 20),
  (null, 'Transporte',      'expense', 'car',            '#8EC5FF', 30),
  (null, 'Vivienda',        'expense', 'home',           '#B9A6FF', 40),
  (null, 'Servicios',       'expense', 'zap',            '#FFE066', 50),
  (null, 'Salud',           'expense', 'heart-pulse',    '#FF8A7A', 60),
  (null, 'Entretenimiento', 'expense', 'clapperboard',   '#F5A3C7', 70),
  (null, 'Compras',         'expense', 'shopping-bag',   '#7CE0C3', 80),
  (null, 'Educación',       'expense', 'graduation-cap', '#A3B8FF', 90),
  (null, 'Viajes',          'expense', 'plane',          '#6FD3FF', 100),
  (null, 'Suscripciones',   'expense', 'repeat',         '#D6A3FF', 110),
  (null, 'Otros gastos',    'expense', 'circle',         '#9AA0AA', 900),
  (null, 'Salario',         'income',  'briefcase',      '#C8F05A', 10),
  (null, 'Freelance',       'income',  'laptop',         '#7CE0C3', 20),
  (null, 'Inversiones',     'income',  'trending-up',    '#8EC5FF', 30),
  (null, 'Regalos',         'income',  'gift',           '#F5A3C7', 40),
  (null, 'Otros ingresos',  'income',  'circle-plus',    '#9AA0AA', 900);

-- ---------------------------------------------------------------------
-- Opcional: procesar recurrentes cada hora en el servidor.
-- Requiere activar pg_cron en Database → Extensions. La app ya los procesa al abrir.
--   select cron.schedule('fynco-recurring', '15 * * * *', $$select public.process_recurring(null, current_date)$$);
-- ---------------------------------------------------------------------
