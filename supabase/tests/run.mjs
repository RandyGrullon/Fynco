// Prueba la migración en un Postgres en memoria (PGlite) imitando Supabase:
// roles anon/authenticated, auth.users, auth.uid() y RLS.
// Uso: npm run test:db
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

const db = new PGlite({ extensions: { pgcrypto } });

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz default now(),
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

let failures = 0;
let passed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  }
}

async function as(userId, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
async function fails(sql, params) {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e.message;
  }
}

await db.exec(SUPABASE_STUB);
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  console.log(`migración aplicada: ${file}`);
}

const RANDY = '00000000-0000-0000-0000-00000000000a';
const ANA = '00000000-0000-0000-0000-00000000000b';
const LUIS = '00000000-0000-0000-0000-00000000000c';
const EXTRA = '00000000-0000-0000-0000-00000000000d';
const ZOE = '00000000-0000-0000-0000-00000000000e';

console.log('\nAlta de usuarios');
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
  ($1, 'randy@example.com', '{"full_name":"Randy"}'),
  ($2, 'ana@example.com', '{"full_name":"Ana"}')`, [RANDY, ANA]);
const randyProfile = await one(`select * from profiles where id = $1`, [RANDY]);
check('perfil creado con nombre', randyProfile?.display_name === 'Randy');
const cash = await one(`select * from accounts where user_id = $1`, [RANDY]);
check('cuenta Efectivo por defecto', cash?.name === 'Efectivo' && cash?.is_default === true);

console.log('\nCartera');
const income = await one(`select id from categories where user_id is null and name = 'Salario'`);
const food = await one(`select id from categories where user_id is null and name = 'Comida'`);
const travel = await one(`select id from categories where user_id is null and name = 'Viajes'`);
let popular;
await as(RANDY, async () => {
  popular = await one(`insert into accounts (name, type, opening_balance) values ('Popular', 'checking', 1000000) returning *`);
  check('user_id por defecto = auth.uid()', popular.user_id === RANDY);
  await q(`insert into transactions (account_id, kind, amount, category_id, description) values ($1, 'income', 9500000, $2, 'Salario')`, [popular.id, income.id]);
  await q(`insert into transactions (account_id, kind, amount, category_id, description) values ($1, 'expense', -342000, $2, 'Supermercado')`, [popular.id, food.id]);
  const bal = await one(`select balance from account_balances where account_id = $1`, [popular.id]);
  check('saldo = inicial + libro', Number(bal.balance) === 1000000 + 9500000 - 342000, bal);

  const badSign = await fails(`insert into transactions (account_id, kind, amount) values ($1, 'expense', 500)`, [popular.id]);
  check('gasto con signo positivo rechazado', badSign !== null);
  const directTransfer = await fails(`insert into transactions (account_id, kind, amount) values ($1, 'transfer', -500)`, [popular.id]);
  check('transferencia directa sin RPC rechazada', directTransfer !== null);

  const tid = (await one(`select create_transfer($1, $2, 200000, null, current_date, 'Ahorro') as id`, [popular.id, cash.id])).id;
  const legs = await q(`select amount from transactions where transfer_id = $1 order by amount`, [tid]);
  check('transferencia crea dos patas', legs.length === 2 && Number(legs[0].amount) === -200000 && Number(legs[1].amount) === 200000, legs);
  await q(`delete from transactions where transfer_id = $1 and amount > 0`, [tid]);
  const left = await q(`select id from transactions where transfer_id = $1`, [tid]);
  check('borrar una pata borra la otra', left.length === 0, left);
});

await as(ANA, async () => {
  const seen = await q(`select * from accounts where user_id = $1`, [RANDY]);
  check('Ana no ve las cuentas de Randy', seen.length === 0);
  const steal = await fails(`insert into transactions (account_id, kind, amount) values ($1, 'expense', -100)`, [popular.id]);
  check('Ana no puede escribir en la cuenta de Randy', steal !== null);
  const pinRead = await fails(`select * from user_secrets`);
  const pinRows = pinRead === null ? await q(`select * from user_secrets`) : [];
  check('user_secrets inaccesible', pinRead !== null || pinRows.length === 0);
});

console.log('\nCompartido');
let groupId, members, code;
await as(RANDY, async () => {
  groupId = (await one(`select create_group('Viaje a Samaná', 'DOP', 'group', $1::jsonb) as id`, [
    JSON.stringify([
      { display_name: 'Ana', email: 'ana@example.com' },
      { display_name: 'Luis', email: 'luis@example.com' },
      { display_name: 'Carla' },
    ]),
  ])).id;
  members = Object.fromEntries((await q(`select id, display_name, profile_id from group_members where group_id = $1`, [groupId])).map((m) => [m.display_name, m]));
  check('Randy es miembro dueño', members.Randy?.profile_id === RANDY);
  check('Ana queda como invitada hasta aceptar (no se vincula sola)', members.Ana && members.Ana.profile_id === null);
  check('Luis invitado sin cuenta', members.Luis && members.Luis.profile_id === null);
  code = (await one(`select invite_code from groups where id = $1`, [groupId])).invite_code;

  const share = (n) => Math.floor(n / 4);
  const equal = (total) => {
    const base = share(total);
    const rest = total - base * 4;
    return ['Randy', 'Ana', 'Luis', 'Carla'].map((n, i) => ({ member_id: members[n].id, amount: base + (i < rest ? 1 : 0) }));
  };

  const villa = (await one(
    `select save_shared_expense(null, $1, 'Villa en Las Terrenas', 840000, current_date, $2, 'equal', $3::jsonb, $4::jsonb, $5) as id`,
    [groupId, travel.id, JSON.stringify([{ member_id: members.Randy.id, amount: 840000 }]), JSON.stringify(equal(840000)), popular.id],
  )).id;
  const myTx = await one(`select * from transactions where shared_expense_id = $1`, [villa]);
  check('pagar gasto compartido mueve tu cuenta (kind shared)', myTx?.kind === 'shared' && Number(myTx.amount) === -840000, myTx);

  const mismatch = await fails(
    `select save_shared_expense(null, $1, 'Mal', 1000, current_date, null, 'equal', $2::jsonb, $3::jsonb)`,
    [groupId, JSON.stringify([{ member_id: members.Randy.id, amount: 1000 }]), JSON.stringify([{ member_id: members.Ana.id, amount: 999 }])],
  );
  check('partes que no suman el total se rechazan', mismatch?.includes('shares_sum_mismatch'), mismatch);

  await one(
    `select save_shared_expense(null, $1, 'Cena en El Limón', 715000, current_date, $2, 'equal', $3::jsonb, $4::jsonb) as id`,
    [groupId, food.id, JSON.stringify([{ member_id: members.Carla.id, amount: 715000 }]), JSON.stringify(equal(715000))],
  );
});

await as(ANA, async () => {
  const before = await q(`select * from groups where id = $1`, [groupId]);
  check('Ana no ve el grupo antes de aceptar', before.length === 0);
  const invites = await q(`select * from my_pending_invites()`);
  check('Ana ve su invitación pendiente', invites.length === 1 && invites[0].group_name === 'Viaje a Samaná', invites);
  await q(`select accept_invite($1)`, [invites[0].member_id]);
  const g = await q(`select * from groups where id = $1`, [groupId]);
  check('Ana ve el grupo tras aceptar', g.length === 1);
  const anaCash = await one(`select id from accounts where user_id = $1`, [ANA]);
  const sup = (await one(
    `select save_shared_expense(null, $1, 'Supermercado', 500000, current_date, $2, 'exact', $3::jsonb, $4::jsonb, $5) as id`,
    [groupId, food.id, JSON.stringify([{ member_id: members.Ana.id, amount: 500000 }]),
      JSON.stringify([
        { member_id: members.Randy.id, amount: 125000 },
        { member_id: members.Ana.id, amount: 125000 },
        { member_id: members.Luis.id, amount: 125000 },
        { member_id: members.Carla.id, amount: 125000 },
      ]), anaCash.id],
  )).id;
  check('Ana registra gasto', !!sup);

  const fullProfile = await q(`select * from profiles where id = $1`, [RANDY]);
  check('Ana no lee el perfil completo de Randy', fullProfile.length === 0);
  const pub = await one(`select * from member_profiles where id = $1`, [RANDY]);
  check('Ana ve nombre y correo de Randy (comparten grupo)', pub?.display_name === 'Randy' && pub.hide_amounts === undefined, pub);

  const hijack = await fails(`update group_members set profile_id = $1 where id = $2`, [ANA, members.Luis.id]);
  const luis = await one(`select profile_id from group_members where id = $1`, [members.Luis.id]);
  check('no se puede reasignar un miembro directo', hijack !== null || luis.profile_id === null, hijack);
});

const balances = await q(`select m.display_name, b.net from group_member_balances b join group_members m on m.id = b.member_id where b.group_id = $1`, [groupId]);
const net = Object.fromEntries(balances.map((b) => [b.display_name, Number(b.net)]));
check('balances suman cero', Object.values(net).reduce((a, b) => a + b, 0) === 0, net);
check('Randy: pagó 8,400 − su parte 2,100 − cena 1,787.50 − súper 1,250', net.Randy === 840000 - 210000 - 178750 - 125000, net);

console.log('\nSeguridad');
await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'zoe@example.com', null)`, [ZOE]);
await as(RANDY, async () => {
  await q(`select create_group('Prueba', 'DOP', 'group', $1::jsonb)`, [JSON.stringify([{ display_name: 'Zoe', email: 'zoe@example.com' }])]);
  const long = await fails(`select create_group('Nombre largo', 'DOP', 'group', $1::jsonb)`, [JSON.stringify([{ display_name: 'X'.repeat(60) }])]);
  check('nombres largos se recortan en vez de fallar', long === null, long);
});
await as(ZOE, async () => {
  const inv = await q(`select * from my_pending_invites()`);
  check('con correo sin confirmar no hay invitaciones', inv.length === 0, inv);
});
{
  const zoeMember = (await db.query(`select id from group_members where invite_email = 'zoe@example.com'`)).rows[0];
  await as(ZOE, async () => {
    const acc = await fails(`select accept_invite($1)`, [zoeMember.id]);
    check('no se acepta una invitación con correo sin confirmar', acc?.includes('invalid_invite'), acc);
  });
}
await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
const anonRun = await fails(`select process_recurring(null, '2099-12-31')`);
const anonRpc = await fails(`select run_my_recurring(current_date)`);
const anonRead = await fails(`select * from accounts`);
await db.exec(`reset role;`);
check('anon no puede ejecutar process_recurring', anonRun !== null, anonRun);
check('anon no puede llamar RPCs de la app', anonRpc !== null, anonRpc);
check('anon no puede leer tablas', anonRead !== null, anonRead);
await as(ANA, async () => {
  const run = await fails(`select process_recurring($1, '2050-01-01')`, [RANDY]);
  check('un usuario no puede procesar recurrentes de otro', run !== null, run);
  const upd = await fails(`update member_profiles set display_name = 'HACKED' where id = $1`, [RANDY]);
  const del = await fails(`delete from member_profiles where id = $1`, [RANDY]);
  check('member_profiles es de solo lectura (update)', upd !== null, upd);
  check('member_profiles es de solo lectura (delete)', del !== null, del);
});
check('el perfil de Randy sigue intacto', (await one(`select display_name from profiles where id = $1`, [RANDY]))?.display_name === 'Randy');
await as(RANDY, async () => {
  const usd = await one(`insert into accounts (name, type, currency) values ('Dólares', 'savings', 'USD') returning id`);
  const bad = await fails(
    `select save_shared_expense(null, $1, 'Mal moneda', 1000, current_date, null, 'equal', $2::jsonb, $3::jsonb, $4)`,
    [groupId, JSON.stringify([{ member_id: members.Randy.id, amount: 1000 }]), JSON.stringify([{ member_id: members.Randy.id, amount: 1000 }]), usd.id],
  );
  check('no se paga un gasto en DOP con una cuenta en USD', bad?.includes('currency_mismatch'), bad);
});

