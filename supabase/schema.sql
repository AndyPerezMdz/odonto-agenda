-- =====================================================================
--  AGENDA DE CLÍNICAS — Esquema completo de Supabase (multi-agenda)
--  Pégalo COMPLETO en: Supabase → SQL Editor → New query → Run
--  Es idempotente: sirve para instalar desde cero y para actualizar una base existente.
--  Si ya había datos (una sola agenda), se convierten en la primera agenda automáticamente.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- AGENDAS (cada cliente que compra la app tiene la suya)
-- ---------------------------------------------------------------------
create table if not exists public.agendas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null default 'Agenda de clínicas',
  notas      text,                              -- notas internas del superadmin (a quién se vendió, etc.)
  created_at timestamptz not null default now()
);

-- Suscripción: pagada hasta esta fecha. NULL = sin vencimiento (cortesía).
alter table public.agendas add column if not exists pagado_hasta date;
alter table public.agendas add column if not exists precio_mensual numeric not null default 200;

-- SUPERADMINS: quién puede entrar a /admin (tú). Sin políticas: nadie lo lee desde la app.
create table if not exists public.superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.superadmins enable row level security;

-- Tú eres superadmin (si tu usuario ya existe en este proyecto)
insert into public.superadmins (user_id)
select id from auth.users where email = 'aperezmdz21@gmail.com'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- PERFILES (uno por usuario). Rol dentro de su agenda.
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nombre       text not null default 'Sin nombre',
  color        text not null default '#6366f1',
  preferencias jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

alter table public.perfiles add column if not exists agenda_id uuid references public.agendas (id) on delete cascade;
alter table public.perfiles add column if not exists rol text not null default 'companero';
alter table public.perfiles add column if not exists periodo_confirmado text; -- ej. '2026-3'
alter table public.perfiles add column if not exists acepto_terminos_at timestamptz; -- cuándo aceptó aviso de privacidad y términos

do $$ begin
  alter table public.perfiles add constraint perfiles_rol_valido check (rol in ('owner', 'companero'));
exception when duplicate_object then null;
end $$;

-- Un solo dueño POR AGENDA (quita el índice viejo de "un dueño en toda la base")
drop index if exists public.perfiles_un_solo_owner;
create unique index if not exists perfiles_un_owner_por_agenda on public.perfiles (agenda_id) where rol = 'owner';
create index if not exists perfiles_agenda_idx on public.perfiles (agenda_id);

-- Crea el perfil al dar de alta un usuario (sin agenda: el servidor se la asigna al invitar)
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

insert into public.perfiles (id, nombre)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- Nadie se cambia de rol ni de agenda desde la app. Sólo el servidor o el SQL Editor.
create or replace function public.proteger_rol()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (new.rol is distinct from old.rol or new.agenda_id is distinct from old.agenda_id) then
    raise exception 'No puedes cambiar tu rol ni tu agenda.';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_proteger_rol on public.perfiles;
create trigger perfiles_proteger_rol
  before update on public.perfiles
  for each row execute function public.proteger_rol();

-- La agenda de quien está en sesión (se usa en todas las políticas)
create or replace function public.mi_agenda()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select agenda_id from public.perfiles where id = auth.uid()
$$;
grant execute on function public.mi_agenda() to authenticated;

-- ¿La agenda de quien está en sesión está al corriente? (3 días de gracia tras vencer)
create or replace function public.agenda_activa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.pagado_hasta is null or a.pagado_hasta + 3 >= current_date
       from public.agendas a where a.id = public.mi_agenda()),
    false)
$$;
grant execute on function public.agenda_activa() to authenticated;

-- ¿Quien está en sesión es el dueño de su agenda?
create or replace function public.soy_dueno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select rol = 'owner' from public.perfiles where id = auth.uid()), false)
$$;
grant execute on function public.soy_dueno() to authenticated;

-- ---------------------------------------------------------------------
-- CATÁLOGOS: clínicas y materias (por agenda)
-- ---------------------------------------------------------------------
create table if not exists public.clinicas (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null,
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.materias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  color       text not null default '#94a3b8',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.clinicas add column if not exists agenda_id uuid references public.agendas (id) on delete cascade;
alter table public.materias add column if not exists agenda_id uuid references public.agendas (id) on delete cascade;
alter table public.clinicas alter column agenda_id set default public.mi_agenda();
alter table public.materias alter column agenda_id set default public.mi_agenda();

-- Nombres únicos DENTRO de cada agenda (antes eran únicos en toda la base)
alter table public.clinicas drop constraint if exists clinicas_numero_unico;
alter table public.materias drop constraint if exists materias_nombre_unico;
create unique index if not exists clinicas_numero_por_agenda on public.clinicas (agenda_id, numero);
create unique index if not exists materias_nombre_por_agenda on public.materias (agenda_id, nombre);



-- ---------------------------------------------------------------------
-- CITAS
-- ---------------------------------------------------------------------
create table if not exists public.citas (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  paciente     text not null check (length(trim(paciente)) > 0),
  fecha        date not null,
  hora_inicio  time not null,
  hora_fin     time not null,
  clinica_id   uuid references public.clinicas (id) on delete set null,
  materia_id   uuid references public.materias (id) on delete set null,
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint citas_horas_validas check (hora_fin > hora_inicio),
  -- Una misma persona no puede tener dos citas encimadas
  constraint citas_sin_traslape exclude using gist (
    owner_id with =,
    tsrange(fecha + hora_inicio, fecha + hora_fin) with &&
  )
);

alter table public.citas add column if not exists agenda_id uuid references public.agendas (id) on delete cascade;
alter table public.citas alter column agenda_id set default public.mi_agenda();

-- Estado de la cita: NULL = pendiente; 'asistio' | 'falto' | 'cancelo'
alter table public.citas add column if not exists estado text;
alter table public.citas drop constraint if exists citas_estado_valido;
alter table public.citas add constraint citas_estado_valido check (estado is null or estado in ('asistio', 'falto', 'cancelo'));

-- Las citas canceladas ya no ocupan el horario (se puede agendar otra encima)
alter table public.citas drop constraint if exists citas_sin_traslape;
alter table public.citas add constraint citas_sin_traslape exclude using gist (
  owner_id with =,
  tsrange(fecha + hora_inicio, fecha + hora_fin) with &&
) where (estado is distinct from 'cancelo');

-- Última versión de la app cuyas novedades ya leyó cada persona ("¿Qué hay de nuevo?")
alter table public.perfiles add column if not exists version_vista text;

-- Última vez que la persona abrió la agenda (para ver en tu panel quién ya no entra)
alter table public.perfiles add column if not exists ultimo_acceso timestamptz;

create index if not exists citas_paciente_idx on public.citas (agenda_id, lower(paciente));

create index if not exists citas_fecha_idx on public.citas (fecha);
create index if not exists citas_agenda_fecha_idx on public.citas (agenda_id, fecha);

create or replace function public.tocar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists citas_updated_at on public.citas;
create trigger citas_updated_at
  before update on public.citas
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- MIGRACIÓN: si ya había datos de antes (una sola agenda), se vuelven la primera agenda.
-- Sólo corre la primera vez (cuando todavía no existe ninguna agenda).
-- ---------------------------------------------------------------------
do $$
declare
  a uuid;
begin
  if not exists (select 1 from public.agendas)
     and (exists (select 1 from public.citas) or exists (select 1 from public.clinicas)
          or exists (select 1 from public.perfiles p where p.id not in (select user_id from public.superadmins))) then
    insert into public.agendas (nombre, notas) values ('Agenda de clínicas', 'Primera agenda (migrada)') returning id into a;
    update public.perfiles set agenda_id = a
      where agenda_id is null and id not in (select user_id from public.superadmins);
    update public.clinicas set agenda_id = a where agenda_id is null;
    update public.materias set agenda_id = a where agenda_id is null;
    update public.citas    set agenda_id = a where agenda_id is null;
  end if;
end $$;

-- Ya con todo migrado, catálogos y citas SIEMPRE pertenecen a una agenda
alter table public.clinicas alter column agenda_id set not null;
alter table public.materias alter column agenda_id set not null;
alter table public.citas    alter column agenda_id set not null;

-- ---------------------------------------------------------------------
-- METAS: cuántos casos le pide cada materia a CADA persona (para "Mi avance")
-- ---------------------------------------------------------------------
create table if not exists public.metas (
  perfil_id   uuid not null references public.perfiles (id) on delete cascade,
  materia_id  uuid not null references public.materias (id) on delete cascade,
  meta        int  not null check (meta between 1 and 999),
  primary key (perfil_id, materia_id)
);

-- Si alguien alcanzó a usar la meta compartida (materias.meta), se copia a cada persona de la agenda y se quita
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'materias' and column_name = 'meta') then
    insert into public.metas (perfil_id, materia_id, meta)
      select p.id, m.id, m.meta from public.materias m join public.perfiles p on p.agenda_id = m.agenda_id
      where m.meta is not null
      on conflict do nothing;
    alter table public.materias drop column meta;
  end if;
