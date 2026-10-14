-- =====================================================================
-- Nuevo Fynco ("Mis finanzas"): el plan en un documento JSON versionado,
-- la memoria del asistente, el chat y el archivo de conversaciones.
--
-- * pf_estado     — el plan actual (un documento por persona) con su versión.
-- * pf_historial  — cada versión del plan; nunca se borra ni se edita.
-- * pf_memoria    — notas que el asistente lee antes de cada respuesta.
-- * pf_chat       — cada mensaje del chat; nunca se borra.
-- * pf_archivo    — conversaciones y documentos importados (búsqueda de texto).
--
-- Las escrituras del plan van solo por RPC (pf_guardar_estado,
-- pf_restaurar, pf_deshacer) para que cada cambio quede en el historial.
-- Las tablas del Fynco anterior no se tocan.
-- =====================================================================

create table public.pf_estado (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  datos jsonb not null check (jsonb_typeof(datos) = 'object'),
  version int not null default 1 check (version >= 1),
  actualizado timestamptz not null default now()
);

create table public.pf_historial (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  version int not null check (version >= 1),
  datos jsonb not null check (jsonb_typeof(datos) = 'object'),
  motivo text not null check (length(trim(motivo)) between 1 and 500),
  origen text not null check (origen in ('semilla', 'chat', 'manual', 'restaurar')),
  -- Lista de textos cortos con lo que cambió (para mostrar en el historial).
  cambios jsonb check (cambios is null or jsonb_typeof(cambios) = 'array'),
  creado timestamptz not null default now(),
  unique (user_id, version)
);
create index pf_historial_user_idx on public.pf_historial (user_id, version desc);

create table public.pf_memoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tema text not null check (length(trim(tema)) between 1 and 80),
  texto text not null check (length(trim(texto)) between 1 and 4000),
  origen text not null default 'manual' check (origen in ('semilla', 'chat', 'manual')),
  -- No se borra: se archiva.
  archivada boolean not null default false,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index pf_memoria_user_idx on public.pf_memoria (user_id, archivada, tema);

create table public.pf_chat (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant')),
  texto text not null check (length(texto) <= 20000),
  -- En respuestas que cambiaron el plan: {version_antes, version_despues, resumen: [..]}.
  cambios jsonb check (cambios is null or jsonb_typeof(cambios) = 'object'),
  deshecho_en timestamptz,
  creado timestamptz not null default now()
);
create index pf_chat_user_idx on public.pf_chat (user_id, id desc);

create table public.pf_archivo (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- De dónde viene, p. ej. 'claude-2026-10' (la conversación con Claude) o 'documento'.
  fuente text not null check (length(trim(fuente)) between 1 and 80),
  n int not null,
  quien text not null check (quien in ('randy', 'claude', 'documento')),
  fecha text,
  texto text not null check (length(texto) <= 60000),
  busqueda tsvector generated always as (to_tsvector('spanish', texto)) stored,
  unique (user_id, fuente, n)
);
create index pf_archivo_busqueda_idx on public.pf_archivo using gin (busqueda);

-- ---------------------------------------------------------------------
-- RLS: cada quien ve lo suyo. Plan e historial solo se escriben por RPC.
-- ---------------------------------------------------------------------
alter table public.pf_estado enable row level security;
alter table public.pf_historial enable row level security;
alter table public.pf_memoria enable row level security;
alter table public.pf_chat enable row level security;
alter table public.pf_archivo enable row level security;

create policy pf_estado_select on public.pf_estado for select to authenticated using (user_id = auth.uid());
create policy pf_historial_select on public.pf_historial for select to authenticated using (user_id = auth.uid());

create policy pf_memoria_select on public.pf_memoria for select to authenticated using (user_id = auth.uid());
create policy pf_memoria_insert on public.pf_memoria for insert to authenticated with check (user_id = auth.uid());
create policy pf_memoria_update on public.pf_memoria for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy pf_chat_select on public.pf_chat for select to authenticated using (user_id = auth.uid());
create policy pf_chat_insert on public.pf_chat for insert to authenticated
  with check (user_id = auth.uid() and deshecho_en is null);

create policy pf_archivo_select on public.pf_archivo for select to authenticated using (user_id = auth.uid());
create policy pf_archivo_insert on public.pf_archivo for insert to authenticated with check (user_id = auth.uid());

revoke all on public.pf_estado, public.pf_historial, public.pf_memoria, public.pf_chat, public.pf_archivo from anon;
revoke insert, update, delete on public.pf_estado, public.pf_historial from authenticated;
revoke update, delete on public.pf_chat, public.pf_archivo from authenticated;
revoke update, delete on public.pf_memoria from authenticated;
grant update (tema, texto, archivada, actualizado) on public.pf_memoria to authenticated;

