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
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()));

drop policy if exists citas_update on public.citas;
create policy citas_update on public.citas
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and agenda_id = (select public.mi_agenda()));

drop policy if exists citas_delete on public.citas;
create policy citas_delete on public.citas
  for delete to authenticated
  using (owner_id = (select auth.uid()));

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

-- =====================================================================
-- Listo. Después: entra a /admin con tu cuenta para asignar al dueño de
-- cada agenda o crear agendas nuevas para tus clientes.
-- =====================================================================