end $$;

alter table public.metas enable row level security;
drop policy if exists metas_select on public.metas;
create policy metas_select on public.metas
  for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = perfil_id and p.agenda_id = (select public.mi_agenda())));
drop policy if exists metas_propias on public.metas;
create policy metas_propias on public.metas
  for all to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid())
              and exists (select 1 from public.materias m where m.id = materia_id and m.agenda_id = (select public.mi_agenda())));
grant select, insert, update, delete on public.metas to authenticated;

-- ---------------------------------------------------------------------
-- VERSIÓN 1.6: WhatsApp, cobros, material, banco de pacientes y horario de clínicas
-- ---------------------------------------------------------------------
-- Teléfono del paciente (para confirmar por WhatsApp) y cobro de material
alter table public.citas add column if not exists telefono text;
alter table public.citas add column if not exists cobro numeric(10,2);
alter table public.citas add column if not exists cobrado boolean not null default false;
alter table public.citas drop constraint if exists citas_cobro_valido;
alter table public.citas add constraint citas_cobro_valido check (cobro is null or cobro >= 0);

-- Qué llevar a cada cita de esa materia (una cosa por renglón)
alter table public.materias add column if not exists material text;

-- BANCO DE PACIENTES: gente por conseguir o en espera, por materia
create table if not exists public.pacientes (
  id          uuid primary key default gen_random_uuid(),
  agenda_id   uuid not null default public.mi_agenda() references public.agendas (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  telefono    text,
  materia_id  uuid references public.materias (id) on delete set null,
  notas       text,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'contactado', 'agendado', 'descartado')),
  created_at  timestamptz not null default now()
);
create index if not exists pacientes_agenda_idx on public.pacientes (agenda_id, owner_id);

-- HORARIO FIJO: "los martes de 8 a 12 tengo Clínica 1"
create table if not exists public.horarios (
  id          uuid primary key default gen_random_uuid(),
  agenda_id   uuid not null default public.mi_agenda() references public.agendas (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  dia_semana  int  not null check (dia_semana between 0 and 6), -- 0 = domingo
  hora_inicio time not null,
  hora_fin    time not null,
  clinica_id  uuid references public.clinicas (id) on delete set null,
  etiqueta    text,
  constraint horarios_horas_validas check (hora_fin > hora_inicio)
);
create index if not exists horarios_agenda_idx on public.horarios (agenda_id);

alter table public.pacientes enable row level security;
alter table public.horarios  enable row level security;

-- Los dos ven los de la agenda; cada quien edita sólo los suyos (y con la agenda activa)
drop policy if exists pacientes_select on public.pacientes;
create policy pacientes_select on public.pacientes for select to authenticated using (agenda_id = (select public.mi_agenda()));
drop policy if exists pacientes_propios on public.pacientes;
create policy pacientes_propios on public.pacientes for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.agenda_activa()))
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()));

drop policy if exists horarios_select on public.horarios;
create policy horarios_select on public.horarios for select to authenticated using (agenda_id = (select public.mi_agenda()));
drop policy if exists horarios_propios on public.horarios;
create policy horarios_propios on public.horarios for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()));

grant select, insert, update, delete on public.pacientes, public.horarios to authenticated;

-- ---------------------------------------------------------------------
-- MES GRATIS: una prueba por PERSONA (por correo), sea dueña o compañera.
-- No depende de la cuenta: si la cuenta se borra, el registro se queda.
-- ---------------------------------------------------------------------
create table if not exists public.pruebas (
  email        text primary key,          -- en minúsculas
  agenda_id    uuid,                      -- dónde la gastó (sin FK a propósito: sobrevive al borrado)
  usada_at     timestamptz,               -- NULL = la tiene disponible
  devuelta_at  timestamptz                -- ya se le devolvió una vez; no hay segunda
);
alter table public.pruebas enable row level security; -- sin políticas: sólo el servidor la toca

-- Hasta cuándo va el mes gratis de la agenda (NULL = nunca fue de prueba)
alter table public.agendas add column if not exists prueba_hasta date;

-- CÓDIGOS DE CREADOR: meses extra de prueba para quien llega con un código
create table if not exists public.codigos (
  codigo      text primary key check (codigo = upper(codigo) and codigo ~ '^[A-Z0-9_-]{3,30}$'),
  creador     text not null,
  meses_extra int  not null default 1 check (meses_extra between 1 and 12),
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.codigos enable row level security; -- sin políticas: sólo el servidor
alter table public.agendas add column if not exists codigo text references public.codigos (codigo) on update cascade on delete set null;

-- INVITACIONES a personas que YA tienen cuenta (para cambiarse de agenda)
create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  agenda_id   uuid not null references public.agendas (id) on delete cascade,
  email       text not null,
  rol         text not null default 'companero' check (rol in ('owner', 'companero')),
  created_at  timestamptz not null default now()
);
create unique index if not exists invitaciones_una_por_agenda_rol on public.invitaciones (agenda_id, rol);
create index if not exists invitaciones_email_idx on public.invitaciones (email);
alter table public.invitaciones enable row level security; -- sin políticas: sólo el servidor

-- ---------------------------------------------------------------------
-- RLS — cada quien ve SÓLO lo de su agenda. Nadie anónimo ve nada.
-- ---------------------------------------------------------------------
alter table public.agendas  enable row level security;
alter table public.perfiles enable row level security;
alter table public.clinicas enable row level security;
alter table public.materias enable row level security;
alter table public.citas    enable row level security;

drop policy if exists agendas_select on public.agendas;
create policy agendas_select on public.agendas
  for select to authenticated using (id = (select public.mi_agenda()));

drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or agenda_id = (select public.mi_agenda()));

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists clinicas_all on public.clinicas;
create policy clinicas_all on public.clinicas
  for all to authenticated
  using (agenda_id = (select public.mi_agenda()))
  with check (agenda_id = (select public.mi_agenda()));

drop policy if exists materias_all on public.materias;
create policy materias_all on public.materias
  for all to authenticated
  using (agenda_id = (select public.mi_agenda()))
  with check (agenda_id = (select public.mi_agenda()));

drop policy if exists citas_select on public.citas;
create policy citas_select on public.citas
  for select to authenticated using (agenda_id = (select public.mi_agenda()));

drop policy if exists citas_insert on public.citas;
create policy citas_insert on public.citas
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda())
              and (select public.agenda_activa()));

