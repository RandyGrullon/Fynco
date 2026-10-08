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

console.log(`\n${passed} ok, ${failures} fallos`);
process.exit(failures ? 1 : 0);
