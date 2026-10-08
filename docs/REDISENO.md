# Fynco v2: análisis y propuesta de rediseño

> **Estado (8 oct 2026):** implementado en la rama `v2-nocturno-supabase` con la dirección **A · Nocturno**. Fases 1 a 5 hechas; la 6 (migrar datos de Firestore) queda pendiente según si hay usuarios reales.
>
> Verificación: 24 pruebas unitarias (dinero y división), 47 pruebas de base de datos en PGlite (RLS, RPCs, recurrentes, PIN, límites), `tsc`, `next lint` y `next build` sin errores.

## 1. Qué debe ser Fynco

Tres funciones en una sola app, que comparten los mismos datos:

| Pilar | Qué hace | Hoy |
|---|---|---|
| **Cartera personal** | Cuentas, saldos, ingresos/gastos, transferencias, recurrentes, metas | Existe, pero con dos libros contables que se desincronizan |
| **Compartido (tipo Splitwise)** | Grupos, amigos, dividir gastos, quién debe a quién, saldar | No existe; el modelo es 100 % por usuario |
| **Asistente** | Registrar por voz o texto, responder preguntas sobre tus finanzas, avisos | Chat de un solo turno sin autenticación; la voz no se puede usar porque el componente quedó sin pantalla |

La regla que une los tres: **todo dinero que sale o entra de una cuenta tuya es una fila en un único libro (`transactions`)**. Lo compartido y el asistente escriben en ese mismo libro.

## 2. Flujos actuales y datos que afectan

| Flujo | Código | Escribe en | Problema |
|---|---|---|---|
| Registro / login | `(auth)/signup`, `(auth)/login` | `users/{uid}` | El login sobrescribe `createdAt` en cada entrada (`login/page.tsx:115,192`). `useAuth` valida el doc del usuario antes de que exista, lo que puede cerrar la sesión de un usuario recién registrado (`use-auth.ts:19-38`). |
| Gasto/ingreso en cuenta | `addAccountTransaction` (`accounts.ts:411`) | subcolección de la cuenta + saldo + `movements` + `transactions` | 4 escrituras sin atomicidad. El saldo se actualiza leyendo y luego escribiendo, así que dos operaciones simultáneas pueden perder una. |
| Gasto/ingreso recurrente y salario | `addTransaction` (`transactions.ts:57`) | `transactions` + saldo | **No** escribe en la subcolección de la cuenta: el detalle de la cuenta no muestra estos movimientos pero el saldo sí cambia. |
| Procesar recurrentes | `processDueRecurringTransactions` | `transactions`, `recurringTransactions` | Se lanza a la vez desde 3 pantallas sin bloqueo ni clave de idempotencia, por lo que puede duplicar cobros. |
| Transferencia | `accounts.ts:433` | 2 patas en subcolecciones + 2 en `transactions` + 2 saldos + `movements` | La lista de transferencias siempre sale vacía porque filtra `type === "transfer"` y ese tipo nunca se guarda (`transfer-card-list.tsx:79`). Borrar una pata deja la otra viva. |
| Añadir fondos a meta | `goals.ts:470` | subcolección + `goal.currentAmount` + saldo | No llega a `transactions`, así que estadísticas y asistente no lo ven. |
| Estadísticas / export | `statistics.ts`, `statistics-exporter.ts` | lectura | Solo ven las últimas 100 transacciones. El CSV escribe un `\n` literal en vez de saltos de línea. |
| Chat IA | `financial-chat-bot.tsx` → `/api/financial-chat` | lectura | La ruta no tiene autenticación. Envía a Gemini cuentas, metas **con `pinHash`/`pinSalt`**, email y 50 transacciones. No guarda historial. |
| Voz | `ai/flows/voice-expense-recording.ts` | — | Inalcanzable: solo lo usan diálogos que ya no se montan. "Hoy" queda fijado al momento en que se carga el módulo. |
| Bloqueo / PIN | `security.ts`, `app-security-gate.tsx` | `users/{uid}.securitySettings` | SHA-256 sin derivación de clave ni límite de intentos. La app se renderiza debajo del overlay. La biometría nunca verifica la firma. |
| Eliminar cuenta | `account-deletion.ts` | borra todo | Borra los datos antes que el usuario de Auth (si Firebase pide re-login, quedan datos borrados y usuario vivo). No borra las subcolecciones de las cuentas. |

Otros hallazgos:

