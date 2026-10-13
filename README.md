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

1. **Base de datos:** en Supabase → SQL Editor, ejecuta en orden los archivos de [`supabase/migrations/`](supabase/migrations/): primero [`20261008000001_init.sql`](supabase/migrations/20261008000001_init.sql) y luego cada migración nueva (p. ej. [`20261013000001_card_dates.sql`](supabase/migrations/20261013000001_card_dates.sql), fechas de corte y pago de tarjetas, [`20261014000001_credit_limit.sql`](supabase/migrations/20261014000001_credit_limit.sql), límite de crédito, [`20261015000001_card_payments.sql`](supabase/migrations/20261015000001_card_payments.sql), pagar tarjetas y poner al día lo consumido, y [`20261016000001_gmail_import.sql`](supabase/migrations/20261016000001_gmail_import.sql), alertas del banco por Gmail).
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
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Opcional. Cliente OAuth de Google para leer las alertas del banco en Gmail (ver abajo) |
   | `GMAIL_TOKEN_KEY` | Opcional. Llave para cifrar el permiso de Gmail: `openssl rand -base64 32` (32 bytes en base64). No la cambies después: los permisos guardados dejarían de leerse |

3. **Auth en Supabase** → Authentication → URL Configuration:
   - Site URL: `https://fynco.grullonb.com`
   - Redirect URLs: `https://fynco.grullonb.com/auth/callback`, `https://fynco-assist.vercel.app/auth/callback`, `https://*-randygrullons-projects.vercel.app/auth/callback` (previews) y `http://localhost:9002/auth/callback`
   - Para "Continuar con Google", activa el proveedor Google en Authentication → Providers.

Si faltan las variables, la app muestra `/configurar` con estas instrucciones en vez de fallar.

### Alertas del banco por Gmail (opcional)

Fynco puede leer las alertas de consumo que el banco manda a Gmail y registrar cada gasto en la cuenta cuyos **últimos 4 dígitos** coinciden.

1. En [Google Cloud Console](https://console.cloud.google.com/), en el proyecto del cliente OAuth (puede ser el mismo de "Continuar con Google"):
   - **APIs y servicios → Biblioteca:** activa **Gmail API**.
   - **Google Auth Platform → Acceso a datos:** agrega el permiso `https://www.googleapis.com/auth/gmail.readonly`.
   - **Público:** pásalo a **En producción**. En modo de prueba Google vence el permiso cada 7 días. Como la app no está verificada, al conectar Google muestra "Google no verificó esta app": entra en *Configuración avanzada → Ir a Fynco*. Para uso personal (menos de 100 usuarios) no hace falta la verificación.
   - **Clientes → tu cliente web → URIs de redireccionamiento autorizados:** `https://fynco.grullonb.com/api/gmail/callback`, `https://fynco-assist.vercel.app/api/gmail/callback` y `http://localhost:9002/api/gmail/callback`. Google no acepta comodines, así que las previews de Vercel no pueden conectar Gmail.
2. Pon `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GMAIL_TOKEN_KEY` en Vercel y vuelve a desplegar.
3. En la app: **Ajustes → Correo del banco → Conectar**. Pon los últimos 4 dígitos en cada tarjeta y cuenta.

Cómo funciona:
- Se revisa al abrir la app (como mucho cada 10 minutos), al deslizar para recargar y con **Revisar ahora**. Solo entran correos recibidos **después de conectar**: lo anterior ya está en los saldos iniciales.
- Las alertas del Popular (consumo, Código Cash, nómina) se leen con reglas fijas (`src/lib/gmail/parse.ts`). Lo que no encaja lo lee la IA del asistente (Groq o Gemini) y la categoría del comercio la pone por palabras clave o con la IA.
- Un consumo en otra moneda va a la cuenta de esa moneda; si la tarjeta es de doble saldo, lo extranjero (p. ej. euros) va al saldo en dólares, convertido con la tasa del día y anotado en la nota.
- Lo que no se puede asignar con seguridad (terminación desconocida, nómina sin monto, formato raro) queda **por revisar** en Ajustes, con el formulario ya lleno.
- Cada correo se registra una sola vez (`email_imports`), aunque la app esté abierta en dos dispositivos.

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
- **Agentes:** otro chat de Claude conectado a la base puede registrar datos con las mismas funciones: ver [docs/AGENTES.md](docs/AGENTES.md).

Más detalle en [docs/REDISENO.md](docs/REDISENO.md) y [docs/UI.md](docs/UI.md).