drop policy if exists citas_update on public.citas;
create policy citas_update on public.citas
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.agenda_activa()))
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()));

drop policy if exists citas_delete on public.citas;
create policy citas_delete on public.citas
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select public.agenda_activa()));

-- ---------------------------------------------------------------------
-- REALTIME (respeta RLS: cada agenda sólo recibe sus cambios)
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.citas;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.clinicas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.materias; exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------
-- RECORDATORIOS POR CORREO (bitácora de envíos; sólo la usa el servidor)
-- ---------------------------------------------------------------------
create table if not exists public.recordatorios_enviados (
  owner_id   uuid not null references public.perfiles (id) on delete cascade,
  fecha      date not null,
  enviado_at timestamptz not null default now(),
  primary key (owner_id, fecha)
);
alter table public.recordatorios_enviados enable row level security;

-- ---------------------------------------------------------------------
-- PAGOS (transferencia SPEI; los registra el superadmin o, en el futuro, un webhook)
-- ---------------------------------------------------------------------
create table if not exists public.pagos (
  id          uuid primary key default gen_random_uuid(),
  agenda_id   uuid not null references public.agendas (id) on delete cascade,
  monto       numeric not null check (monto >= 0),
  meses       int not null default 1 check (meses between 1 and 24),
  metodo      text not null default 'spei',   -- spei, efectivo, stripe, conekta…
  referencia  text,                           -- clave de rastreo, folio, etc.
  cubre_desde date not null,
  cubre_hasta date not null,
  created_at  timestamptz not null default now()
);
create index if not exists pagos_agenda_idx on public.pagos (agenda_id, created_at desc);

-- "Ya pagué": aviso del dueño para que el superadmin confirme
create table if not exists public.avisos_pago (
  id            uuid primary key default gen_random_uuid(),
  agenda_id     uuid not null references public.agendas (id) on delete cascade,
  reportado_por uuid references public.perfiles (id) on delete set null,
  monto         numeric,
  referencia    text,
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'descartado')),
  created_at    timestamptz not null default now()
);

-- Configuración general (datos bancarios para transferir). La edita el superadmin.
create table if not exists public.configuracion (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb
);
insert into public.configuracion (clave, valor)
values ('pago', '{"banco": "", "clabe": "", "titular": ""}'::jsonb)
on conflict (clave) do nothing;

alter table public.pagos         enable row level security;
alter table public.avisos_pago   enable row level security;
alter table public.configuracion enable row level security;

