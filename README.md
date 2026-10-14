# Fynco

Tu cartera personal, tus gastos compartidos (estilo Splitwise) y un asistente financiero, en una sola app.

**Producción:** https://fynco.grullonb.com (también responde en https://fynco-assist.vercel.app)

## Stack
- Next.js 15 (App Router) · React 18 · Tailwind (tema "Nocturno")
- Supabase: Auth, Postgres con RLS, RPCs y Realtime
- TanStack Query
- Asistente con Groq (gpt-oss-120b + Whisper) o Google Gemini, con function calling y voz

## Dominio
`fynco.grullonb.com` → CNAME en Namecheap hacia el valor que da Vercel (`vercel domains verify fynco.grullonb.com`).

## Configuración

Solo hay que poner las variables de entorno y correr el SQL una vez.

1. **Base de datos:** en Supabase → SQL Editor, ejecuta en orden los archivos de [`supabase/migrations/`](supabase/migrations/): primero [`20261008000001_init.sql`](supabase/migrations/20261008000001_init.sql) y luego cada migración nueva (p. ej. [`20261013000001_card_dates.sql`](supabase/migrations/20261013000001_card_dates.sql), fechas de corte y pago de tarjetas, [`20261014000001_credit_limit.sql`](supabase/migrations/20261014000001_credit_limit.sql), límite de crédito, [`20261015000001_card_payments.sql`](supabase/migrations/20261015000001_card_payments.sql), pagar tarjetas y poner al día lo consumido, [`20261016000001_debts.sql`](supabase/migrations/20261016000001_debts.sql), deudas y préstamos con personas, y [`20261017000001_plan.sql`](supabase/migrations/20261017000001_plan.sql), el plan).
2. **Variables** (Vercel → Settings → Environment Variables, o `.env.local` para desarrollo):

   | Variable | Para qué |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anon (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
   | `GROQ_API_KEY` | Asistente (recomendado): Groq con `openai/gpt-oss-120b` y Whisper para la voz. Si existe, se usa en vez de Gemini |
   | `GEMINI_API_KEY` | Asistente alternativo (Gemini 3.x) si no hay llave de Groq |
   | `NEXT_PUBLIC_SITE_URL` | Opcional. Por defecto `https://fynco.grullonb.com` |
   | `GROQ_MODEL` | Opcional. Por defecto `openai/gpt-oss-120b` (respaldos: `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`) |
   | `GEMINI_MODEL` | Opcional. Por defecto `gemini-3.8-flash` (respaldos 3.7 / 3.5 / 2.5) |
   | `GEMINI_THINKING_BUDGET` | Opcional. Tokens de razonamiento; por defecto `0` en los modelos flash (respuesta más rápida) |

3. **Auth en Supabase** → Authentication → URL Configuration:
   - Site URL: `https://fynco.grullonb.com`
   - Redirect URLs: `https://fynco.grullonb.com/auth/callback`, `https://fynco-assist.vercel.app/auth/callback`, `https://*-randygrullons-projects.vercel.app/auth/callback` (previews) y `http://localhost:9002/auth/callback`
   - Para "Continuar con Google", activa el proveedor Google en Authentication → Providers.

Si faltan las variables, la app muestra `/configurar` con estas instrucciones en vez de fallar.

## Desarrollo
```bash
npm install
npm run dev        # http://localhost:9002
npm test           # lógica de dinero y división (Vitest)
npm run test:db    # migración + RLS + RPCs en Postgres en memoria (PGlite)
npm run typecheck
```

## Cómo funciona el dinero
- Todos los montos se guardan en **centavos** (`bigint`).
- **Libro único:** toda entrada o salida de una cuenta es una fila en `transactions`. El saldo de cada cuenta es el saldo inicial más la suma del libro (vista `account_balances`).
- Las operaciones de varias filas (transferencias, gastos compartidos, pagos, recurrentes) son **RPCs atómicas** en Postgres.
- **Compartido:** `shared_expenses` + `expense_payers` (quién pagó) + `expense_shares` (cuánto le toca a cada uno) + `settlements` (pagos). Si pagas con una cuenta tuya, se descuenta de ella, pero en estadísticas cuenta **solo tu parte**.
- **Asistente:** `/api/assistant` usa la sesión del usuario (RLS) y herramientas de solo lectura. Para registrar algo solo propone un borrador que el usuario confirma. Tiene un límite de 40 consultas por hora y 200 por día por usuario.
- **Importar estados de cuenta:** el PDF (también con contraseña), Excel, CSV o foto se lee en el teléfono; a `/api/import` solo van las líneas con movimientos y la IA (Groq; Gemini para fotos o PDF escaneados) devuelve fecha, descripción, monto y categoría. El usuario revisa, se marcan los repetidos y nada se guarda hasta confirmar. Los pagos a tarjeta se registran como transferencias.
- **Recurrentes:** se generan al abrir la app, de forma idempotente (`unique(recurring_rule_id, occurrence_date)`). Opcionalmente también con `pg_cron` (ver el final del SQL).

- **Tarjetas:** lo consumido sube la deuda de la tarjeta y no toca el banco; el dinero sale de una cuenta solo al registrar el pago (`pay_card`). `set_card_debt` deja la deuda en lo que dice el banco.
- **Deudas con personas:** "me prestaron" o "presté", con interés simple opcional (mensual, anual o total) y cuotas que se calculan solas (`debt_terms`, igual que `src/lib/debts.ts`). Con una cuenta, el capital va como pago de deuda (no cuenta en estadísticas) y solo el interés cuenta como gasto o ingreso.
- **Agentes:** otro chat de Claude conectado a la base puede registrar datos con las mismas funciones: ver [docs/AGENTES.md](docs/AGENTES.md).

## Plan

La pantalla `/plan` responde cuánto dinero es de verdad tuyo, qué hay que pagar (cuándo, cuánto y con qué), cuánto puedes gastar esta quincena y cómo queda tu cuenta día a día. El motor está en `src/lib/plan/` (funciones puras con pruebas en Vitest) y lo usan la pantalla, la tarjeta de Inicio y la herramienta `get_plan` del asistente.

- **Tu dinero** = cuentas corrientes, de ahorro y efectivo, menos las cuentas `other` marcadas como prestado (`reserved`).
- **Quincenas**: de un cobro de Salario (recurrentes, también de una sola vez) al siguiente; si no hay, del 1 y del 16. Un periodo (`plan_periods`, p. ej. un viaje) es su propia fila.
- **Presupuesto**: `monthly_budget × 12 / 365` por día, redondeado a 50 por quincena. Gastado = gastos + tu parte de lo compartido, sin recurrentes ni categorías excluidas. Lo que queda se reparte como estimado en la cuenta del día a día.
- **Tarjetas**: un consumo entra en el corte de ese día o el siguiente; cada corte se paga el `pay_day` (o la fecha límite) desde `pay_from_account_id` (o la predeterminada). Las tarjetas de doble saldo (mismo `last4`) se pagan juntas, convertidas con `rates`.
- **Cuotas**: recurrentes de tipo transferencia hacia cuentas `other` (y las cuotas del módulo Deudas).
- **Línea de tiempo**: desde hoy hasta `horizon_days`; el mismo día entra primero lo que entra. Marca el punto más bajo y si baja del colchón.

Más detalle en [docs/REDISENO.md](docs/REDISENO.md) y [docs/UI.md](docs/UI.md).
