# Fynco

Tu cartera personal, tus gastos compartidos (estilo Splitwise) y un asistente financiero, en una sola app.

**Producción:** https://fynco.grullonb.com (también responde en https://fynco-assist.vercel.app)

## Stack
- Next.js 15 (App Router) · React 18 · Tailwind (tema "Nocturno")
- Supabase: Auth, Postgres con RLS, RPCs y Realtime
- TanStack Query
- Asistente con Google Gemini (function calling, voz)

## Dominio
`fynco.grullonb.com` → CNAME en Namecheap hacia el valor que da Vercel (`vercel domains verify fynco.grullonb.com`).

## Configuración

Solo hay que poner las variables de entorno y correr el SQL una vez.

1. **Base de datos:** en Supabase → SQL Editor, pega y ejecuta [`supabase/migrations/20261008000001_init.sql`](supabase/migrations/20261008000001_init.sql).
2. **Variables** (Vercel → Settings → Environment Variables, o `.env.local` para desarrollo):

   | Variable | Para qué |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anon (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
   | `GEMINI_API_KEY` | Asistente (ya existe en Vercel) |
   | `NEXT_PUBLIC_SITE_URL` | Opcional. Por defecto `https://fynco.grullonb.com` |
   | `GEMINI_MODEL` | Opcional. Por defecto `gemini-2.5-flash` |
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
- **Recurrentes:** se generan al abrir la app, de forma idempotente (`unique(recurring_rule_id, occurrence_date)`). Opcionalmente también con `pg_cron` (ver el final del SQL).

Más detalle en [docs/REDISENO.md](docs/REDISENO.md) y [docs/UI.md](docs/UI.md).
