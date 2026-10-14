# Fynco

Tu plan de finanzas y un chat con una IA honesta: le cuentas todo (gastos, pagos, cobros, ideas de compra) como se lo contarías a una persona, lo registra, te dice la verdad con números si algo no te conviene y recuerda todo lo que han hablado.

**Producción:** https://fynco.grullonb.com

> El Fynco anterior (cuentas, movimientos, compartidos, deudas, metas, recurrentes, importar estados de cuenta) está completo en la rama [`fynco-completo`](../../tree/fynco-completo). Sus tablas siguen en la base y esta versión no las toca.

## Pantallas
- **Plan** (`/plan`): tu dinero de verdad (sin lo prestado), lo que puedes gastar en la quincena, el próximo pago de tarjeta, la deuda, el punto más bajo y lo que te queda al final; gráfico día a día; qué entra y qué sale con la columna **Con** (filtros por tipo y mes); tarjetas por corte; plan de la deuda; presupuesto por quincena; viaje; movimientos con buscador; supuestos.
- **Chat** (`/chat`): texto o nota de voz (Whisper). El asistente usa herramientas para leer y cambiar el plan; cada respuesta que cambió algo muestra los cambios y un botón **Deshacer**.
- **Memoria** (`/memoria`): las notas que el asistente lee siempre (editables), el **historial** de versiones del plan (volver a cualquiera) y la **conversación** original con Claude, con buscador.

## Cómo guarda todo
| Tabla | Qué guarda |
|---|---|
| `pf_estado` | El plan actual: un documento JSON por persona con su número de versión |
| `pf_historial` | Cada versión del plan, con motivo, origen y lista de cambios. No se edita ni se borra |
| `pf_memoria` | Notas de memoria. Se editan o se archivan; no se borran |
| `pf_chat` | Cada mensaje del chat (tuyo y del asistente). No se edita ni se borra |
| `pf_archivo` | Conversaciones y documentos importados, con búsqueda de texto en español |

- El plan solo se escribe con `pf_guardar_estado` (falla con `version_conflict` si alguien guardó antes), `pf_restaurar` y `pf_deshacer`. Todo con RLS: cada quien ve solo lo suyo.
- Migración: [`supabase/migrations/20261018000001_mis_finanzas.sql`](supabase/migrations/20261018000001_mis_finanzas.sql).
- Los datos personales viven solo en la base. El repo no tiene datos reales: las pruebas usan un plan de ejemplo inventado.

## El motor del plan
`src/lib/finanzas/motor.ts` es una función pura (`calcularPlan(estado, hoy)`) que da exactamente los mismos números que la página original en Python; las pruebas lo comparan en 5 fechas.

- **Tu dinero** = saldo del banco de la cuenta principal − lo prestado que está ahí.
- **Quincenas**: de un cobro de nómina al siguiente; el viaje es su propio periodo.
- **Presupuesto de casa**: `presupuesto_casa_mes × 12 / 365` por día, redondeado a 50 por quincena. Lo que queda se estima como gasto diario en la tarjeta del día a día.
- **Tarjetas**: un consumo hasta el día de corte (inclusive) entra en ese corte y se paga el día de pago siguiente.
- **Línea de tiempo**: desde hoy hasta el horizonte; el mismo día entra primero lo que entra. Marca el punto más bajo y si baja del colchón.

## El asistente
`/api/chat` (servidor, con la sesión del usuario):
1. Guarda tu mensaje en `pf_chat` antes de nada.
2. Arma las instrucciones con tus notas de memoria y un resumen del plan, más los últimos mensajes.
3. Corre el bucle de herramientas con Groq (`openai/gpt-oss-120b`; si no tiene cupo, prueba los otros modelos de Groq).
4. Si cambió el plan, lo guarda como versión nueva y la respuesta queda ligada a esa versión para poder deshacerla.

Herramientas (`src/lib/finanzas/herramientas.ts`): ver el plan y los movimientos, **simular** una compra con cada tarjeta, registrar y editar movimientos, saldos, cortes, pagos de tarjeta, cobros, cuotas de la deuda, préstamos, salidas, ajustes y tarjetas, guardar notas y buscar en el historial y la conversación original.

Límite: 40 mensajes por hora y 200 por día por usuario.

## Configuración
Variables (Vercel → Settings → Environment Variables, o `.env.local`):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anon (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `GROQ_API_KEY` | El asistente y las notas de voz |
| `GROQ_MODEL` | Opcional: modelo preferido |
| `NEXT_PUBLIC_SITE_URL` | Opcional. Por defecto `https://fynco.grullonb.com` |

Auth en Supabase → Authentication → URL Configuration: Site URL `https://fynco.grullonb.com` y Redirect URL `https://fynco.grullonb.com/auth/callback` (más `http://localhost:9002/auth/callback` para desarrollo). Para "Continuar con Google", activa el proveedor Google.

## Desarrollo
```bash
npm install
npm run dev        # http://localhost:9002
npm test           # motor del plan y herramientas (Vitest)
npm run test:db    # migraciones + RLS + RPCs en Postgres en memoria (PGlite)
npm run typecheck
```

Para comparar el motor con un plan real sin subirlo al repo: `FINANZAS_REAL=/ruta/carpeta npm test`, con `estado.json` y `esperado-AAAA-MM-DD.json` en esa carpeta.