-- Registrar un pago de forma ATÓMICA: bloquea la agenda mientras calcula, para que dos
-- confirmaciones simultáneas (doble clic) no lean la misma fecha. Sólo la usa el servidor.
create or replace function public.registrar_pago(
  p_agenda uuid, p_monto numeric, p_meses int, p_metodo text, p_referencia text, p_hoy date
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hasta date;
  v_desde date;
  v_nuevo date;
begin
  select pagado_hasta into v_hasta from public.agendas where id = p_agenda for update;
  if not found then
    raise exception 'Agenda no encontrada';
  end if;
  v_desde := case when v_hasta is not null and v_hasta >= p_hoy then v_hasta + 1 else p_hoy end;
  v_nuevo := (v_desde + make_interval(months => p_meses))::date - 1;

  insert into public.pagos (agenda_id, monto, meses, metodo, referencia, cubre_desde, cubre_hasta)
  values (p_agenda, p_monto, p_meses, coalesce(nullif(p_metodo, ''), 'spei'), nullif(trim(p_referencia), ''), v_desde, v_nuevo);

  update public.agendas set pagado_hasta = v_nuevo where id = p_agenda;
  return v_nuevo;
end;
$$;

-- Anular el pago MÁS RECIENTE de una agenda (para corregir errores). Regresa la fecha a como estaba.
create or replace function public.anular_ultimo_pago(p_pago uuid)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.pagos%rowtype;
  v_ultimo uuid;
  v_fecha date;
begin
  select * into v_pago from public.pagos where id = p_pago;
  if not found then
    raise exception 'Pago no encontrado';
  end if;
  perform 1 from public.agendas where id = v_pago.agenda_id for update;
  select id into v_ultimo from public.pagos where agenda_id = v_pago.agenda_id order by created_at desc, cubre_hasta desc limit 1;
  if v_ultimo <> p_pago then
    raise exception 'Sólo se puede anular el pago más reciente';
  end if;
  delete from public.pagos where id = p_pago;
  -- Vuelve a como estaba, pero nunca por debajo de lo que cubren los pagos que quedan
  v_fecha := greatest(
    v_pago.cubre_desde - 1,
    (select max(cubre_hasta) from public.pagos where agenda_id = v_pago.agenda_id)
  );
  update public.agendas set pagado_hasta = v_fecha where id = v_pago.agenda_id;
  return v_fecha;
end;
$$;

-- Nadie desde la app puede llamarlas directamente; sólo el servidor (secret key)
revoke execute on function public.registrar_pago(uuid, numeric, int, text, text, date) from public, anon, authenticated;
revoke execute on function public.anular_ultimo_pago(uuid) from public, anon, authenticated;

-- El dueño ve el historial de pagos y avisos de SU agenda (escribe sólo el servidor)
drop policy if exists pagos_select on public.pagos;
create policy pagos_select on public.pagos
  for select to authenticated
  using (agenda_id = (select public.mi_agenda()) and (select public.soy_dueno()));

drop policy if exists avisos_select on public.avisos_pago;
create policy avisos_select on public.avisos_pago
  for select to authenticated
  using (agenda_id = (select public.mi_agenda()) and (select public.soy_dueno()));

-- Los datos bancarios los puede leer cualquier usuario con sesión (para saber a dónde transferir)
drop policy if exists configuracion_select on public.configuracion;
create policy configuracion_select on public.configuracion
  for select to authenticated using (clave = 'pago');

-- =====================================================================
-- 1.7 · REGISTRO LIBRE, LINK PARA EL COMPAÑERO, FOLIO E HISTORIA CLÍNICA
-- =====================================================================

-- Mes gratis: en Gmail, "pepi.to+2@gmail.com" y "pepito@gmail.com" son el mismo buzón.
-- Se guardan normalizados para que no se pueda repetir la prueba con ese truco.
create or replace function public.correo_prueba(e text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(lower(trim(e)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(e))
  end
$$;
-- Normaliza los registros que ya existían (si dos quedan iguales, se conserva el primero)
delete from public.pruebas a using public.pruebas b
  where a.ctid > b.ctid and public.correo_prueba(a.email) = public.correo_prueba(b.email);
update public.pruebas set email = public.correo_prueba(email) where email <> public.correo_prueba(email);

-- Link para que el compañero/a se una sin correo de invitación (uno por agenda; se renueva al usarse)
create table if not exists public.enlaces_union (
  agenda_id  uuid primary key references public.agendas (id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.enlaces_union enable row level security; -- sólo el servidor lo lee/escribe

-- Limpieza: si alguna vez corriste la versión con "link de citas (premium)", esto la quita.
drop table if exists public.avisos_premium;
alter table public.citas drop constraint if exists citas_origen_valido;
alter table public.citas drop column if exists origen;
drop index if exists public.perfiles_slug_idx;
alter table public.perfiles drop column if exists premium_hasta;
alter table public.perfiles drop column if exists slug;
alter table public.perfiles drop column if exists link_activo;
delete from public.configuracion where clave = 'premium';

-- Folio (del ticket de pago del tratamiento; los maestros lo piden como comprobante)
-- y No. de historia clínica del paciente. Son números de control, no datos clínicos.
alter table public.citas add column if not exists folio text;
alter table public.citas add column if not exists historia text;
alter table public.citas drop constraint if exists citas_folio_largo;
alter table public.citas add constraint citas_folio_largo check (folio is null or length(folio) <= 20);
alter table public.citas drop constraint if exists citas_historia_largo;
alter table public.citas add constraint citas_historia_largo check (historia is null or length(historia) <= 30);
create index if not exists citas_owner_paciente_idx on public.citas (owner_id, lower(paciente));

-- =====================================================================
-- 1.8 · UNIVERSIDAD DE CADA AGENDA (UPP / UADY) Y FUNCIONES DE LA UADY
-- =====================================================================

-- Cada agenda es de UNA universidad, se elige al registrarse y NUNCA cambia.
-- Las que ya existían son de la UPP (cuatrimestres, todo igual que antes).
-- La UADY va por semestres (ago–dic, ene–jul) y tiene ritmo, turnos, Mi material y duración por materia.
alter table public.agendas add column if not exists universidad text not null default 'upp';
alter table public.agendas drop constraint if exists agendas_universidad_valida;
alter table public.agendas add constraint agendas_universidad_valida check (universidad in ('upp', 'uady'));
-- Si alguna vez corriste la versión anterior de este bloque (con "periodos"), se quita: ahora sale de la universidad
alter table public.agendas drop constraint if exists agendas_periodos_valido;
alter table public.agendas drop column if exists periodos;

create or replace function public.universidad_fija()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.universidad is distinct from old.universidad then
    raise exception 'La universidad de una agenda no se puede cambiar.';
  end if;
  return new;
end;
$$;
drop trigger if exists agendas_universidad_fija on public.agendas;
create trigger agendas_universidad_fija before update on public.agendas
  for each row execute function public.universidad_fija();

-- Universidad de mi agenda (para las políticas de lo que es sólo de la UADY)
create or replace function public.mi_universidad()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.universidad from public.agendas a where a.id = public.mi_agenda()
$$;
grant execute on function public.mi_universidad() to authenticated;

-- UADY: en qué semana del semestre empiezan las clínicas (normalmente la 2ª)
alter table public.agendas add column if not exists semana_clinicas int not null default 1;
alter table public.agendas drop constraint if exists agendas_semana_valida;
alter table public.agendas add constraint agendas_semana_valida check (semana_clinicas between 1 and 8);

-- Turnos de la pareja: el caso le cuenta sólo al que opera.
-- 'ninguno' | 'hora' (una hora y una hora) | 'clinica' (una clínica y una clínica) | 'semana'
alter table public.agendas add column if not exists turnos text not null default 'ninguno';
alter table public.agendas drop constraint if exists agendas_turnos_valido;
alter table public.agendas add constraint agendas_turnos_valido check (turnos in ('ninguno', 'hora', 'clinica', 'semana'));
alter table public.agendas add column if not exists turnos_inicia uuid references public.perfiles (id) on delete set null;

-- Hasta cuándo hay clínicas este periodo (cada quien; si está vacío, hasta que acaba el periodo)
alter table public.perfiles add column if not exists fin_clinicas date;

-- Cuánto dura una cita de cada materia (Operatoria 3 h, Periodoncia 2 h…)
alter table public.materias add column if not exists duracion_min int;
alter table public.materias drop constraint if exists materias_duracion_valida;
alter table public.materias add constraint materias_duracion_valida check (duracion_min is null or duracion_min between 15 and 600);

-- Qué materia es cada bloque del horario (para contar las clínicas que te quedan por materia)
alter table public.horarios add column if not exists materia_id uuid references public.materias (id) on delete set null;

-- MI MATERIAL (sólo UADY): instrumental de cada quien (listo / usado / en CEyE) y consumibles de los dos (hay / poco / se acabó)
create table if not exists public.material (
  id            uuid primary key default gen_random_uuid(),
  agenda_id     uuid not null default public.mi_agenda() references public.agendas (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  compartido    boolean not null default false,
  nombre        text not null check (length(trim(nombre)) between 1 and 80),
  materia_id    uuid references public.materias (id) on delete set null,
  estado        text not null default 'listo' check (estado in ('listo', 'usado', 'ceye')),
  en_ceye_desde timestamptz,
  nivel         text not null default 'hay' check (nivel in ('hay', 'poco', 'nada')),
  cambiado_por  uuid references public.perfiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists material_agenda_idx on public.material (agenda_id, owner_id);

alter table public.material enable row level security;
-- Los dos ven todo; lo tuyo sólo lo editas tú y lo compartido cualquiera de los dos
drop policy if exists material_select on public.material;
create policy material_select on public.material for select to authenticated using (agenda_id = (select public.mi_agenda()));
drop policy if exists material_insert on public.material;
create policy material_insert on public.material for insert to authenticated
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()) and (select public.agenda_activa())
              and (select public.mi_universidad()) = 'uady');
drop policy if exists material_update on public.material;
create policy material_update on public.material for update to authenticated
  using (agenda_id = (select public.mi_agenda()) and (owner_id = (select auth.uid()) or compartido) and (select public.agenda_activa()))
  with check (agenda_id = (select public.mi_agenda()) and (owner_id = (select auth.uid()) or compartido));
drop policy if exists material_delete on public.material;
create policy material_delete on public.material for delete to authenticated
  using (agenda_id = (select public.mi_agenda()) and (owner_id = (select auth.uid()) or compartido));
grant select, insert, update, delete on public.material to authenticated;

-- =====================================================================
-- 1.8 · PANEL DE STAFF: BUZÓN DE SUGERENCIAS, ANUNCIOS Y PLAN ANUAL
-- =====================================================================

-- "Ya pagué" puede ser por un mes o por un año (plan anual, si lo activas para esa universidad)
alter table public.avisos_pago add column if not exists meses int not null default 1;
alter table public.avisos_pago drop constraint if exists avisos_pago_meses_valido;
alter table public.avisos_pago add constraint avisos_pago_meses_valido check (meses between 1 and 24);

-- Buzón: "¿Qué le falta a tu agenda?". Sólo el servidor lo escribe y lo lee (con límite por día).
create table if not exists public.sugerencias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.perfiles (id) on delete cascade,
  agenda_id   uuid references public.agendas (id) on delete set null,
  texto       text not null check (length(trim(texto)) between 3 and 2000),
  estado      text not null default 'nueva' check (estado in ('nueva', 'leida', 'hecha')),
  created_at  timestamptz not null default now()
);
create index if not exists sugerencias_fecha_idx on public.sugerencias (created_at desc);
alter table public.sugerencias enable row level security; -- sin políticas: sólo el servidor

-- Anuncios del staff: salen arriba de la agenda (a todas, sólo UPP o sólo UADY) hasta que venzan
create table if not exists public.anuncios (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(trim(titulo)) between 1 and 80),
  texto        text not null check (length(trim(texto)) between 1 and 600),
  universidad  text not null default 'todas' check (universidad in ('todas', 'upp', 'uady')),
  hasta        date,                       -- vacío = hasta que lo apagues
  activo       boolean not null default true,
  correos      int not null default 0,     -- a cuántas personas se les mandó por correo
  created_at   timestamptz not null default now()
);
alter table public.anuncios enable row level security;
drop policy if exists anuncios_select on public.anuncios;
create policy anuncios_select on public.anuncios for select to authenticated
  using (activo and (hasta is null or hasta >= current_date)
         and (universidad = 'todas' or universidad = (select public.mi_universidad())));
grant select on public.anuncios to authenticated;

-- =====================================================================
-- 2.0 · GRATIS + PRO, PLANES, CONFIRMACIÓN DEL PACIENTE, NOTIFICACIONES Y CALENDARIO
-- =====================================================================

-- Ya no hay "sólo lectura": sin Pro la agenda sigue funcionando en GRATIS.
-- agenda_activa() ahora sólo pide tener agenda; lo de Pro lo revisa agenda_pro().
create or replace function public.agenda_activa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mi_agenda() is not null
$$;

-- ¿La agenda tiene Pro? (prueba o pagada vigente; sin fecha = cortesía = Pro)
create or replace function public.agenda_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.pagado_hasta is null or a.pagado_hasta >= (now() at time zone 'America/Merida')::date
       from public.agendas a where a.id = public.mi_agenda()),
    false)
$$;
grant execute on function public.agenda_pro() to authenticated;

-- Lo que es de Pro también se cuida en la base: banco de pacientes y Mi material
drop policy if exists pacientes_propios on public.pacientes;
create policy pacientes_propios on public.pacientes for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.agenda_pro()))
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()) and (select public.agenda_pro()));
drop policy if exists material_insert on public.material;
create policy material_insert on public.material for insert to authenticated
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()) and (select public.agenda_pro())
              and (select public.mi_universidad()) = 'uady');