-- ---------------------------------------------------------------------
-- Guardar una versión nueva del plan. Falla con 'version_conflict' si
-- alguien guardó antes (otra pestaña, otro equipo) para no pisar cambios.
-- p_version_esperada = 0 crea el plan por primera vez.
-- ---------------------------------------------------------------------
create function public.pf_guardar_estado(
  p_datos jsonb, p_version_esperada int, p_motivo text, p_origen text, p_cambios jsonb default null
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_nueva int;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'datos_invalidos'; end if;
  if p_origen not in ('semilla', 'chat', 'manual', 'restaurar') then raise exception 'origen_invalido'; end if;
  if pg_column_size(p_datos) > 900000 then raise exception 'datos_muy_grandes'; end if;

  if p_version_esperada = 0 then
    insert into public.pf_estado (user_id, datos, version) values (v_me, p_datos, 1)
      on conflict (user_id) do nothing;
    if not found then raise exception 'version_conflict'; end if;
    v_nueva := 1;
  else
    update public.pf_estado
       set datos = p_datos, version = version + 1, actualizado = now()
     where user_id = v_me and version = p_version_esperada
    returning version into v_nueva;
    if v_nueva is null then raise exception 'version_conflict'; end if;
  end if;

  insert into public.pf_historial (user_id, version, datos, motivo, origen, cambios)
  values (v_me, v_nueva, p_datos, left(coalesce(nullif(trim(p_motivo), ''), 'Cambio'), 500), p_origen, p_cambios);
  return v_nueva;
end;
$$;

-- Volver a una versión anterior. No borra nada: crea una versión nueva
-- con el contenido de la vieja.
create function public.pf_restaurar(p_version int, p_motivo text default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_datos jsonb;
  v_actual int;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  select datos into v_datos from public.pf_historial where user_id = v_me and version = p_version;
  if v_datos is null then raise exception 'version_no_existe'; end if;
  select version into v_actual from public.pf_estado where user_id = v_me for update;
  if v_actual is null then raise exception 'sin_plan'; end if;
  return public.pf_guardar_estado(v_datos, v_actual, coalesce(p_motivo, 'Restaurado a la versión ' || p_version), 'restaurar',
                                  jsonb_build_array('Volvió a la versión ' || p_version));
end;
$$;

-- Deshacer lo que cambió una respuesta del chat. Solo si después no hubo
-- otros cambios; si los hubo, hay que elegir la versión en el historial.
create function public.pf_deshacer(p_chat_id bigint)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_msg public.pf_chat;
  v_actual int;
  v_nueva int;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  select * into v_msg from public.pf_chat where id = p_chat_id and user_id = v_me for update;
  if v_msg.id is null or v_msg.cambios is null then raise exception 'nada_que_deshacer'; end if;
  if v_msg.deshecho_en is not null then raise exception 'ya_deshecho'; end if;
  select version into v_actual from public.pf_estado where user_id = v_me;
  if v_actual is distinct from (v_msg.cambios ->> 'version_despues')::int then raise exception 'hay_cambios_despues'; end if;
  v_nueva := public.pf_restaurar((v_msg.cambios ->> 'version_antes')::int, 'Deshecho desde el chat');
  update public.pf_chat set deshecho_en = now() where id = p_chat_id;
  return v_nueva;
end;
$$;

-- Buscar en el archivo (conversaciones importadas) por palabras.
create function public.pf_buscar_archivo(p_consulta text, p_limite int default 8)
returns table (fuente text, n int, quien text, fecha text, texto text, rango real)
language sql stable security definer set search_path = public
as $$
  with q as (select websearch_to_tsquery('spanish', p_consulta) as tq)
  select a.fuente, a.n, a.quien, a.fecha, a.texto, ts_rank(a.busqueda, q.tq) as rango
    from public.pf_archivo a, q
   where a.user_id = auth.uid()
     and (a.busqueda @@ q.tq or a.texto ilike '%' || p_consulta || '%')
   order by rango desc, a.n
   limit least(greatest(coalesce(p_limite, 8), 1), 20);
$$;

revoke execute on function public.pf_guardar_estado(jsonb, int, text, text, jsonb) from public, anon;
revoke execute on function public.pf_restaurar(int, text) from public, anon;
revoke execute on function public.pf_deshacer(bigint) from public, anon;
revoke execute on function public.pf_buscar_archivo(text, int) from public, anon;
grant execute on function public.pf_guardar_estado(jsonb, int, text, text, jsonb) to authenticated;
grant execute on function public.pf_restaurar(int, text) to authenticated;
grant execute on function public.pf_deshacer(bigint) to authenticated;
grant execute on function public.pf_buscar_archivo(text, int) to authenticated;
