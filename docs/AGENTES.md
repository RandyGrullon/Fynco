# Fynco para agentes (otro chat de Claude conectado a la base)

Guía para un agente con acceso SQL a la base de Fynco (por ejemplo, un chat de Claude con el **conector de Supabase** usando `execute_sql`, o el SQL Editor de Supabase). Con estas recetas el agente registra datos **igual que la app**: los saldos, las estadísticas y los avisos de pago quedan bien.

Proyecto de Supabase: `htgouhbriofyhbeacamj`.

## Reglas

1. **Todo en centavos** (`bigint`): RD$ 1,250.50 = `125050`.
2. **Signo de los movimientos** (`transactions.amount`): ingreso positivo, gasto negativo. `kind` es `income` o `expense` (las transferencias y pagos de tarjeta se crean con funciones, nunca a mano).
3. **Tarjetas de crédito** (`accounts.type = 'credit'`): el saldo negativo es la deuda. Lo que se compra con la tarjeta es un **gasto en la cuenta de la tarjeta**: sube su deuda y **no toca el banco**. El dinero sale de una cuenta solo cuando se registra el pago (`pay_card`).
4. Marca lo que crees con `source = 'assistant'`.
5. Solo datos del usuario que te lo pidió. No borres nada sin que lo confirme.
6. Antes de escribir, consulta las cuentas y categorías para usar sus `id`. Después, vuelve a consultar los saldos para confirmar.

## Paso 0: actuar a nombre del usuario

Las funciones de Fynco usan `auth.uid()`. Conectado como administrador, ese valor está vacío: ponlo **al inicio de cada ejecución**, en la misma llamada que el resto del SQL:

```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'CORREO_DEL_USUARIO'), false);
```

## Consultar

```sql
-- Cuentas con su saldo (en las tarjetas, negativo = deuda)
select a.id, a.name, a.type, a.currency, a.last4, a.statement_day, a.payment_due_day,
       a.credit_limit / 100.0 as limite, b.balance / 100.0 as saldo
  from accounts a join account_balances b on b.account_id = a.id
 where a.user_id = auth.uid() and a.archived_at is null
 order by a.is_default desc, a.created_at;

-- Categorías (las del sistema y las del usuario)
select id, name, kind from categories where user_id is null or user_id = auth.uid() order by kind, sort;

-- Últimos movimientos
select occurred_on, description, amount / 100.0 as monto, kind, account_id
  from transactions where user_id = auth.uid() order by occurred_on desc, created_at desc limit 30;
```

## Registrar

```sql
-- Gasto (también un consumo con tarjeta: account_id = la tarjeta)
insert into transactions (user_id, account_id, kind, amount, occurred_on, description, category_id, source)
values (auth.uid(), 'ID_CUENTA', 'expense', -125050, '2026-10-14', 'Supermercado Nacional', 'ID_CATEGORIA', 'assistant');

-- Ingreso
insert into transactions (user_id, account_id, kind, amount, occurred_on, description, category_id, source)
values (auth.uid(), 'ID_CUENTA', 'income', 9500000, '2026-10-15', 'Salario', 'ID_CATEGORIA', 'assistant');

-- "De la tarjeta llevo consumido tanto": deja la deuda en ese monto. No toca ninguna otra cuenta.
-- Si es más, la diferencia queda como "Consumos sin detallar"; si es menos, se corrige sin inventar un ingreso.
select set_card_debt('ID_TARJETA', 1250000);             -- devuelve 'expense', 'opening' o 'none'

-- Tarjeta pagada: transferencia desde la cuenta con que se pagó (sale de esa cuenta ahora).
select pay_card('ID_TARJETA', 'ID_CUENTA_ORIGEN');                        -- toda la deuda, hoy
select pay_card('ID_TARJETA', 'ID_CUENTA_ORIGEN', 500000, '2026-10-09');  -- un monto y fecha

-- Transferencia entre cuentas propias (misma moneda; si son distintas, el 4.º valor es lo que llegó)
select create_transfer('ID_ORIGEN', 'ID_DESTINO', 1000000, null, '2026-10-14', 'Ahorro');

-- Crear una tarjeta (deuda inicial negativa; días de corte y pago; límite)
insert into accounts (user_id, name, type, currency, opening_balance, institution, last4, statement_day, payment_due_day, credit_limit)
values (auth.uid(), 'Visa IKEA Popular', 'credit', 'DOP', -3664078, 'Popular', '5263', 14, 9, 6500000);
```

## Deudas y préstamos con personas

Se manejan solo con funciones (las tablas `debts` y `debt_payments` son de solo lectura). El interés es simple; las cuotas y el total los calcula `debt_terms`.

```sql
-- Me prestaron 30,000 al 5% mensual, 6 cuotas mensuales desde el 13 nov; entró al Popular.
-- direction: 'borrowed' (me prestaron) o 'lent' (presté). interest_period: 'none', 'monthly', 'annual' o 'total'.
-- frequency: 'once' (un solo pago; installments = 1), 'weekly', 'biweekly' o 'monthly'. La cuenta es opcional (null).
select save_debt(null, 'borrowed', 'María', 3000000, 'DOP', '2026-10-13', 5, 'monthly', 6, 'monthly', '2026-11-13', 'ID_CUENTA', 'Para el carro');

-- Pago (o cobro, si prestaste). Con cuenta: el capital no cuenta en estadísticas y el interés sí.
select record_debt_payment('ID_DEUDA', 650000, '2026-11-13', 'ID_CUENTA');

-- Lo que falta y la próxima cuota
select d.person, d.direction, t.total / 100.0 as total, coalesce(sum(p.amount), 0) / 100.0 as pagado, t.last_due_on
  from debts d cross join lateral debt_terms(d) t left join debt_payments p on p.debt_id = d.id
 where d.user_id = auth.uid() and d.closed_at is null
 group by d.id, t.total, t.last_due_on;

-- Editar (mismos parámetros con el id) o borrar (borra también sus pagos y movimientos)
select delete_debt('ID_DEUDA');
select delete_debt_payment('ID_PAGO');
```

## Errores que puede devolver

| Código | Qué significa |
|---|---|
| `not_authenticated` | Falta el paso 0 |
| `invalid_account` | La cuenta no existe o no es del usuario |
| `not_a_card` | Esa cuenta no es una tarjeta de crédito |
| `nothing_to_pay` | La tarjeta no tiene deuda (pasa un monto) |
| `card_currency_mismatch` | La cuenta y la tarjeta están en monedas distintas (usa `create_transfer` con el monto que llegó) |
| `invalid_amount` | Monto vacío, cero o negativo |
| `debt_currency_mismatch` | La cuenta está en otra moneda que la deuda |
| `not_found` | La deuda o el pago no existe o no es del usuario |

La app muestra los cambios al volver a abrirla o al deslizar hacia abajo para recargar.

## Antes de empezar

En Supabase → SQL Editor deben estar corridos, en orden, todos los archivos de `supabase/migrations/` (incluye `pay_card`, `set_card_debt` y las deudas con personas).