- `<Toaster/>` nunca se monta: ningún mensaje de error o éxito se ve.
- El dashboard llama "Net income" a la suma de saldos (`dashboard/page.tsx:114`).
- Todos los montos se formatean en la moneda global aunque cada cuenta tenga la suya, y se suman monedas distintas.
- La política de privacidad promete cifrado AES-GCM, pero `encryption.ts` no se usa: los datos están en texto plano.
- Hay páginas de prueba públicas en producción (`/firestore-test` escribe datos reales y `/test-accounts` tiene credenciales fijas).
- `next.config.ts` ignora errores de TypeScript y de lint al compilar.
- `next-intl` está instalado pero no configurado. Los textos mezclan inglés y español.
- Código muerto: `statistics/page.tsx.new`, `goals-add-funds.ts`, `data.ts`, `client-types.ts`, `firestore-performance-config.ts`, todo `components/transactions/`, y `/movements` y `/settings/movements`, que duplican `/activity`.

## 3. Arquitectura propuesta (Supabase)

- **Auth:** Supabase Auth (email + Google), con sesión en cookies vía `@supabase/ssr`. El middleware protege las rutas en el servidor. Una sola `AuthProvider` sustituye las ~40 llamadas a `useAuth`.
- **Datos:** Postgres con RLS en todas las tablas. Montos en `bigint` de centavos para evitar errores de redondeo.
- **Operaciones de dinero:** funciones RPC en SQL (`create_transfer`, `add_shared_expense`, `settle_up`, `run_recurring`), cada una en una sola transacción.
- **Saldos:** se calculan (vista `account_balances` = saldo inicial + suma del libro), no se guardan a mano.
- **Recurrentes:** `pg_cron` cada hora, con `unique(recurring_rule_id, occurrence_date)` para que no se puedan duplicar.
- **Auditoría:** un trigger escribe `activity_log` y sustituye las llamadas manuales a `record*`.
- **Tiempo real:** suscripción a cambios en los grupos, para que veas al instante cuando alguien añade un gasto.

### Esquema

```sql
-- Perfil 1:1 con auth.users
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_url text,
  default_currency char(3) not null default 'DOP',
  hide_amounts boolean not null default false,
  created_at timestamptz not null default now()
);

create type account_type as enum ('checking','savings','credit','investment','cash','other');
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  name text not null,
  type account_type not null,
  currency char(3) not null,
  opening_balance bigint not null default 0,      -- centavos
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,  -- null = categoría del sistema
  name text not null,
  kind text not null check (kind in ('income','expense')),
  icon text, color text
);

-- LIBRO ÚNICO: toda entrada/salida real de una cuenta
create type tx_kind as enum ('income','expense','transfer','settlement','goal');
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  amount bigint not null,                 -- con signo: + entra, − sale
  kind tx_kind not null,
  occurred_on date not null,
  description text,
  category_id uuid references categories,
  transfer_id uuid,                       -- une las dos patas de una transferencia
  shared_expense_id uuid,                 -- si salió de pagar un gasto compartido
  settlement_id uuid,
  recurring_rule_id uuid,
  occurrence_date date,
  source text not null default 'manual',  -- manual | voice | assistant | recurring | import
  created_at timestamptz not null default now(),
  unique (recurring_rule_id, occurrence_date)
);

create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  amount bigint not null, kind tx_kind not null, category_id uuid references categories,
  description text not null,
  frequency text not null check (frequency in ('daily','weekly','biweekly','monthly','quarterly','yearly')),
  start_on date not null, end_on date, next_run_on date not null,
  weekend_policy text not null default 'keep',  -- keep | before | after
  active boolean not null default true
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  name text not null, target_amount bigint not null, currency char(3) not null,
  account_id uuid references accounts,         -- el progreso = saldo de esta cuenta
  deadline date, status text not null default 'active',
  created_at timestamptz not null default now()
);

-- COMPARTIDO (tipo Splitwise)
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null, currency char(3) not null,
  kind text not null default 'group',          -- group | direct (gasto 1 a 1 con un amigo)
  simplify_debts boolean not null default true,
  created_by uuid not null references profiles,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  profile_id uuid references profiles,         -- null = invitado sin cuenta todavía
  display_name text not null,
  invite_email text,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

create table shared_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  description text not null,
  amount bigint not null check (amount > 0),
  occurred_on date not null,
  category_id uuid references categories,
  split_method text not null check (split_method in ('equal','exact','percent','shares')),
  created_by uuid not null references profiles,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table expense_payers (            -- quién pagó (puede ser más de uno)
  expense_id uuid references shared_expenses on delete cascade,
  member_id uuid references group_members,
  amount bigint not null,
  primary key (expense_id, member_id)
);
create table expense_shares (            -- cuánto le toca a cada uno
  expense_id uuid references shared_expenses on delete cascade,
  member_id uuid references group_members,
  amount bigint not null,
  primary key (expense_id, member_id)
);
create table settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  from_member uuid not null references group_members,
  to_member uuid not null references group_members,
  amount bigint not null check (amount > 0),
  occurred_on date not null,
  note text,
  created_at timestamptz not null default now()
);
-- vista member_balances: pagado − parte + saldado_enviado − saldado_recibido
```

