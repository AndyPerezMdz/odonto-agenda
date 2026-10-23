-- =====================================================================
-- 2.4 · Avisos a la hora de los recordatorios de Mi agenda (cada 5 minutos)
-- Vercel Hobby sólo deja crons diarios, así que el "despertador" lo pone Supabase.
--
-- 1) En Supabase: Database → Extensions → enciende pg_cron y pg_net.
-- 2) Cambia abajo TU-SITIO y TU-CRON-SECRET (el mismo CRON_SECRET que está en Vercel).
--    ¡No subas este archivo con el secreto escrito! Pégalo directo en el SQL Editor.
-- 3) Corre todo en el SQL Editor. Para revisarlo: select * from cron.job;
--    Para quitarlo: select cron.unschedule('mi-agenda-recordatorios');
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('mi-agenda-recordatorios')
where exists (select 1 from cron.job where jobname = 'mi-agenda-recordatorios');

select cron.schedule(
  'mi-agenda-recordatorios',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://TU-SITIO.vercel.app/api/push/recordatorios',
    headers := jsonb_build_object('Authorization', 'Bearer TU-CRON-SECRET'),
    timeout_milliseconds := 20000
  );
  $$
);

-- Limpieza: los avisos mandados de hace más de 30 días ya no sirven (corre diario a las 3:17 a. m. UTC)
select cron.unschedule('mi-agenda-limpia-avisos')
where exists (select 1 from cron.job where jobname = 'mi-agenda-limpia-avisos');
select cron.schedule('mi-agenda-limpia-avisos', '17 3 * * *', $$ delete from public.p_push_enviados where dia < current_date - 30 $$);