console.log('\nUnirse con código');
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'luis.otro@example.com', '{"name":"Luis"}')`, [LUIS]);
await as(LUIS, async () => {
  const before = await q(`select * from groups where id = $1`, [groupId]);
  check('Luis no ve el grupo antes de unirse', before.length === 0);
  const preview = (await one(`select group_preview($1) as p`, [code])).p;
  check('vista previa por código', preview?.name === 'Viaje a Samaná' && preview.members.length === 4, preview);
  await q(`select join_group($1, $2)`, [code, members.Luis.id]);
  const after = await one(`select profile_id from group_members where id = $1`, [members.Luis.id]);
  check('Luis ocupa su lugar de invitado', after.profile_id === LUIS);
  const theirBalance = await one(`select net from group_member_balances where member_id = $1`, [members.Luis.id]);
  check('Luis hereda su saldo', Number(theirBalance.net) === -(210000 + 178750 + 125000), theirBalance);
});

console.log('\nPagos');
await as(ANA, async () => {
  const anaCash = await one(`select id from accounts where user_id = $1`, [ANA]);
  await q(`select record_settlement($1, $2, $3, 50000, current_date, $4, 'Transferencia')`, [groupId, members.Ana.id, members.Randy.id, anaCash.id]);
  const tx = await one(`select amount, kind from transactions where user_id = $1 and kind = 'settlement'`, [ANA]);
  check('pago resta de la cuenta de Ana', Number(tx?.amount) === -50000, tx);
});
const afterPay = Number((await one(`select net from group_member_balances where member_id = $1`, [members.Randy.id])).net);
check('pago reduce lo que le deben a Randy', afterPay === net.Randy - 50000, afterPay);

console.log('\nEstadísticas');
await as(RANDY, async () => {
  const rows = await q(`select c.name, s.total from spending_by_category(current_date - 30, current_date) s left join categories c on c.id = s.category_id`);
  const by = Object.fromEntries(rows.map((r) => [r.name, Number(r.total)]));
  check('Viajes cuenta solo tu parte (2,100), no lo que pagaste (8,400)', by.Viajes === 210000, by);
  check('Comida = súper propio + parte cena + parte súper grupo', by.Comida === 342000 + 178750 + 125000, by);
  const flow = await q(`select * from cashflow_by_month(current_date - 30, current_date)`);
  const totalExpense = flow.reduce((a, r) => a + Number(r.expense), 0);
  check('flujo mensual excluye transferencias y pagos de deudas', totalExpense === 342000 + 210000 + 178750 + 125000, flow);
});

console.log('\nRecurrentes');
await as(RANDY, async () => {
  const start = (await one(`select (current_date - interval '75 days')::date as d`)).d;
  const rule = await one(
    `insert into recurring_rules (account_id, kind, amount, description, frequency, start_on, next_run_on) values ($1, 'expense', 65000, 'Netflix', 'monthly', $2, $2) returning *`,
    [popular.id, start],
  );
  check('next_run_on arranca en start_on', String(rule.next_run_on) === String(rule.start_on));
  const n1 = (await one(`select run_my_recurring(current_date) as n`)).n;
  const n2 = (await one(`select run_my_recurring(current_date) as n`)).n;
  const posted = await q(`select occurrence_date from transactions where recurring_rule_id = $1`, [rule.id]);
  check('genera los cobros atrasados (3)', n1 === 3 && posted.length === 3, { n1, posted });
  check('segunda corrida no duplica', n2 === 0);
  await q(`update recurring_rules set frequency = 'weekly' where id = $1`, [rule.id]);
  const n3 = (await one(`select run_my_recurring(current_date) as n`)).n;
  check('cambiar la frecuencia no registra el pasado otra vez', n3 <= 1, n3);
  await q(`update recurring_rules set active = false where id = $1`, [rule.id]);
  await q(`update recurring_rules set active = true, start_on = current_date - 60 where id = $1`, [rule.id]);
  const n4 = (await one(`select run_my_recurring(current_date) as n`)).n;
  check('reanudar con fecha pasada no rellena', n4 <= 1, n4);
});

console.log('\nPIN');
await as(RANDY, async () => {
  const set = (await one(`select set_pin('1234') as r`)).r;
  check('fijar PIN', set.ok === true, set);
  check('has_pin', (await one(`select has_pin() as h`)).h === true);
  check('PIN correcto', (await one(`select verify_pin('1234') as r`)).r.ok === true);
  let last;
  const noCurrent = (await one(`select set_pin('5555') as r`)).r;
  check('cambiar PIN sin el actual no gasta intentos', noCurrent.reason === 'current_required', noCurrent);
  for (let i = 0; i < 5; i++) last = (await one(`select verify_pin('0000') as r`)).r;
  check('el 5.º fallo bloquea y dice hasta cuándo', last.reason === 'locked' && !!last.locked_until, last);
  const locked = (await one(`select verify_pin('1234') as r`)).r;
  check('bloqueado aunque el PIN sea correcto', locked.ok === false && locked.reason === 'locked', locked);
  const change = (await one(`select set_pin('9999', '0000') as r`)).r;
  check('cambiar PIN con PIN incorrecto no pasa', change.ok === false, change);
});

console.log('\nLímite del asistente');
await as(RANDY, async () => {
  let allowed = 0;
  for (let i = 0; i < 45; i++) if ((await one(`select consume_assistant_quota() as ok`)).ok) allowed++;
  check('40 consultas por hora y luego se corta', allowed === 40, allowed);
  const direct = await fails(`insert into assistant_usage (user_id) values ($1)`, [RANDY]);
  const rows = direct === null ? await q(`select * from assistant_usage`) : [];
  check('la tabla de uso no es accesible directo', direct !== null || rows.length === 0);
});

console.log('\nBorrar cuenta');
await db.query(`insert into auth.users (id, email) values ($1, 'extra@example.com')`, [EXTRA]);
await as(EXTRA, async () => {
  await q(`select join_group($1)`, [code]);
});
await as(EXTRA, async () => {
  await q(`select delete_my_account()`);
});
const gone = await q(`select id from profiles where id = $1`, [EXTRA]);
const placeholder = await q(`select profile_id from group_members where group_id = $1 and display_name = 'extra'`, [groupId]);
check('perfil eliminado', gone.length === 0);
check('en el grupo queda como invitado', placeholder.length === 1 && placeholder[0].profile_id === null, placeholder);

await as(RANDY, async () => {
  const del = await fails(`select delete_group($1)`, [groupId]);
  check('no se borra un grupo con historial', del?.includes('group_has_history'), del);
});

await as(RANDY, async () => {
  await q(`update profiles set display_name = 'Randy G.' where id = $1`, [RANDY]);
  const mine = await q(`select display_name from group_members where profile_id = $1`, [RANDY]);
  check('cambiar tu nombre lo actualiza en tus grupos', mine.length > 0 && mine.every((m) => m.display_name === 'Randy G.'), mine);
});

await as(RANDY, async () => {
  const [card] = await q(
    `insert into accounts (name, type, opening_balance, statement_day, payment_due_day) values ('Visa', 'credit', -500000, 15, 5) returning statement_day, payment_due_day`,
  );
  check('tarjeta guarda día de corte y de pago', card.statement_day === 15 && card.payment_due_day === 5, card);
  const bad = await fails(`insert into accounts (name, type, statement_day) values ('Mala', 'credit', 32)`);
  check('día de corte fuera de 1-31 se rechaza', Boolean(bad), bad);
});

// ---------- Pagar tarjetas y poner al día lo consumido ----------
{
  const balance = async (id) => Number((await one(`select balance from account_balances where account_id = $1`, [id])).balance);
  let card, bank, usd, other;
  await as(RANDY, async () => {
    card = (await one(`insert into accounts (name, type, opening_balance) values ('Visa pagos', 'credit', -100000) returning id`)).id;
    bank = (await one(`insert into accounts (name, type, opening_balance) values ('Banco pagos', 'checking', 500000) returning id`)).id;
    usd = (await one(`insert into accounts (name, type, currency, opening_balance) values ('Dólares', 'savings', 'USD', 50000) returning id`)).id;
    // Consumir con la tarjeta solo sube su deuda: el banco no se toca.
    await q(`insert into transactions (account_id, kind, amount, description) values ($1, 'expense', -25000, 'Cena')`, [card]);
    check('consumo con tarjeta no toca el banco', (await balance(card)) === -125000 && (await balance(bank)) === 500000);

    check('set_card_debt sube la deuda como consumo', (await one(`select set_card_debt($1, 150000) r`, [card])).r === 'expense' && (await balance(card)) === -150000);
    const gasto = await one(`select amount, kind, description from transactions where account_id = $1 and description = 'Consumos sin detallar'`, [card]);
    check('la diferencia queda como gasto sin detallar', gasto?.kind === 'expense' && Number(gasto.amount) === -25000, gasto);
    check('set_card_debt baja la deuda sin inventar ingreso', (await one(`select set_card_debt($1, 120000) r`, [card])).r === 'opening' && (await balance(card)) === -120000);
    const ingresos = await one(`select count(*)::int n from transactions where account_id = $1 and kind = 'income'`, [card]);
    check('no hay ingresos en la tarjeta', ingresos.n === 0);
    check('set_card_debt igual no hace nada', (await one(`select set_card_debt($1, 120000) r`, [card])).r === 'none');

    const parcial = await one(`select pay_card($1, $2, 20000, '2026-10-10') id`, [card, bank]);
    check('pago parcial: transferencia del banco a la tarjeta', Boolean(parcial.id) && (await balance(card)) === -100000 && (await balance(bank)) === 480000);
    await one(`select pay_card($1, $2) id`, [card, bank]);
    check('pago total deja la tarjeta en cero', (await balance(card)) === 0 && (await balance(bank)) === 380000);
    const legs = await one(`select count(*)::int n, min(description) d from transactions where transfer_id = $1`, [parcial.id]);
    check('el pago son dos patas con descripción', legs.n === 2 && legs.d === 'Pago Visa pagos', legs);

    check('sin deuda no hay nada que pagar', (await fails(`select pay_card($1, $2)`, [card, bank]))?.includes('nothing_to_pay'));
    check('monedas distintas se rechazan', (await fails(`select pay_card($1, $2, 1000)`, [card, usd]))?.includes('card_currency_mismatch'));
    check('solo tarjetas', (await fails(`select pay_card($1, $2, 1000)`, [bank, card]))?.includes('not_a_card'));
  });
  await db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ee', 'otro.pagos@example.com')`);
  await as('00000000-0000-0000-0000-0000000000ee', async () => {
    other = await fails(`select pay_card($1, $2, 1000)`, [card, bank]);
    check('nadie más paga tus tarjetas', other?.includes('invalid_account'), other);
    check('nadie más cambia tu deuda', (await fails(`select set_card_debt($1, 1)`, [card]))?.includes('invalid_account'));
  });
  await db.exec(`set role anon`);
  const anon = await fails(`select pay_card($1, $2, 1000)`, [card, bank]);
  await db.exec(`reset role`);
  check('anon no puede pagar', Boolean(anon), anon);

  // Un agente conectado como administrador (p. ej. otro chat con el conector de Supabase):
  // primero dice a nombre de quién actúa, como en docs/AGENTES.md.
  await db.exec(`select set_config('request.jwt.claim.sub', (select id::text from auth.users where id = '${RANDY}'), false)`);
  const agent = await one(`select set_card_debt($1, 30000) r`, [card]);
  await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  check('un agente puede actuar a nombre del usuario', agent.r === 'expense' && (await balance(card)) === -30000, agent);
}