Restricciones que debe validar la RPC `add_shared_expense`: `sum(payers) = amount` y `sum(shares) = amount`. El reparto en partes iguales asigna los centavos sobrantes al primer miembro.

### Cómo se conecta lo compartido con tu cartera

1. **Pagas la cena del grupo (RD$ 7,150) con tu tarjeta.** Se crea `shared_expense` y además una fila en `transactions` (−7,150, cuenta = tarjeta, `shared_expense_id`). El saldo de la tarjeta queda correcto.
2. **Estadísticas cuentan tu parte, no lo que pagaste.** El gasto real en "Comida" es tu `expense_share` (1,787.50). El resto (5,362.50) es dinero que te deben, no gasto. Sin esta regla, pagar por el grupo infla tus gastos.
3. **Ana te paga 2,150.** Se registra `settlement` y, si eliges a qué cuenta entró, una fila +2,150 de tipo `settlement`. No cuenta como ingreso en estadísticas.
4. **Otro pagó y tú debes.** No se mueve ninguna cuenta tuya hasta que saldas, pero tu parte sí aparece como gasto del mes en estadísticas.
5. **Simplificar deudas:** algoritmo greedy sobre los saldos netos del grupo (el mayor deudor paga al mayor acreedor y se repite), que da como máximo n−1 pagos.

## 4. Asistente

- Ruta `/api/assistant` autenticada con la sesión de Supabase; el `user_id` sale del token, nunca del body.
- **Function calling** en vez de pegar los datos en el prompt. El modelo pide lo que necesita (`get_balances`, `query_transactions(rango, categoría)`, `get_group_balances`, `get_goals`) y el servidor responde respetando RLS. Nunca se envían hashes de PIN ni emails.
- **Acciones con confirmación.** "Gasté 850 en almuerzo con la tarjeta" o "divide la cena entre los 4" producen un **borrador** que el usuario confirma con un toque antes de escribirse.
- **Historial de conversación** en una tabla `assistant_messages`.
- **Avisos proactivos** en Inicio: recurrentes de la semana, saldo bajo frente a próximos cobros, recordatorio de quién te debe.

## 5. Navegación nueva

`Inicio · Movimientos · (+) · Compartido · Más`

- **Inicio:** patrimonio, mes en curso, te deben / debes, asistente, cuentas y actividad.
- **Movimientos:** libro único con filtros (cuenta, categoría, rango, origen). Sustituye `/activity`, `/movements`, `/settings/movements` y la vista de transacciones eliminada.
- **(+):** hoja rápida con Gasto · Ingreso · Transferir · Dividir · Dictar.
- **Compartido:** amigos, grupos, detalle de grupo (gastos, balances, totales) y saldar.
- **Más:** cuentas, metas, recurrentes, estadísticas, ajustes y legal. Legal también queda accesible sin sesión.

## 6. Plan por fases

1. **Base:** Supabase (esquema, RLS, RPCs, seeds), cliente SSR, middleware de auth, nuevo design system de la dirección elegida, shell con la navegación inferior. Se borran el código muerto, las páginas de prueba y `ignoreBuildErrors`.
2. **Cartera:** cuentas, libro único, transferencias, recurrentes con `pg_cron`, metas, Inicio y Movimientos.
3. **Compartido:** grupos, miembros e invitaciones, gastos con los 4 métodos de reparto, balances, simplificar y saldar, tiempo real.
4. **Asistente:** ruta autenticada, herramientas, borradores con confirmación y voz.
5. **Estadísticas y export:** agregados en SQL sin límite de 100, CSV correcto, multimoneda.
6. **Migración de datos** desde Firestore, si hay usuarios reales: un script que lee cada `users/{uid}` y escribe en las tablas nuevas, deduplicando los dos libros.
