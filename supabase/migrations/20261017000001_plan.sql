-- Plan: flujo de caja y lo que hay que pagar (pantalla /plan). Montos en centavos.

-- ---------------------------------------------------------------------
-- 1) Cuentas: cuándo y desde dónde se paga cada tarjeta, y dinero prestado que no se toca.
-- ---------------------------------------------------------------------
alter table public.accounts
  -- Día del mes en que de verdad se paga la tarjeta (si no, payment_due_day).
  add column if not exists pay_day smallint check (pay_day between 1 and 31),
  -- Cuenta desde la que se paga (si no, la predeterminada).
  add column if not exists pay_from_account_id uuid references public.accounts (id) on delete set null,
  -- Cuenta "other" con dinero prestado que se devuelve completo: resta de "tu dinero".
  add column if not exists reserved boolean not null default false;
alter table public.accounts add constraint accounts_reserved_only_other check (not reserved or type = 'other');
alter table public.accounts add constraint accounts_pay_from_not_self check (pay_from_account_id is null or pay_from_account_id <> id);

create function public.accounts_check_pay_from()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.pay_from_account_id is not null
     and not exists (select 1 from public.accounts a where a.id = new.pay_from_account_id and a.user_id = new.user_id) then
    raise exception 'invalid_account';
  end if;
  return new;
end;
$$;
create trigger accounts_check_pay_from
  before insert or update of pay_from_account_id on public.accounts
  for each row execute function public.accounts_check_pay_from();

-- ---------------------------------------------------------------------
-- 2) Recurrentes que son transferencias (cuotas de deudas, cambio a efectivo, ahorro).
-- ---------------------------------------------------------------------
alter table public.recurring_rules add column if not exists to_account_id uuid references public.accounts (id) on delete cascade;
alter table public.recurring_rules drop constraint if exists recurring_rules_kind_check;
alter table public.recurring_rules add constraint recurring_rules_kind_check check (kind in ('income', 'expense', 'transfer'));
alter table public.recurring_rules add constraint recurring_rules_transfer_target check ((kind = 'transfer') = (to_account_id is not null));
alter table public.recurring_rules add constraint recurring_rules_transfer_distinct check (to_account_id is null or to_account_id <> account_id);

-- La cuenta destino es de la misma persona y en la misma moneda.
create function public.recurring_rules_check_transfer()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_from char(3);
  v_to char(3);
begin
  if new.to_account_id is null then return new; end if;
  select currency into v_to from public.accounts where id = new.to_account_id and user_id = new.user_id;
  if v_to is null then raise exception 'invalid_account'; end if;
  select currency into v_from from public.accounts where id = new.account_id;
  if v_from <> v_to then raise exception 'transfer_currency_mismatch'; end if;
  return new;
end;
$$;
create trigger recurring_rules_check_transfer
  before insert or update on public.recurring_rules
  for each row execute function public.recurring_rules_check_transfer();

drop policy recurring_all on public.recurring_rules;
create policy recurring_all on public.recurring_rules for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
    and (to_account_id is null or exists (select 1 from public.accounts a where a.id = to_account_id and a.user_id = auth.uid()))
  );