drop policy if exists material_update on public.material;
create policy material_update on public.material for update to authenticated
  using (agenda_id = (select public.mi_agenda()) and (owner_id = (select auth.uid()) or compartido) and (select public.agenda_pro()))
  with check (agenda_id = (select public.mi_agenda()) and (owner_id = (select auth.uid()) or compartido));

-- Código de creador: ahora da DÍAS extra (15 por defecto) en vez de meses
alter table public.codigos add column if not exists dias_extra int not null default 15;
alter table public.codigos drop constraint if exists codigos_dias_validos;
alter table public.codigos add constraint codigos_dias_validos check (dias_extra between 1 and 120);

-- El paciente confirma solo: cada cita tiene su link secreto
alter table public.citas add column if not exists token_confirmar text default replace(gen_random_uuid()::text, '-', '');
update public.citas set token_confirmar = replace(gen_random_uuid()::text, '-', '') where token_confirmar is null;
create unique index if not exists citas_token_confirmar_idx on public.citas (token_confirmar);
alter table public.citas add column if not exists confirmacion text;
alter table public.citas drop constraint if exists citas_confirmacion_valida;
alter table public.citas add constraint citas_confirmacion_valida check (confirmacion is null or confirmacion in ('confirmada', 'no_puede'));
alter table public.citas add column if not exists confirmacion_at timestamptz;
alter table public.citas add column if not exists aviso_push_at timestamptz; -- ya se mandó el "en 1 hora"

-- Notificaciones en el celular (Web Push): una suscripción por navegador. Sólo el servidor la toca.
create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null references public.perfiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;

-- Tu agenda en el calendario del cel: link secreto por persona (se puede regenerar)
alter table public.perfiles add column if not exists cal_token text;
create unique index if not exists perfiles_cal_token_idx on public.perfiles (cal_token);

-- Pagos en línea: Mercado Pago no se registra dos veces el mismo pago
create unique index if not exists pagos_mp_unico on public.pagos (referencia) where metodo = 'mercadopago';

-- =====================================================================
-- 2.1 · AGENDA PERSONAL (sólo invitados; aparte de la agenda de clínicas)
--   Tú das de alta el correo desde tu panel (pestaña Personales). En /login
--   "¿Tienes agenda propia?" le manda un link a /personal. Todo es privado:
--   cada quien ve sólo lo suyo; el compa de clínica no ve nada de esto.
-- =====================================================================
create table if not exists public.personales (
  user_id      uuid primary key references public.perfiles (id) on delete cascade,
  nombre       text,
  activo       boolean not null default true,
  prefs        jsonb not null default '{}'::jsonb,   -- { correo: bool }
  password_at  timestamptz,                          -- cuándo puso su contraseña
  enlace_at    timestamptz,                          -- último link enviado (anti-spam)
  ultimo_acceso timestamptz,
  pagado_hasta date,                                 -- reservado (hoy es gratis)
  created_at   timestamptz not null default now()
);
alter table public.personales enable row level security;

-- ¿Esta sesión tiene agenda personal activa?
create or replace function public.soy_personal()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.personales p where p.user_id = auth.uid() and p.activo);
$$;

drop policy if exists personales_ver on public.personales;
create policy personales_ver on public.personales for select to authenticated using (user_id = auth.uid());
drop policy if exists personales_editar on public.personales;
create policy personales_editar on public.personales for update to authenticated
  using (user_id = auth.uid() and activo) with check (user_id = auth.uid() and activo);
-- (activo, alta y baja sólo desde el servidor)
create or replace function public.personales_proteger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' then
    new.activo := old.activo; new.user_id := old.user_id; new.pagado_hasta := old.pagado_hasta;
    new.created_at := old.created_at; new.enlace_at := old.enlace_at; new.password_at := old.password_at;
  end if;
  return new;
end;
$$;
drop trigger if exists personales_proteger on public.personales;
create trigger personales_proteger before update on public.personales for each row execute function public.personales_proteger();

create table if not exists public.p_categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 40),
  color      text not null default '#6366f1',
  orden      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists p_categorias_user_idx on public.p_categorias (user_id);
alter table public.p_categorias enable row level security;
drop policy if exists p_categorias_propias on public.p_categorias;
create policy p_categorias_propias on public.p_categorias for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (user_id = auth.uid() and public.soy_personal());

create table if not exists public.p_eventos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  tipo          text not null default 'evento' check (tipo in ('evento', 'viaje', 'entrega', 'recordatorio')),
  titulo        text not null check (char_length(titulo) between 1 and 120),
  fecha         date not null,
  fecha_fin     date,                 -- viajes (varios días)
  hora_inicio   time,                 -- null = todo el día
  hora_fin      time,
  lugar         text check (lugar is null or char_length(lugar) <= 120),
  notas         text check (notas is null or char_length(notas) <= 1000),
  categoria_id  uuid references public.p_categorias (id) on delete set null,
  hecho         boolean not null default false,   -- entregas
  hecho_at      timestamptz,
  repetir       text not null default 'nunca' check (repetir in ('nunca', 'diario', 'semanal', 'quincenal', 'mensual')),
  repetir_hasta date,
  excepciones   date[] not null default '{}',     -- días borrados de una serie
  aviso_push_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint p_eventos_fechas check (fecha_fin is null or fecha_fin >= fecha),
  constraint p_eventos_horas check (hora_fin is null or hora_inicio is null or hora_fin > hora_inicio)
);
create index if not exists p_eventos_user_fecha_idx on public.p_eventos (user_id, fecha);
alter table public.p_eventos enable row level security;
drop policy if exists p_eventos_propios on public.p_eventos;
create policy p_eventos_propios on public.p_eventos for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (user_id = auth.uid() and public.soy_personal());
drop trigger if exists p_eventos_updated_at on public.p_eventos;
create trigger p_eventos_updated_at before update on public.p_eventos for each row execute function public.tocar_updated_at();

grant select, insert, update, delete on public.p_categorias, public.p_eventos to authenticated;
grant select, update on public.personales to authenticated;

-- =====================================================================
-- 2.2 · "La quiero": solicitudes de agenda personal desde la de clínicas
-- =====================================================================
create table if not exists public.p_solicitudes (
  user_id     uuid primary key references public.perfiles (id) on delete cascade,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'descartada')),
  created_at  timestamptz not null default now(),
  resuelta_at timestamptz
);
alter table public.p_solicitudes enable row level security;
drop policy if exists p_solicitudes_ver on public.p_solicitudes;
create policy p_solicitudes_ver on public.p_solicitudes for select to authenticated using (user_id = auth.uid());
grant select on public.p_solicitudes to authenticated;
-- (las crea y resuelve sólo el servidor)

