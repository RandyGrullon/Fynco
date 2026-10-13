-- Tarjetas: pagar y poner al día lo consumido. Las usa la app y también cualquier agente
-- conectado a la base (ver docs/AGENTES.md). Montos en centavos.
--
-- Lo que se consume con la tarjeta solo sube la deuda de la tarjeta; el dinero sale de una
-- cuenta únicamente cuando se registra el pago (pay_card), en la fecha que se indique.

-- Pagar una tarjeta desde otra cuenta. p_amount null = toda la deuda actual.
-- Es una transferencia: no cuenta como gasto (el gasto ya se contó al consumir).
create function public.pay_card(
  p_card uuid,
  p_from uuid,
  p_amount bigint default null,
  p_occurred_on date default current_date,
  p_description text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_card public.accounts;
  v_from public.accounts;
  v_amount bigint;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  select * into v_card from public.accounts where id = p_card and user_id = v_me;
  select * into v_from from public.accounts where id = p_from and user_id = v_me;
  if v_card.id is null or v_from.id is null then raise exception 'invalid_account'; end if;
  if v_card.type <> 'credit' then raise exception 'not_a_card'; end if;
  if v_from.id = v_card.id then raise exception 'same_account'; end if;
  if v_from.currency <> v_card.currency then raise exception 'card_currency_mismatch'; end if;

  v_amount := coalesce(p_amount, (select greatest(0, -b.balance) from public.account_balances b where b.account_id = p_card));
  if v_amount is null or v_amount <= 0 then raise exception 'nothing_to_pay'; end if;

  return public.create_transfer(
    p_from, p_card, v_amount, null,
    coalesce(p_occurred_on, current_date),
    coalesce(nullif(trim(p_description), ''), 'Pago ' || v_card.name)
  );
end;
$$;

-- Dejar la deuda de una tarjeta en p_debt (lo que el banco dice que se debe hoy).
-- Si es más de lo que hay en Fynco, la diferencia se registra como consumo ("Consumos sin
-- detallar"); si es menos, se corrige el saldo inicial para no inventar un ingreso.
-- Devuelve 'expense', 'opening' o 'none'.
create function public.set_card_debt(
  p_card uuid,
  p_debt bigint,
  p_occurred_on date default current_date
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_card public.accounts;
  v_current bigint;
  v_diff bigint;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_debt is null or p_debt < 0 then raise exception 'invalid_amount'; end if;
  select * into v_card from public.accounts where id = p_card and user_id = v_me for update;
  if v_card.id is null then raise exception 'invalid_account'; end if;
  if v_card.type <> 'credit' then raise exception 'not_a_card'; end if;

  -- Deuda actual con signo (negativa si hay saldo a favor).
  select -b.balance into v_current from public.account_balances b where b.account_id = p_card;
  v_diff := p_debt - coalesce(v_current, -v_card.opening_balance);
  if v_diff = 0 then return 'none'; end if;

  if v_diff > 0 then
    insert into public.transactions (user_id, account_id, kind, amount, occurred_on, description)
    values (v_me, p_card, 'expense', -v_diff, coalesce(p_occurred_on, current_date), 'Consumos sin detallar');
    return 'expense';
  end if;

  update public.accounts set opening_balance = opening_balance - v_diff where id = p_card;
  return 'opening';
end;
$$;

revoke execute on function public.pay_card(uuid, uuid, bigint, date, text) from public, anon;
revoke execute on function public.set_card_debt(uuid, bigint, date) from public, anon;
grant execute on function public.pay_card(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.set_card_debt(uuid, bigint, date) to authenticated;
