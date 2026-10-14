-- Deudas y préstamos entre personas (fuera de los grupos): "me prestaron" o "presté".
-- Interés simple opcional (total, mensual o anual) y pagos en una o varias cuotas.
-- Las cuotas se calculan con debt_terms; la app usa la misma fórmula (src/lib/debts.ts).
--
-- Si se elige una cuenta, el dinero se refleja en ella: el capital como "pago de deuda"
-- (kind 'settlement', no cuenta en estadísticas) y el interés como gasto (o ingreso si prestaste).

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('borrowed', 'lent')),
  person text not null check (length(trim(person)) between 1 and 60),
  principal bigint not null check (principal > 0),
  currency char(3) not null default 'DOP',
  started_on date not null default current_date,
  interest_rate numeric(8, 3) not null default 0 check (interest_rate >= 0 and interest_rate <= 1000),
  interest_period text not null default 'none' check (interest_period in ('none', 'total', 'monthly', 'annual')),
  installments int not null default 1 check (installments between 1 and 360),
  frequency text not null default 'once' check (frequency in ('once', 'weekly', 'biweekly', 'monthly')),
  -- Primera cuota, o la fecha límite si es un solo pago.
  first_due_on date not null,
  -- Dónde entró (me prestaron) o de dónde salió (presté) el dinero. Opcional.
  account_id uuid references public.accounts (id) on delete set null,
  note text check (note is null or length(note) <= 500),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint debts_due_after_start check (first_due_on >= started_on),
  constraint debts_once_single check ((frequency = 'once') = (installments = 1))
);
create index debts_user_idx on public.debts (user_id);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount bigint not null check (amount > 0),
  paid_on date not null default current_date,
  account_id uuid references public.accounts (id) on delete set null,
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now()
);
create index debt_payments_debt_idx on public.debt_payments (debt_id);

alter table public.transactions
  add column if not exists debt_id uuid references public.debts (id) on delete cascade,
  add column if not exists debt_payment_id uuid references public.debt_payments (id) on delete cascade;
create index if not exists transactions_debt_idx on public.transactions (debt_id) where debt_id is not null;

-- Solo lectura directa; todo cambio va por las funciones de abajo.
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
create policy debts_select on public.debts for select to authenticated using (user_id = auth.uid());
create policy debt_payments_select on public.debt_payments for select to authenticated using (user_id = auth.uid());

-- Los movimientos de una deuda solo se cambian desde la deuda.
drop policy transactions_insert on public.transactions;
drop policy transactions_update on public.transactions;
drop policy transactions_delete on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated
  with check (
    user_id = auth.uid() and kind in ('income', 'expense')
    and transfer_id is null and shared_expense_id is null and settlement_id is null and recurring_rule_id is null
    and debt_id is null and debt_payment_id is null
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = auth.uid() and kind in ('income', 'expense') and debt_id is null)
  with check (
    user_id = auth.uid() and kind in ('income', 'expense')
    and transfer_id is null and shared_expense_id is null and settlement_id is null
    and debt_id is null and debt_payment_id is null
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );
create policy transactions_delete on public.transactions for delete to authenticated
  using (user_id = auth.uid() and kind in ('income', 'expense', 'transfer') and debt_id is null);

-- Meses entre dos fechas: los de calendario más los días sueltos sobre 30 (15 oct → 15 feb = 4).
create function public.months_between(p_from date, p_to date)
returns numeric
language sql immutable set search_path = public
as $$
  select greatest(0,
    (extract(year from p_to) - extract(year from p_from)) * 12
    + (extract(month from p_to) - extract(month from p_from))
    + (extract(day from p_to) - extract(day from p_from)) / 30.0);
$$;