-- Igual que antes, y las transferencias crean sus dos patas con un mismo transfer_id.
-- La pata que sale lleva (recurring_rule_id, occurrence_date): eso la hace idempotente.
create or replace function public.process_recurring(p_user uuid, p_today date)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_date date;
  v_day date;
  v_runs int;
  v_guard int;
  v_tid uuid;
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
      v_day := public.adjust_weekend(v_date, r.weekend_policy);
      if r.kind = 'transfer' then
        v_tid := gen_random_uuid();
        insert into public.transactions
          (user_id, account_id, kind, amount, occurred_on, description, transfer_id, recurring_rule_id, occurrence_date, source)
        values (r.user_id, r.account_id, 'transfer', -r.amount, v_day, r.description, v_tid, r.id, v_date, 'recurring')
        on conflict on constraint transactions_recurring_once do nothing;
        if found then
          insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description, transfer_id, source)
          values (r.user_id, r.to_account_id, 'transfer', r.amount, v_day, r.description, v_tid, 'recurring');
          v_count := v_count + 1;
        end if;
      else
        insert into public.transactions
          (user_id, account_id, kind, amount, occurred_on, description, category_id, recurring_rule_id, occurrence_date, source)
        values
          (r.user_id, r.account_id, r.kind,
           case when r.kind = 'income' then r.amount else -r.amount end,
           v_day, r.description, r.category_id, r.id, v_date, 'recurring')
        on conflict on constraint transactions_recurring_once do nothing;
        if found then v_count := v_count + 1; end if;
      end if;
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

-- ---------------------------------------------------------------------
-- 3) Ajustes del plan (una fila por persona).
-- ---------------------------------------------------------------------
create table public.plan_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- Gasto del día a día por mes, en la moneda principal.
  monthly_budget bigint check (monthly_budget is null or monthly_budget >= 0),
  -- Colchón mínimo que no se quiere tocar.
  cushion bigint not null default 0 check (cushion >= 0),
  horizon_days int not null default 100 check (horizon_days between 14 and 400),
  -- Tarjeta o cuenta donde cae el gasto del día a día (para estimar sus cortes).
  budget_account_id uuid references public.accounts (id) on delete set null,
  -- Tasas a la moneda principal, p. ej. {"USD": 62, "EUR": 69}.
  rates jsonb not null default '{}'::jsonb check (jsonb_typeof(rates) = 'object'),
  -- Categorías que no cuentan para el presupuesto (viajes, regalos…).
  excluded_category_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4) Periodos con presupuesto propio (un viaje). Mientras dura, no corre el de casa.
-- ---------------------------------------------------------------------
create table public.plan_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  start_on date not null,
  end_on date not null,
  budget bigint not null check (budget >= 0),
  currency char(3) not null default 'DOP',
  -- La parte que se lleva en efectivo.
  cash_amount bigint check (cash_amount is null or cash_amount >= 0),
  -- La tarjeta con que se paga allá.
  account_id uuid references public.accounts (id) on delete set null,
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint plan_periods_dates check (end_on >= start_on),
  constraint plan_periods_cash check (cash_amount is null or cash_amount <= budget)
);
create index plan_periods_user_idx on public.plan_periods (user_id, start_on);

alter table public.plan_settings enable row level security;
alter table public.plan_periods enable row level security;
create policy plan_settings_all on public.plan_settings for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (budget_account_id is null or exists (select 1 from public.accounts a where a.id = budget_account_id and a.user_id = auth.uid()))
  );
create policy plan_periods_all on public.plan_periods for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  );
revoke all on public.plan_settings, public.plan_periods from anon;

-- ---------------------------------------------------------------------
-- 5) Tu parte de los gastos compartidos, día por día (para el presupuesto del plan).
-- ---------------------------------------------------------------------
create function public.my_shared_shares(p_from date, p_to date)
returns table (occurred_on date, currency char(3), category_id uuid, amount bigint)
language sql stable security definer set search_path = public
as $$
  select e.occurred_on, g.currency, e.category_id, es.amount
    from public.expense_shares es
    join public.shared_expenses e on e.id = es.expense_id
    join public.groups g on g.id = e.group_id
    join public.group_members m on m.id = es.member_id
   where m.profile_id = auth.uid() and es.amount > 0 and e.occurred_on between p_from and p_to;
$$;

revoke execute on function public.accounts_check_pay_from() from public, anon, authenticated;
revoke execute on function public.recurring_rules_check_transfer() from public, anon, authenticated;
revoke execute on function public.my_shared_shares(date, date) from public, anon;
grant execute on function public.my_shared_shares(date, date) to authenticated;