-- =====================================================================
-- 2.3 · Mi agenda para cualquiera: registro abierto, tipo (odonto / general) y planes Gratis / Pro
-- =====================================================================
alter table public.personales add column if not exists perfil text not null default 'odonto';
alter table public.personales drop constraint if exists personales_perfil_valido;
alter table public.personales add constraint personales_perfil_valido check (perfil in ('odonto', 'general'));
alter table public.personales add column if not exists prueba_hasta date; -- hasta cuándo va su prueba de Pro (NULL = no la ha activado)
-- pagado_hasta (ya existía): NULL = cortesía (Pro siempre), fecha = Pro hasta ese día, pasada = Gratis

-- Una prueba de Mi agenda por correo (aparte de la de clínicas)
alter table public.pruebas add column if not exists mi_usada_at timestamptz;

-- Ni el tipo ni el plan los cambia la persona: sólo el servidor
create or replace function public.personales_proteger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' then
    new.activo := old.activo; new.user_id := old.user_id; new.pagado_hasta := old.pagado_hasta;
    new.created_at := old.created_at; new.enlace_at := old.enlace_at; new.password_at := old.password_at;
    new.perfil := old.perfil; new.prueba_hasta := old.prueba_hasta;
  end if;
  return new;
end;
$$;

-- ¿Mi agenda es Pro? Por su plan (o cortesía) o porque su agenda de clínicas es Pro
create or replace function public.personal_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.pagado_hasta is null or p.pagado_hasta >= (now() at time zone 'America/Merida')::date
       from public.personales p where p.user_id = auth.uid()), false)
    or (public.mi_agenda() is not null and public.agenda_pro())
$$;
grant execute on function public.personal_pro() to authenticated;

-- Lo de Pro también se cuida en la base: viajes nuevos y crear/editar categorías.
-- (Eventos, entregas, recordatorios y repetir son de Gratis. Lo que ya tenía se queda y se puede editar.)
create or replace function public.p_eventos_pro()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' and not public.personal_pro() then
    if tg_op = 'INSERT' and new.tipo = 'viaje' then
      raise exception 'Eso es de Pro' using errcode = 'P0001', hint = 'pro';
    end if;
    if tg_op = 'UPDATE' and new.tipo = 'viaje' and old.tipo <> 'viaje' then
      raise exception 'Eso es de Pro' using errcode = 'P0001', hint = 'pro';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists p_eventos_pro on public.p_eventos;
create trigger p_eventos_pro before insert or update on public.p_eventos for each row execute function public.p_eventos_pro();

create or replace function public.p_categorias_pro()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' and not public.personal_pro() then
    raise exception 'Tus categorías y colores son de Pro' using errcode = 'P0001', hint = 'pro';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists p_categorias_pro on public.p_categorias;
create trigger p_categorias_pro before insert or update or delete on public.p_categorias for each row execute function public.p_categorias_pro();

-- Pagos de Mi agenda (por persona, no por agenda de clínicas)
create table if not exists public.p_pagos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.perfiles (id) on delete cascade,
  monto       numeric not null,
  meses       int not null check (meses between 1 and 24),
  metodo      text not null default 'spei',
  referencia  text,
  cubre_desde date not null,
  cubre_hasta date not null,
  created_at  timestamptz not null default now()
);
create index if not exists p_pagos_user_idx on public.p_pagos (user_id, created_at);
alter table public.p_pagos enable row level security; -- sólo el servidor

create table if not exists public.p_avisos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.perfiles (id) on delete cascade,
  monto       numeric not null,
  meses       int not null default 1,
  referencia  text,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'rechazado')),
  created_at  timestamptz not null default now(),
  resuelto_at timestamptz
);
create index if not exists p_avisos_estado_idx on public.p_avisos (estado, created_at);
alter table public.p_avisos enable row level security; -- sólo el servidor

-- Registrar un pago y extender pagado_hasta de forma atómica (igual que registrar_pago de clínicas)
create or replace function public.registrar_pago_personal(
  p_user uuid, p_monto numeric, p_meses int, p_metodo text, p_referencia text, p_hoy date
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hasta date;
  v_desde date;
  v_nuevo date;
begin
  select pagado_hasta into v_hasta from public.personales where user_id = p_user for update;
  if not found then
    raise exception 'Agenda personal no encontrada';
  end if;
  v_desde := case when v_hasta is not null and v_hasta >= p_hoy then v_hasta + 1 else p_hoy end;
  v_nuevo := (v_desde + make_interval(months => p_meses))::date - 1;
  insert into public.p_pagos (user_id, monto, meses, metodo, referencia, cubre_desde, cubre_hasta)
  values (p_user, p_monto, p_meses, coalesce(nullif(p_metodo, ''), 'spei'), nullif(trim(p_referencia), ''), v_desde, v_nuevo);
  update public.personales set pagado_hasta = v_nuevo where user_id = p_user;
  return v_nuevo;
end;
$$;
revoke execute on function public.registrar_pago_personal(uuid, numeric, int, text, text, date) from public, anon, authenticated;

-- =====================================================================
-- 2.4 · Mi agenda: cada año, pendientes, hábitos con racha y aviso a la hora
-- =====================================================================
alter table public.p_eventos drop constraint if exists p_eventos_repetir_check;
alter table public.p_eventos add constraint p_eventos_repetir_check
  check (repetir in ('nunca', 'diario', 'semanal', 'quincenal', 'mensual', 'anual'));

create table if not exists public.p_pendientes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  padre_id   uuid references public.p_pendientes (id) on delete cascade,   -- subtarea
  titulo     text not null check (char_length(titulo) between 1 and 200),
  notas      text check (notas is null or char_length(notas) <= 1000),
  lista      text not null default 'hacer' check (lista in ('hacer', 'algun_dia')),
  fecha      date,                                -- "para el…" (opcional)
  hecho      boolean not null default false,
  hecho_at   timestamptz,
  orden      double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists p_pendientes_user_idx on public.p_pendientes (user_id);
alter table public.p_pendientes enable row level security;
drop policy if exists p_pendientes_propios on public.p_pendientes;
create policy p_pendientes_propios on public.p_pendientes for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (user_id = auth.uid() and public.soy_personal());

create table if not exists public.p_habitos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 60),
  color      text not null default '#2f6f5e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  dias       int[] not null default '{0,1,2,3,4,5,6}',   -- 0 = domingo
  orden      double precision not null default 0,
  archivado  boolean not null default false,
  created_at timestamptz not null default now(),
  constraint p_habitos_dias check (cardinality(dias) between 1 and 7 and dias <@ array[0,1,2,3,4,5,6])
);
create index if not exists p_habitos_user_idx on public.p_habitos (user_id);
alter table public.p_habitos enable row level security;
drop policy if exists p_habitos_propios on public.p_habitos;
create policy p_habitos_propios on public.p_habitos for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (user_id = auth.uid() and public.soy_personal());

create table if not exists public.p_habito_marcas (
  habito_id uuid not null references public.p_habitos (id) on delete cascade,
  user_id   uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  fecha     date not null,
  primary key (habito_id, fecha)
);
create index if not exists p_habito_marcas_user_idx on public.p_habito_marcas (user_id, fecha);
alter table public.p_habito_marcas enable row level security;
drop policy if exists p_habito_marcas_propias on public.p_habito_marcas;
create policy p_habito_marcas_propias on public.p_habito_marcas for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (
    user_id = auth.uid() and public.soy_personal()
    and exists (select 1 from public.p_habitos h where h.id = habito_id and h.user_id = auth.uid())
  );

grant select, insert, update, delete on public.p_pendientes, public.p_habitos, public.p_habito_marcas to authenticated;

