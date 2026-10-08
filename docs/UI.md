# Fynco · guía de UI (Nocturno)

Oscuro, un solo acento lima, Manrope, cifras tabulares. Móvil primero, con navegación inferior. En escritorio (`md+`) hay barra lateral.

## Tokens (Tailwind)
| Uso | Clase |
|---|---|
| Fondo de página | `bg-background` (#0E1013) |
| Superficie / tarjeta | `bg-card` + `border border-secondary` (#171A1F / #262A31) |
| Texto secundario | `text-muted-foreground` (#9AA0AA) |
| Acento / positivo | `bg-primary text-primary-foreground`, `text-positive` (#C8F05A) |
| Negativo / deuda | `text-negative` (#FF8A7A) |
| Píldora suave lima | `bg-primary-soft text-primary` |
| Radios | tarjetas `rounded-2xl`, filas y controles `rounded-xl` / `rounded-lg`, íconos cuadrados `rounded-md` |

Sin gradientes, sin sombras de color (salvo el FAB), sin emojis. Los íconos vienen de `lucide-react` (tipo `LucideIcon`), con trazo 2–2.2.

## Piezas existentes, úsalas
- `PageHeader`, `SectionTitle`, `EmptyState`: `@/components/shell/page-header`
- `useSheets().open({ type: "transaction" | "transfer" | "expense" | "settle" | "quick", ... })`: abre los formularios globales
- `Panel`, `PanelContent` (con `title`), `PanelFooter`: hoja inferior en móvil y diálogo en escritorio, para cualquier formulario nuevo
- Campos: `Field`, `AmountField`, `CategoryPicker`, `AccountSelect`, `DateField`, `Segmented` en `@/components/forms/fields`
- Dinero: `<Money amount currency sign tone />` y `<BigMoney />` en `@/components/money`. Respetan "ocultar montos". **Montos en centavos.** Para formatear usa `formatMoney`/`parseMoney`/`centsToInput` de `@/lib/money`.
- Lista de movimientos: `TransactionList` / `TransactionRow`
- Visuales: `MemberAvatar`, `AvatarStack`, `Monogram`, `TxIcon`, `iconFor` en `@/components/visuals`
- Datos: hooks en `@/hooks/queries` (React Query). Las escrituras usan `mutateAsync` dentro de `try/catch`: el error ya lo muestra un aviso global.
- Avisos: `toast({ title, description })` de `@/hooks/use-toast`
- Fechas: `todayISO`, `dayLabel`, `shortDate`, `monthRange`, `monthLabel` en `@/lib/dates`

## Reglas
- Todo el texto en español (RD), tuteando.
- Accesibilidad: `<button>` y `<Link>` reales; `aria-label` en botones que solo tienen ícono; objetivos táctiles de ≥ 44 px; contraste ≥ 4.5:1 (no uses `text-subtle` para texto pequeño).
- Estados: carga con `Skeleton`, vacío con `EmptyState`, error con mensaje y forma de reintentar.
- Páginas cliente (`"use client"`) dentro de `src/app/(app)/…`. El shell ya pone el ancho máximo y el padding.