// ---------- Deudas y préstamos entre personas ----------
{
  const balance = async (id) => Number((await one(`select balance from account_balances where account_id = $1`, [id])).balance);
  let bank, debt, lent, pay1;
  await as(RANDY, async () => {
    bank = (await one(`insert into accounts (name, type, opening_balance) values ('Banco deudas', 'checking', 100000) returning id`)).id;
    const ingresosAntes = Number((await one(`select coalesce(sum(income), 0)::bigint i from cashflow_by_month('2026-10-01', '2026-10-31')`)).i);
    // Me prestaron 20,000 al 10% mensual, 4 cuotas mensuales desde el 15 nov.
    debt = (await one(
      `select save_debt(null, 'borrowed', 'Juan', 2000000, 'DOP', '2026-10-15', 10, 'monthly', 4, 'monthly', '2026-11-15', $1) id`,
      [bank],
    )).id;
    const terms = await one(`select t.* from debts d, debt_terms(d) t where d.id = $1`, [debt]);
    check('4 meses al 10% = 8,000 de interés', Number(terms.interest) === 800000 && Number(terms.total) === 2800000 && String(terms.last_due_on).startsWith('2027-02-15') || terms.last_due_on?.toISOString?.().startsWith('2027-02-15'), terms);
    check('el préstamo entra a la cuenta', (await balance(bank)) === 2100000);
    const flujo0 = await one(`select coalesce(sum(income), 0)::bigint i from cashflow_by_month('2026-10-01', '2026-10-31')`);
    check('el préstamo no cuenta como ingreso', Number(flujo0.i) === ingresosAntes, { antes: ingresosAntes, despues: flujo0.i });

    pay1 = (await one(`select record_debt_payment($1, 700000, '2026-11-15', $2) id`, [debt, bank])).id;
    const rows = await q(`select kind, amount from transactions where debt_payment_id = $1 order by kind`, [pay1]);
    check('el pago se divide en capital e interés', rows.length === 2 && rows.some((r) => r.kind === 'settlement' && Number(r.amount) === -500000) && rows.some((r) => r.kind === 'expense' && Number(r.amount) === -200000), rows);
    check('el pago sale de la cuenta', (await balance(bank)) === 1400000);
    const flujo1 = await one(`select coalesce(sum(expense), 0)::bigint e from cashflow_by_month('2026-11-01', '2026-11-30')`);
    check('solo el interés cuenta como gasto', Number(flujo1.e) === 200000, flujo1);

    check('aún no está saldada', (await one(`select closed_at from debts where id = $1`, [debt])).closed_at === null);
    await one(`select record_debt_payment($1, 2100000, '2027-02-15') id`, [debt]);
    check('pagada completa se cierra', (await one(`select closed_at from debts where id = $1`, [debt])).closed_at !== null);
    await one(`select delete_debt_payment($1)`, [pay1]);
    check('borrar un pago la reabre y devuelve el dinero', (await one(`select closed_at from debts where id = $1`, [debt])).closed_at === null && (await balance(bank)) === 2100000);

    // Presté 5,000 sin interés, un solo pago.
    lent = (await one(`select save_debt(null, 'lent', 'Ana', 500000, 'DOP', '2026-10-01', 0, 'none', 1, 'once', '2026-10-31', $1) id`, [bank])).id;
    check('lo prestado sale de la cuenta', (await balance(bank)) === 1600000);
    await one(`select record_debt_payment($1, 500000, '2026-10-30', $2)`, [lent, bank]);
    check('el cobro vuelve a la cuenta y la cierra', (await balance(bank)) === 2100000 && (await one(`select closed_at from debts where id = $1`, [lent])).closed_at !== null);

    // Editar: cambiar el monto mueve el movimiento inicial.
    await one(`select save_debt($1, 'lent', 'Ana', 600000, 'DOP', '2026-10-01', 0, 'none', 1, 'once', '2026-10-31', $2)`, [lent, bank]);
    check('editar el monto ajusta la cuenta y la reabre', (await balance(bank)) === 2000000 && (await one(`select closed_at from debts where id = $1`, [lent])).closed_at === null);

    check('no se editan a mano los movimientos de una deuda', (await q(`update transactions set amount = -1 where debt_id = $1 returning id`, [debt])).length === 0);
    check('ni se borran a mano', (await q(`delete from transactions where debt_id = $1 returning id`, [debt])).length === 0);
    check('ni se crean deudas sin la función', Boolean(await fails(`insert into debts (direction, person, principal, first_due_on) values ('lent', 'X', 1, current_date)`)));
    check('monedas distintas se rechazan', (await fails(`select save_debt(null, 'lent', 'Y', 100, 'USD', current_date, 0, 'none', 1, 'once', current_date, $1)`, [bank]))?.includes('debt_currency_mismatch'));
  });
  await as(ANA, async () => {
    check('nadie más ve tus deudas', (await q(`select id from debts where id in ($1, $2)`, [debt, lent])).length === 0);
    check('nadie más paga tus deudas', (await fails(`select record_debt_payment($1, 100)`, [debt]))?.includes('not_found'));
  });
  await as(RANDY, async () => {
    await one(`select delete_debt($1)`, [lent]);
    check('borrar la deuda devuelve el dinero', (await balance(bank)) === 2100000);
  });
}

