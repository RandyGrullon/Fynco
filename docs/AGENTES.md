# Fynco para agentes (otro chat de Claude conectado a la base)

Guía para un agente con acceso SQL a la base de Fynco (por ejemplo, un chat de Claude con el **conector de Supabase** usando `execute_sql`). Con estas recetas el agente cambia el plan **igual que el chat de la app**: cada cambio queda como versión nueva en el historial y se puede deshacer.

Proyecto de Supabase: `htgouhbriofyhbeacamj`. (La guía del Fynco anterior, con cuentas y movimientos en centavos, está en la rama `fynco-completo`.)

## Reglas

1. **El plan es un documento JSON** en `pf_estado.datos` (tipos en `src/lib/finanzas/tipos.ts`). Los montos van **en su moneda, no en centavos**: RD$ 1,250.50 = `1250.5`.
2. **Nunca** hagas `update` directo a `pf_estado` ni toques `pf_historial`: guarda con `pf_guardar_estado`, que comprueba la versión y deja el historial.
3. No borres nada sin que el usuario lo confirme. Los mensajes del chat y el historial no se borran; las notas se archivan (`archivada = true`).
4. Si el usuario da el saldo del banco, ese manda: ponlo en `cuentas[].saldo`.
5. Antes de escribir, lee el plan y la versión; después, vuelve a leer para confirmar.

## Paso 0: actuar a nombre del usuario

Las funciones usan `auth.uid()`. Conectado como administrador, ese valor está vacío: ponlo **al inicio de cada ejecución**, en la misma llamada que el resto del SQL:

```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'CORREO_DEL_USUARIO'), false);
```

## Leer

```sql
-- El plan y su versión
select version, actualizado, datos from pf_estado where user_id = auth.uid();

-- Partes útiles
select jsonb_pretty(datos->'cuentas'), jsonb_pretty(datos->'tarjetas') from pf_estado where user_id = auth.uid();
select m from pf_estado, jsonb_array_elements(datos->'movimientos') m where user_id = auth.uid() order by m->>'fecha' desc limit 20;

-- Memoria, historial y chat
select tema, texto from pf_memoria where user_id = auth.uid() and not archivada order by tema;
select version, motivo, origen, cambios, creado from pf_historial where user_id = auth.uid() order by version desc limit 20;
select rol, texto, creado from pf_chat where user_id = auth.uid() order by id desc limit 20;

-- Buscar en la conversación original con Claude
select * from pf_buscar_archivo('zapatos');
```

## Guardar un cambio del plan

Lee la versión actual, arma el documento nuevo con `jsonb_set` (o en tu código) y guárdalo con la versión que leíste. Si alguien guardó en el medio, falla con `version_conflict`: vuelve a leer y repite.

```sql
-- Agregar un gasto con la JetBlue (día a día)
select pf_guardar_estado(
  jsonb_set(datos, '{movimientos}', datos->'movimientos' || jsonb_build_object(
    'id', 'm-' || substr(md5(random()::text), 1, 8), 'fecha', '2026-10-15', 'tarjeta', 'jetblue',
    'moneda', 'DOP', 'monto', 600, 'descripcion', 'Pádel', 'categoria', 'día a día', 'estado', 'real')),
  version, 'Pádel RD$ 600 con la JetBlue', 'manual', '["+ Pádel: RD$ 600 con JetBlue (15 oct)"]'::jsonb)
from pf_estado where user_id = auth.uid();

-- Poner el saldo del banco de la cuenta principal
select pf_guardar_estado(
  jsonb_set(datos, '{cuentas,0,saldo}', '218595'::jsonb),
  version, 'Saldo del banco: RD$ 218,595', 'manual', null)
from pf_estado where user_id = auth.uid();
```

Valores válidos:
- `tarjeta`: la `clave` de una tarjeta de `datos.tarjetas`, `cuenta` (débito de la cuenta principal) o `efectivo`.
- `moneda`: `DOP`, `USD` o `EUR`.
- `categoria`: `día a día` (cuenta en la quincena), `regalo`, `viaje`, `otro`.
- `estado` del movimiento: `real` o `planificado`.

## Volver atrás

```sql
select pf_restaurar(12);              -- el plan vuelve a como estaba en la versión 12 (queda como versión nueva)
select pf_deshacer(<id del mensaje>); -- deshace lo que cambió una respuesta del chat, si no hubo cambios después
```

## Notas de memoria

```sql
insert into pf_memoria (tema, texto, origen) values ('Regalos de Navidad', 'Compró la chaqueta el 10 nov con la tarjeta de viajes', 'manual');
update pf_memoria set texto = '…', actualizado = now() where id = '…';
update pf_memoria set archivada = true where id = '…';
```
