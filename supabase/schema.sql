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
-- Listo. Las cuentas nuevas se registran solas en /registro.
-- En Supabase: Authentication → Sign In / Providers → Email:
--   "Enable email signups" y "Confirm email" ENCENDIDOS.
-- Y pega supabase/email-confirmar.html en la plantilla "Confirm signup".
-- =====================================================================
