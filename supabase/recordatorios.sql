-- =====================================================================
--  RECORDATORIOS POR CORREO
--  Pégalo en: Supabase → SQL Editor → New query → Run  (es idempotente)
-- =====================================================================

-- Bitácora: evita mandar dos veces el recordatorio del mismo día a la misma persona
-- (por si el cron de Vercel se dispara dos veces).
create table if not exists public.recordatorios_enviados (
  owner_id   uuid not null references public.perfiles (id) on delete cascade,
  fecha      date not null,               -- día (hora de Mérida) en que se envió
  enviado_at timestamptz not null default now(),
  primary key (owner_id, fecha)
);

-- RLS encendido y SIN políticas: sólo el servidor (con la secret key) puede leer/escribir.
alter table public.recordatorios_enviados enable row level security;