-- Avisos ya mandados (uno por recordatorio y día; sirve también para los que se repiten). Sólo el servidor.
create table if not exists public.p_push_enviados (
  evento_id uuid not null references public.p_eventos (id) on delete cascade,
  dia       date not null,
  primary key (evento_id, dia)
);
alter table public.p_push_enviados enable row level security;
revoke all on public.p_push_enviados from anon, authenticated;

-- =====================================================================
-- 2.5 · Mi agenda: viajes completos (itinerario, maleta, reservas, gastos) y pagos fijos. Pro.
-- (En Gratis lo que ya tenías se ve, se edita y se palomea; sólo no se crea nuevo.)
-- =====================================================================
alter table public.p_eventos add column if not exists presupuesto numeric(12,2);
alter table public.p_eventos drop constraint if exists p_eventos_presupuesto;
alter table public.p_eventos add constraint p_eventos_presupuesto check (presupuesto is null or presupuesto >= 0);

create table if not exists public.p_viaje_cosas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  viaje_id   uuid not null references public.p_eventos (id) on delete cascade,
  tipo       text not null check (tipo in ('itinerario', 'maleta', 'reserva', 'gasto')),
  subtipo    text check (subtipo is null or subtipo in ('vuelo', 'hotel', 'auto', 'actividad', 'otro')),
  titulo     text not null check (char_length(titulo) between 1 and 200),
  fecha      date,
  hora       time,
  detalle    text check (detalle is null or char_length(detalle) <= 500),
  monto      numeric(12,2) check (monto is null or monto >= 0),
  hecho      boolean not null default false,
  orden      double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists p_viaje_cosas_user_idx on public.p_viaje_cosas (user_id);
create index if not exists p_viaje_cosas_viaje_idx on public.p_viaje_cosas (viaje_id);
alter table public.p_viaje_cosas enable row level security;
drop policy if exists p_viaje_cosas_propias on public.p_viaje_cosas;
create policy p_viaje_cosas_propias on public.p_viaje_cosas for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (
    user_id = auth.uid() and public.soy_personal()
    and exists (select 1 from public.p_eventos e where e.id = viaje_id and e.user_id = auth.uid() and e.tipo = 'viaje')
  );

create table if not exists public.p_pagos_fijos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 80),
  monto       numeric(12,2) not null default 0 check (monto >= 0),
  frecuencia  text not null default 'mensual' check (frecuencia in ('mensual', 'anual')),
  dia         int not null check (dia between 1 and 31),
  mes         int check (mes is null or mes between 1 and 12),
  avisar_dias int not null default 3 check (avisar_dias between 0 and 15),
  desde       date not null default current_date,
  activo      boolean not null default true,
  notas       text check (notas is null or char_length(notas) <= 500),
  created_at  timestamptz not null default now(),
  constraint p_pagos_fijos_anual check (frecuencia = 'mensual' or mes is not null)
);
create index if not exists p_pagos_fijos_user_idx on public.p_pagos_fijos (user_id);
alter table public.p_pagos_fijos enable row level security;
drop policy if exists p_pagos_fijos_propios on public.p_pagos_fijos;
create policy p_pagos_fijos_propios on public.p_pagos_fijos for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (user_id = auth.uid() and public.soy_personal());

-- "Ya pagué": uno por pago y vencimiento
create table if not exists public.p_pagos_fijos_hechos (
  pago_id   uuid not null references public.p_pagos_fijos (id) on delete cascade,
  user_id   uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  periodo   date not null,          -- la fecha en que tocaba pagar
  monto     numeric(12,2) check (monto is null or monto >= 0),
  pagado_at timestamptz not null default now(),
  primary key (pago_id, periodo)
);
create index if not exists p_pagos_fijos_hechos_user_idx on public.p_pagos_fijos_hechos (user_id, periodo);
alter table public.p_pagos_fijos_hechos enable row level security;
drop policy if exists p_pagos_fijos_hechos_propios on public.p_pagos_fijos_hechos;
create policy p_pagos_fijos_hechos_propios on public.p_pagos_fijos_hechos for all to authenticated
  using (user_id = auth.uid() and public.soy_personal())
  with check (
    user_id = auth.uid() and public.soy_personal()
    and exists (select 1 from public.p_pagos_fijos f where f.id = pago_id and f.user_id = auth.uid())
  );

grant select, insert, update, delete on public.p_viaje_cosas, public.p_pagos_fijos, public.p_pagos_fijos_hechos to authenticated;

-- Crear cosas nuevas de viaje o pagos fijos es de Pro
create or replace function public.p_nuevo_pro()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' and not public.personal_pro() then
    raise exception 'Eso es de Pro' using errcode = 'P0001', hint = 'pro';
  end if;
  return new;
end;
$$;
drop trigger if exists p_viaje_cosas_pro on public.p_viaje_cosas;
create trigger p_viaje_cosas_pro before insert on public.p_viaje_cosas for each row execute function public.p_nuevo_pro();
drop trigger if exists p_pagos_fijos_pro on public.p_pagos_fijos;
create trigger p_pagos_fijos_pro before insert on public.p_pagos_fijos for each row execute function public.p_nuevo_pro();

-- =====================================================================
-- 2.7 · Mi agenda: avisar X minutos antes y hábitos que te avisan a su hora
-- =====================================================================
-- Minutos antes de la hora (0 = a la hora). Recordatorios: null = a la hora. Eventos: null = sin aviso.
alter table public.p_eventos add column if not exists aviso_min int;
alter table public.p_eventos drop constraint if exists p_eventos_aviso_min;
alter table public.p_eventos add constraint p_eventos_aviso_min check (aviso_min is null or aviso_min between 0 and 1440);

-- Hora a la que el hábito te pregunta "¿ya lo hiciste?" (null = no avisa)
alter table public.p_habitos add column if not exists hora time;

-- Avisos de hábitos ya mandados (uno por hábito y día). Sólo el servidor.
create table if not exists public.p_habitos_avisados (
  habito_id uuid not null references public.p_habitos (id) on delete cascade,
  dia       date not null,
  primary key (habito_id, dia)
);
alter table public.p_habitos_avisados enable row level security;
revoke all on public.p_habitos_avisados from anon, authenticated;

-- =====================================================================
-- 2.9 · Mi agenda: "Invita a un amigo" (los dos ganan un mes de Pro; máximo 6 por persona)
-- =====================================================================
create table if not exists public.p_invitaciones (
  id         uuid primary key default gen_random_uuid(),
  correo     text not null unique,   -- a cada correo sólo lo premian una vez (aunque borre su cuenta y vuelva)
  invitado   uuid references public.perfiles (id) on delete set null,
  invitador  uuid not null references public.perfiles (id) on delete cascade,
  dias       int not null default 30,
  created_at timestamptz not null default now()
);
create index if not exists p_invitaciones_invitador_idx on public.p_invitaciones (invitador);
alter table public.p_invitaciones enable row level security;
revoke all on public.p_invitaciones from anon, authenticated;  -- sólo el servidor

-- (2.9: las solicitudes "La quiero" con aprobación ya no se usan; la tabla p_solicitudes se queda por historial)

-- =====================================================================
-- Listo. Las cuentas nuevas se registran solas en /registro.
-- En Supabase: Authentication → Sign In / Providers → Email:
--   "Enable email signups" y "Confirm email" ENCENDIDOS.
-- Y pega supabase/email-confirmar.html en la plantilla "Confirm signup".
-- =====================================================================

