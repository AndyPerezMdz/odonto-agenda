-- =====================================================================
--  AGENDA DE CLÍNICAS — Esquema de Supabase
--  Pégalo completo en: Supabase → SQL Editor → New query → Run
--  Es idempotente: lo puedes volver a correr sin romper nada.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- PERFILES (uno por usuario de auth). Nombre, color y preferencias.
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null default 'Sin nombre',
  color       text not null default '#6366f1',
  preferencias jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando das de alta un usuario
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

-- Por si ya existían usuarios antes de correr este script
insert into public.perfiles (id, nombre)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- CATÁLOGOS: clínicas físicas y materias (editables desde "Personalizar")
-- ---------------------------------------------------------------------
create table if not exists public.clinicas (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null,                 -- "Clínica 3", "C-12", etc.
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint clinicas_numero_unico unique (numero)
);

create table if not exists public.materias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  color       text not null default '#94a3b8',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint materias_nombre_unico unique (nombre)
);

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

create index if not exists citas_fecha_idx on public.citas (fecha);

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
-- RLS — sólo usuarios con sesión. Nadie anónimo ve nada.
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.clinicas enable row level security;
alter table public.materias enable row level security;
alter table public.citas    enable row level security;

-- Perfiles: todos los logueados los ven (para nombres/colores); cada quien edita el suyo
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated using (true);

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Catálogos: compartidos, cualquiera de los usuarios los administra
drop policy if exists clinicas_all on public.clinicas;
create policy clinicas_all on public.clinicas
  for all to authenticated using (true) with check (true);

drop policy if exists materias_all on public.materias;
create policy materias_all on public.materias
  for all to authenticated using (true) with check (true);

-- Citas: todos ven todas; sólo el dueño crea/edita/borra las suyas
drop policy if exists citas_select on public.citas;
create policy citas_select on public.citas
  for select to authenticated using (true);

drop policy if exists citas_insert on public.citas;
create policy citas_insert on public.citas
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists citas_update on public.citas;
create policy citas_update on public.citas
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists citas_delete on public.citas;
create policy citas_delete on public.citas
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- REALTIME: que uno vea al instante lo que agenda el otro
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.citas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.clinicas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.materias;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------
-- DATOS DE EJEMPLO (bórralos o edítalos desde "Personalizar")
-- ---------------------------------------------------------------------
insert into public.clinicas (numero) values ('Clínica 1'), ('Clínica 2')
on conflict (numero) do nothing;

insert into public.materias (nombre, color) values
  ('Operatoria', '#0ea5e9'),
  ('Periodoncia', '#22c55e'),
  ('Endodoncia', '#f97316')
on conflict (nombre) do nothing;