// ---------- Plan: cuentas, recurrentes de transferencia, ajustes y periodos ----------
{
  const balance = async (id) => Number((await one(`select balance from account_balances where account_id = $1`, [id])).balance);
  let bank, deuda, card, usd, anaAcc;
  await as(RANDY, async () => {
    bank = (await one(`insert into accounts (name, type, opening_balance) values ('Plan banco', 'checking', 10000000) returning id`)).id;
    deuda = (await one(`insert into accounts (name, type, opening_balance) values ('Deuda papi', 'other', -11060000) returning id`)).id;
    usd = (await one(`insert into accounts (name, type, currency) values ('Plan USD', 'savings', 'USD') returning id`)).id;
    card = (await one(`insert into accounts (name, type, statement_day, payment_due_day, pay_day, pay_from_account_id) values ('Plan Visa', 'credit', 13, 9, 4, $1) returning id`, [bank])).id;
    check('tarjeta con día de pago y cuenta desde donde se paga', Boolean(card));

    check('reserved solo en cuentas other', Boolean(await fails(`insert into accounts (name, type, reserved) values ('Mal', 'checking', true)`)));
    const res = await one(`insert into accounts (name, type, opening_balance, reserved) values ('Préstamo embajada', 'other', -10000000, true) returning reserved`);
    check('una cuenta other puede ser prestado', res.reserved === true);
    check('pay_day fuera de 1-31 se rechaza', Boolean(await fails(`update accounts set pay_day = 32 where id = $1`, [card])));
    check('no se paga desde sí misma', Boolean(await fails(`update accounts set pay_from_account_id = id where id = $1`, [card])));
  });
  await as(ANA, async () => {
    anaAcc = (await one(`insert into accounts (name, type) values ('Cuenta de Ana plan', 'checking') returning id`)).id;
  });
  await as(RANDY, async () => {
    check('no se paga desde la cuenta de otra persona', (await fails(`update accounts set pay_from_account_id = $1 where id = $2`, [anaAcc, card]))?.includes('invalid_account'));

    // Cuota planificada: transferencia de una sola vez el 16 oct, y otra mensual desde el 1 oct.
    await q(
      `insert into recurring_rules (account_id, to_account_id, kind, amount, description, frequency, start_on, end_on, next_run_on)
       values ($1, $2, 'transfer', 1000000, 'Cuota papi', 'monthly', '2026-10-16', '2026-10-16', '2026-10-16')`,
      [bank, deuda],
    );
    check('transferencia recurrente sin destino se rechaza', Boolean(await fails(`insert into recurring_rules (account_id, kind, amount, description, frequency, start_on, next_run_on) values ($1, 'transfer', 100, 'x', 'monthly', '2026-10-01', '2026-10-01')`, [bank])));
    check('destino en otra moneda se rechaza', (await fails(`insert into recurring_rules (account_id, to_account_id, kind, amount, description, frequency, start_on, next_run_on) values ($1, $2, 'transfer', 100, 'x', 'monthly', '2026-10-01', '2026-10-01')`, [bank, usd]))?.includes('transfer_currency_mismatch'));
    check('destino de otra persona se rechaza', Boolean(await fails(`insert into recurring_rules (account_id, to_account_id, kind, amount, description, frequency, start_on, next_run_on) values ($1, $2, 'transfer', 100, 'x', 'monthly', '2026-10-01', '2026-10-01')`, [bank, anaAcc])));
  });
  await q(`select process_recurring($1, '2026-10-20')`, [RANDY]);
  await q(`select process_recurring($1, '2026-10-21')`, [RANDY]);
  const legs = await q(`select t.amount, t.account_id, t.transfer_id from transactions t where t.description = 'Cuota papi' order by t.amount`);
  check('la cuota crea dos patas con el mismo transfer_id', legs.length === 2 && legs[0].transfer_id === legs[1].transfer_id && Number(legs[0].amount) === -1000000, legs);
  check('correr dos veces no duplica', legs.length === 2);
  await as(RANDY, async () => {
    check('la cuota sale del banco y baja la deuda', (await balance(bank)) === 9000000 && (await balance(deuda)) === -10060000);
    const rule = await one(`select active from recurring_rules where description = 'Cuota papi'`);
    check('la de una sola vez queda inactiva', rule.active === false);

    // Ajustes y periodos: solo de su dueño.
    await q(`insert into plan_settings (monthly_budget, cushion, budget_account_id, rates, excluded_category_ids) values (3500000, 500000, $1, '{"USD": 62, "EUR": 69}', '{}')`, [card]);
    check('guarda los ajustes del plan', Number((await one(`select monthly_budget from plan_settings`)).monthly_budget) === 3500000);
    check('cuenta del día a día de otra persona se rechaza', Boolean(await fails(`update plan_settings set budget_account_id = $1`, [anaAcc])));
    await q(`insert into plan_periods (name, start_on, end_on, budget, currency, cash_amount, account_id) values ('Viaje', '2026-11-29', '2027-01-09', 130000, 'EUR', 30000, $1)`, [card]);
    check('periodo con efectivo mayor que el presupuesto se rechaza', Boolean(await fails(`insert into plan_periods (name, start_on, end_on, budget, cash_amount) values ('x', '2026-01-01', '2026-01-02', 100, 200)`)));
    check('periodo que termina antes de empezar se rechaza', Boolean(await fails(`insert into plan_periods (name, start_on, end_on, budget) values ('x', '2026-01-02', '2026-01-01', 100)`)));
    const shares = await q(`select * from my_shared_shares('2000-01-01', '2100-01-01')`);
    check('tu parte de lo compartido por día', shares.length > 0 && shares.every((s) => Number(s.amount) > 0), shares.length);
  });
  await as(ANA, async () => {
    check('nadie más ve tus ajustes del plan', (await q(`select * from plan_settings where user_id = $1`, [RANDY])).length === 0);
    check('nadie más ve tus periodos', (await q(`select * from plan_periods where user_id = $1`, [RANDY])).length === 0);
    check('nadie más cambia tus periodos', (await q(`update plan_periods set budget = 1 where user_id = $1 returning id`, [RANDY])).length === 0);
  });
  await db.exec(`set role anon`);
  const anonPlan = await fails(`select * from plan_settings`);
  await db.exec(`reset role`);
  check('anon no lee los ajustes del plan', Boolean(anonPlan), anonPlan);
}