-- Última cuota, interés y total de una deuda.
create function public.debt_terms(p_debt public.debts)
returns table (last_due_on date, interest bigint, total bigint)
language sql stable set search_path = public
as $$
  with l as (
    select case p_debt.frequency
             when 'weekly' then p_debt.first_due_on + 7 * (p_debt.installments - 1)
             when 'biweekly' then p_debt.first_due_on + 14 * (p_debt.installments - 1)
             when 'monthly' then (p_debt.first_due_on + make_interval(months => p_debt.installments - 1))::date
             else p_debt.first_due_on
           end as d
  ), i as (
    select l.d,
           round(case p_debt.interest_period
                   when 'total' then p_debt.principal * p_debt.interest_rate / 100
                   when 'monthly' then p_debt.principal * p_debt.interest_rate / 100 * public.months_between(p_debt.started_on, l.d)
                   when 'annual' then p_debt.principal * p_debt.interest_rate / 100 * public.months_between(p_debt.started_on, l.d) / 12
                   else 0
                 end)::bigint as interest
      from l
  )
  select i.d, i.interest, p_debt.principal + i.interest from i;
$$;

-- Marca la deuda como saldada (o no) según lo pagado.
create function public.refresh_debt_status(p_debt uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_debt public.debts;
  v_total bigint;
  v_paid bigint;
begin
  select * into v_debt from public.debts where id = p_debt;
  if v_debt.id is null then return; end if;
  select total into v_total from public.debt_terms(v_debt);
  select coalesce(sum(amount), 0) into v_paid from public.debt_payments where debt_id = p_debt;
  update public.debts
     set closed_at = case when v_paid >= v_total then coalesce(closed_at, now()) else null end
   where id = p_debt;
end;
$$;

-- El movimiento inicial: el dinero que entró (me prestaron) o salió (presté) de la cuenta.
create function public.sync_debt_disbursement(p_debt uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_debt public.debts;
begin
  select * into v_debt from public.debts where id = p_debt;
  delete from public.transactions where debt_id = p_debt and debt_payment_id is null;
  if v_debt.account_id is null then return; end if;
  insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description, debt_id)
  values (
    v_debt.user_id, v_debt.account_id, 'settlement',
    case when v_debt.direction = 'borrowed' then v_debt.principal else -v_debt.principal end,
    v_debt.started_on,
    case when v_debt.direction = 'borrowed' then 'Préstamo de ' else 'Préstamo a ' end || v_debt.person,
    p_debt
  );
end;
$$;

create function public.check_debt_account(p_account uuid, p_currency char(3))
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_currency char(3);
begin
  if p_account is null then return; end if;
  select currency into v_currency from public.accounts where id = p_account and user_id = auth.uid();
  if v_currency is null then raise exception 'invalid_account'; end if;
  if v_currency <> p_currency then raise exception 'debt_currency_mismatch'; end if;
end;
$$;

create function public.save_debt(
  p_debt uuid,                      -- null = nueva
  p_direction text,
  p_person text,
  p_principal bigint,
  p_currency char(3),
  p_started_on date,
  p_interest_rate numeric,
  p_interest_period text,
  p_installments int,
  p_frequency text,
  p_first_due_on date,
  p_account uuid default null,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid := p_debt;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_principal is null or p_principal <= 0 then raise exception 'invalid_amount'; end if;
  perform public.check_debt_account(p_account, coalesce(p_currency, 'DOP'));

  if v_id is null then
    insert into public.debts (user_id, direction, person, principal, currency, started_on, interest_rate, interest_period, installments, frequency, first_due_on, account_id, note)
    values (v_me, p_direction, trim(p_person), p_principal, coalesce(p_currency, 'DOP'), coalesce(p_started_on, current_date),
            coalesce(p_interest_rate, 0), coalesce(p_interest_period, 'none'), coalesce(p_installments, 1), coalesce(p_frequency, 'once'),
            p_first_due_on, p_account, nullif(trim(p_note), ''))
    returning id into v_id;
  else
    update public.debts
       set direction = p_direction, person = trim(p_person), principal = p_principal, currency = coalesce(p_currency, currency),
           started_on = coalesce(p_started_on, started_on), interest_rate = coalesce(p_interest_rate, 0),
           interest_period = coalesce(p_interest_period, 'none'), installments = coalesce(p_installments, 1),
           frequency = coalesce(p_frequency, 'once'), first_due_on = p_first_due_on, account_id = p_account,
           note = nullif(trim(p_note), '')
     where id = v_id and user_id = v_me;
    if not found then raise exception 'not_found'; end if;
  end if;

  perform public.sync_debt_disbursement(v_id);
  perform public.refresh_debt_status(v_id);
  return v_id;
end;
$$;

create function public.delete_debt(p_debt uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Sus pagos y los movimientos que creó se borran en cascada.
  delete from public.debts where id = p_debt and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Registrar un pago (o un cobro, si prestaste). p_account opcional: si se da, se refleja en la cuenta.
create function public.record_debt_payment(
  p_debt uuid,
  p_amount bigint,
  p_paid_on date default current_date,
  p_account uuid default null,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_debt public.debts;
  v_terms record;
  v_id uuid;
  v_interest bigint;
  v_sign int;
  v_date date := coalesce(p_paid_on, current_date);
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  select * into v_debt from public.debts where id = p_debt and user_id = v_me for update;
  if v_debt.id is null then raise exception 'not_found'; end if;
  perform public.check_debt_account(p_account, v_debt.currency);
  select * into v_terms from public.debt_terms(v_debt);

  insert into public.debt_payments (debt_id, user_id, amount, paid_on, account_id, note)
  values (p_debt, v_me, p_amount, v_date, p_account, nullif(trim(p_note), ''))
  returning id into v_id;

  if p_account is not null then
    -- Parte de interés de este pago, en la misma proporción que en el total.
    v_interest := case when v_terms.total > 0 then round(p_amount::numeric * v_terms.interest / v_terms.total)::bigint else 0 end;
    v_sign := case when v_debt.direction = 'borrowed' then -1 else 1 end;
    if p_amount - v_interest > 0 then
      insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description, debt_id, debt_payment_id)
      values (v_me, p_account, 'settlement', v_sign * (p_amount - v_interest), v_date,
              case when v_sign < 0 then 'Pago a ' else 'Cobro a ' end || v_debt.person, p_debt, v_id);
    end if;
    if v_interest > 0 then
      insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description, category_id, debt_id, debt_payment_id)
      values (v_me, p_account, case when v_sign < 0 then 'expense'::public.tx_kind else 'income'::public.tx_kind end, v_sign * v_interest, v_date,
              'Intereses · ' || v_debt.person,
              (select id from public.categories where user_id is null and name = case when v_sign < 0 then 'Otros gastos' else 'Otros ingresos' end limit 1),
              p_debt, v_id);
    end if;
  end if;

  perform public.refresh_debt_status(p_debt);
  return v_id;
end;
$$;

create function public.delete_debt_payment(p_payment uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_debt uuid;
begin
  delete from public.debt_payments where id = p_payment and user_id = auth.uid() returning debt_id into v_debt;
  if v_debt is null then raise exception 'not_found'; end if;
  perform public.refresh_debt_status(v_debt);
end;
$$;

-- Permisos: solo usuarios con sesión, y solo lo que la app llama.
revoke execute on function public.months_between(date, date) from public, anon;
revoke execute on function public.debt_terms(public.debts) from public, anon;
revoke execute on function public.refresh_debt_status(uuid) from public, anon, authenticated;
revoke execute on function public.sync_debt_disbursement(uuid) from public, anon, authenticated;
revoke execute on function public.check_debt_account(uuid, char) from public, anon, authenticated;
revoke execute on function public.save_debt(uuid, text, text, bigint, char, date, numeric, text, int, text, date, uuid, text) from public, anon;
revoke execute on function public.delete_debt(uuid) from public, anon;
revoke execute on function public.record_debt_payment(uuid, bigint, date, uuid, text) from public, anon;
revoke execute on function public.delete_debt_payment(uuid) from public, anon;
grant execute on function public.months_between(date, date) to authenticated;
grant execute on function public.debt_terms(public.debts) to authenticated;
grant execute on function public.save_debt(uuid, text, text, bigint, char, date, numeric, text, int, text, date, uuid, text) to authenticated;
grant execute on function public.delete_debt(uuid) to authenticated;
grant execute on function public.record_debt_payment(uuid, bigint, date, uuid, text) to authenticated;
grant execute on function public.delete_debt_payment(uuid) to authenticated;
revoke all on public.debts, public.debt_payments from anon;