-- =====================================================================
-- 3.0 · Mi agenda: pendientes con prioridad, lista y bloque de tiempo; compartir; avisos de bloques
-- =====================================================================
-- Prioridad (0 normal, 1 importante, 2 urgente) y lista/etiqueta libre ("Casa", "Escuela"…)
alter table public.p_pendientes add column if not exists prioridad smallint not null default 0;
alter table public.p_pendientes drop constraint if exists p_pendientes_prioridad;
alter table public.p_pendientes add constraint p_pendientes_prioridad check (prioridad between 0 and 2);
alter table public.p_pendientes add column if not exists etiqueta text;
alter table public.p_pendientes drop constraint if exists p_pendientes_etiqueta;
alter table public.p_pendientes add constraint p_pendientes_etiqueta check (etiqueta is null or char_length(etiqueta) between 1 and 30);
-- Bloque de tiempo: con fecha + hora sale en la línea del tiempo de Hoy (duración en minutos)
alter table public.p_pendientes add column if not exists hora time;
alter table public.p_pendientes add column if not exists duracion int;
alter table public.p_pendientes drop constraint if exists p_pendientes_duracion;
alter table public.p_pendientes add constraint p_pendientes_duracion check (duracion is null or duracion between 5 and 720);

-- Avisos de bloques ya mandados (uno por pendiente y día). Sólo el servidor.
create table if not exists public.p_pendientes_avisados (
  pendiente_id uuid not null references public.p_pendientes (id) on delete cascade,
  dia          date not null,
  primary key (pendiente_id, dia)
);
alter table public.p_pendientes_avisados enable row level security;
revoke all on public.p_pendientes_avisados from anon, authenticated;

-- Compartir un evento (o viaje) o un pendiente con otra persona, por correo.
-- Quien lo recibe lo ve en su agenda (los eventos sólo para ver; los pendientes los puede palomear).
-- Todo pasa por el servidor: nadie ve la agenda de otro, sólo lo que le compartieron.
create table if not exists public.p_compartidos (
  id           uuid primary key default gen_random_uuid(),
  dueno        uuid not null references public.perfiles (id) on delete cascade,
  evento_id    uuid references public.p_eventos (id) on delete cascade,
  pendiente_id uuid references public.p_pendientes (id) on delete cascade,
  correo       text not null check (char_length(correo) between 3 and 200),
  invitado     uuid references public.perfiles (id) on delete cascade,
  oculto       boolean not null default false,   -- quien lo recibe lo quitó de su agenda
  created_at   timestamptz not null default now(),
  constraint p_compartidos_uno check ((evento_id is null) <> (pendiente_id is null))
);
create unique index if not exists p_compartidos_evento_correo on public.p_compartidos (evento_id, correo) where evento_id is not null;
create unique index if not exists p_compartidos_pendiente_correo on public.p_compartidos (pendiente_id, correo) where pendiente_id is not null;
create index if not exists p_compartidos_dueno_idx on public.p_compartidos (dueno, created_at);
create index if not exists p_compartidos_correo_idx on public.p_compartidos (correo);
alter table public.p_compartidos enable row level security;
revoke all on public.p_compartidos from anon, authenticated;  -- sólo el servidor

-- =====================================================================
-- 3.1 · Agenda de clínicas: comprobar que es estudiante con su correo institucional
--   Para crear una agenda de clínicas nueva (no para unirse con el link de un compañero/a).
--   Del correo institucional sólo se guarda una huella (hash), para que sirva para una sola cuenta.
--   Plan B: si no tiene acceso a su correo, lo pide y tú lo apruebas a mano en tu panel.
-- =====================================================================
create table if not exists public.verificaciones_escolares (
  user_id        uuid primary key references public.perfiles (id) on delete cascade,
  universidad    text not null,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'verificado', 'manual', 'aprobado', 'rechazado')),
  metodo         text check (metodo is null or metodo in ('codigo', 'cuenta', 'staff')),
  correo_hash    text,                 -- huella del correo institucional (no el correo)
  dominio        text,
  codigo_hash    text,
  codigo_expira  timestamptz,
  intentos       int not null default 0,
  enviado_at     timestamptz,
  envios_dia     date,
  envios         int not null default 0,
  nota           text check (nota is null or char_length(nota) <= 500),   -- plan B: lo que escribió para el staff
  verificado_at  timestamptz,
  created_at     timestamptz not null default now()
);
-- Un correo institucional verifica una sola cuenta
create unique index if not exists verificaciones_correo_unico on public.verificaciones_escolares (correo_hash) where estado = 'verificado';
create index if not exists verificaciones_estado_idx on public.verificaciones_escolares (estado, created_at);
alter table public.verificaciones_escolares enable row level security;
revoke all on public.verificaciones_escolares from anon, authenticated;  -- sólo el servidor
-- 3.1 · A quien ya tenía agenda de clínicas: aviso con plazo (14 días desde que lo ve por primera vez) para verificar
alter table public.verificaciones_escolares add column if not exists plazo date;

-- =====================================================================
-- 3.2 · Hábitos: comodín de racha (salva el día de ayer) y hábitos con amigos
-- =====================================================================
-- Comodín: una marca especial que cuenta para la racha (no para el %). Gratis: 1 al mes. Pro: 1 por semana.
alter table public.p_habito_marcas add column if not exists comodin boolean not null default false;
alter table public.p_habito_marcas add column if not exists comodin_at timestamptz;

create or replace function public.p_comodin_tope()
returns trigger language plpgsql set search_path = '' as $$
declare
  hoy date := (now() at time zone 'America/Merida')::date;
  desde date;
  n int;
begin
  if not new.comodin then
    new.comodin_at := null;
    return new;
  end if;
  new.comodin_at := now();
  if auth.role() = 'authenticated' then
    if new.fecha <> hoy - 1 then
      raise exception 'El comodín sólo salva el día de ayer' using errcode = 'P0001', hint = 'comodin';
    end if;
    if public.personal_pro() then
      desde := hoy - (extract(isodow from hoy)::int - 1);       -- desde el lunes
    else
      desde := date_trunc('month', hoy)::date;                  -- desde el día 1
    end if;
    select count(*) into n from public.p_habito_marcas m
      where m.user_id = new.user_id and m.comodin and (m.comodin_at at time zone 'America/Merida')::date >= desde;
    if n >= 1 then
      raise exception 'Ya usaste tu comodín' using errcode = 'P0001', hint = 'comodin';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists p_comodin_tope on public.p_habito_marcas;
create trigger p_comodin_tope before insert on public.p_habito_marcas for each row execute function public.p_comodin_tope();

-- Hábitos con amigos: se comparte un hábito; quien acepta tiene SU copia (cada quien palomea la suya) y ven la racha del otro.
alter table public.p_compartidos add column if not exists habito_id uuid references public.p_habitos (id) on delete cascade;
alter table public.p_compartidos add column if not exists aceptado_at timestamptz;
alter table public.p_compartidos drop constraint if exists p_compartidos_uno;
alter table public.p_compartidos add constraint p_compartidos_uno check (num_nonnulls(evento_id, pendiente_id, habito_id) = 1);
create unique index if not exists p_compartidos_habito_correo on public.p_compartidos (habito_id, correo) where habito_id is not null;
alter table public.p_habitos add column if not exists compartido_id uuid references public.p_compartidos (id) on delete set null;
-- (quien lo recibe no puede cambiar a mano de quién es su copia: sólo el servidor)
create or replace function public.p_habitos_proteger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then new.compartido_id := null;
    else new.compartido_id := old.compartido_id; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists p_habitos_proteger on public.p_habitos;
create trigger p_habitos_proteger before insert or update on public.p_habitos for each row execute function public.p_habitos_proteger();

-- =====================================================================
-- 3.3 · Anuncios también para Mi agenda: ¿para quién? clínicas, Mi agenda o todos
-- =====================================================================
alter table public.anuncios add column if not exists para text not null default 'clinicas';
alter table public.anuncios drop constraint if exists anuncios_para;
alter table public.anuncios add constraint anuncios_para check (para in ('clinicas', 'mi', 'todos'));