// ---------- Nuevo Fynco: plan versionado, historial, memoria, chat y archivo ----------
{
  console.log('\nMis finanzas');
  await as(RANDY, async () => {
    const v1 = await one(`select pf_guardar_estado('{"cuentas": [], "a": 1}', 0, 'Plan inicial', 'semilla') as v`);
    check('crea el plan en la versión 1', v1.v === 1, v1);
    check('crear de nuevo con versión 0 choca', Boolean(await fails(`select pf_guardar_estado('{"a": 9}', 0, 'otra', 'manual')`)));
    const v2 = await one(`select pf_guardar_estado('{"a": 2}', 1, 'Gasto', 'chat', '["+1 movimiento"]') as v`);
    check('guardar sube la versión', v2.v === 2, v2);
    check('versión vieja se rechaza (no pisa cambios)', Boolean(await fails(`select pf_guardar_estado('{"a": 3}', 1, 'viejo', 'chat')`)));
    check('datos que no son objeto se rechazan', Boolean(await fails(`select pf_guardar_estado('[1]', 2, 'x', 'chat')`)));
    check('cada versión queda en el historial', (await q(`select version from pf_historial order by version`)).map((r) => r.version).join() === '1,2');
    check('no se puede escribir el plan directo', Boolean(await fails(`update pf_estado set version = 99`)) || (await q(`update pf_estado set version = 99 returning 1`)).length === 0);
    check('no se puede borrar el historial', Boolean(await fails(`delete from pf_historial`)));

    const r = await one(`select pf_restaurar(1) as v`);
    const st = await one(`select datos, version from pf_estado`);
    check('restaurar crea una versión nueva con lo viejo', r.v === 3 && st.datos.a === 1 && st.version === 3, st);

    // Deshacer desde el chat
    const v4 = (await one(`select pf_guardar_estado('{"a": 4}', 3, 'Pádel', 'chat') as v`)).v;
    const msg = await one(`insert into pf_chat (rol, texto, cambios) values ('assistant', 'Listo', $1) returning id`, [{ version_antes: 3, version_despues: v4 }]);
    const v5 = (await one(`select pf_deshacer($1) as v`, [msg.id])).v;
    check('deshacer vuelve a la versión anterior', v5 === 5 && (await one(`select datos from pf_estado`)).datos.a === 1);
    check('no se deshace dos veces', Boolean(await fails(`select pf_deshacer($1)`, [msg.id])));
    await q(`select pf_guardar_estado('{"a": 6}', 5, 'Otro', 'chat')`);
    const msg2 = await one(`insert into pf_chat (rol, texto, cambios) values ('assistant', 'x', $1) returning id`, [{ version_antes: 5, version_despues: 6 }]);
    await q(`select pf_guardar_estado('{"a": 7}', 6, 'Después', 'manual')`);
    check('si hubo cambios después, no deshace a ciegas', Boolean(await fails(`select pf_deshacer($1)`, [msg2.id])));
    check('el chat no se edita', Boolean(await fails(`update pf_chat set texto = 'otro'`)));
    check('el chat no se borra', Boolean(await fails(`delete from pf_chat`)));
    check('no puede insertar un chat ya deshecho', Boolean(await fails(`insert into pf_chat (rol, texto, deshecho_en) values ('user', 'x', now())`)));

    // Memoria: se edita y se archiva, no se borra.
    const n = await one(`insert into pf_memoria (tema, texto, origen) values ('Tarjetas', 'IKEA corta el 13', 'semilla') returning id`);
    await q(`update pf_memoria set texto = 'IKEA corta el 13 y se paga el 4', actualizado = now() where id = $1`, [n.id]);
    check('la memoria se edita', (await one(`select texto from pf_memoria where id = $1`, [n.id])).texto.includes('el 4'));
    check('la memoria no se borra', Boolean(await fails(`delete from pf_memoria where id = $1`, [n.id])));
    check('la memoria no cambia de dueño', Boolean(await fails(`update pf_memoria set user_id = $1 where id = $2`, [ANA, n.id])));

    // Archivo con búsqueda
    await q(`insert into pf_archivo (fuente, n, quien, fecha, texto) values
      ('claude-2026-10', 1, 'randy', '2026-10-13 00:41', 'quiero regalarle unos zapatos flabelus de 124 euros a zoe'),
      ('claude-2026-10', 2, 'claude', '2026-10-13 00:41', 'Cómpralos entre el 2 y el 5 de noviembre')`);
    const found = await q(`select * from pf_buscar_archivo('zapatos')`);
    check('busca en el archivo', found.length === 1 && found[0].n === 1, found);
    check('busca por pedazo de palabra', (await q(`select * from pf_buscar_archivo('flabel')`)).length === 1);
    check('el archivo no se edita', Boolean(await fails(`update pf_archivo set texto = 'x'`)));
  });
  await as(ANA, async () => {
    check('nadie más ve tu plan', (await q(`select * from pf_estado`)).length === 0);
    check('nadie más ve tu historial', (await q(`select * from pf_historial`)).length === 0);
    check('nadie más ve tu memoria', (await q(`select * from pf_memoria`)).length === 0);
    check('nadie más ve tu chat', (await q(`select * from pf_chat`)).length === 0);
    check('nadie más busca en tu archivo', (await q(`select * from pf_buscar_archivo('zapatos')`)).length === 0);
    check('nadie más restaura tu plan', Boolean(await fails(`select pf_restaurar(1)`)));
    const chatRandy = await one(`select 1`);
    check('no puede escribir memoria a tu nombre', Boolean(await fails(`insert into pf_memoria (user_id, tema, texto) values ($1, 'x', 'y')`, [RANDY])) && Boolean(chatRandy));
  });
  await db.exec(`set role anon`);
  const anonPf = await fails(`select * from pf_estado`);
  const anonRpc = await fails(`select pf_guardar_estado('{}', 0, 'x', 'manual')`);
  await db.exec(`reset role`);
  check('anon no lee el plan', Boolean(anonPf), anonPf);
  check('anon no guarda planes', Boolean(anonRpc), anonRpc);
}

console.log(`\n${passed} ok, ${failures} fallos`);
process.exit(failures ? 1 : 0);
