# Agenda de clínicas

Agenda compartida (Next.js 16 + Supabase) para agendar pacientes: nombre, fecha, hora, clínica física y materia.
Sólo entran los usuarios que tú des de alta.

## 1. Supabase

1. Crea un proyecto en https://supabase.com
2. **SQL Editor → New query** → pega todo `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: deja Email activado y **apaga "Allow new users to sign up"** (así nadie más se puede registrar).
4. **Authentication → Users → Add user → Create new user**: crea a los dos usuarios con correo y contraseña (marca *Auto Confirm User*).
   El perfil se crea solo; el nombre y color lo cambian ellos en *Personalizar*.

## 2. Local

```powershell
npm install
# Crea un archivo .env.local con esto (Project Settings → API):
#   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
npm run dev
```

## 3. Deploy (Vercel)

Importa el repo en Vercel y agrega las dos variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (también acepta `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Cómo funciona

- **Todos ven todo**; cada cita tiene dueño y sólo el dueño la edita o borra (RLS).
- La base **no deja que una misma persona tenga dos citas encimadas**. Dos personas distintas sí pueden coincidir en hora y clínica.
- Días sin citas se marcan como **Libre**; el filtro de persona sirve para ver los días libres de cada quien.
- Cambios en **tiempo real**: si uno agenda, al otro le aparece sin recargar.
- **Personalizar**: nombre y color propios, duración por defecto, hora sugerida, semana en lunes/domingo, ocultar fines de semana, y catálogos de clínicas y materias (agregar, renombrar, ocultar, borrar, color de materia).
  Las preferencias viven en `perfiles.preferencias` (jsonb), así que agregar opciones nuevas no requiere migraciones.

## Estructura

```
proxy.ts                 # protege todas las rutas (antes "middleware")
supabase/schema.sql      # tablas, RLS, trigger de perfiles, realtime
app/login                # inicio de sesión
app/page.tsx             # agenda
app/personalizar         # botón "Personalizar"
components/              # Agenda, CitaModal, Personalizar
lib/                     # clientes Supabase, tipos, fechas, hooks de datos
```

## Recuperar contraseña (configuración única en Supabase)

1. **Authentication → URL Configuration**
   - *Site URL*: el dominio de producción, p. ej. `https://odonto-agenda.vercel.app`
   - *Redirect URLs*: agrega `https://odonto-agenda.vercel.app/**` (y `http://localhost:3000/**` para pruebas locales)
2. **Authentication → Emails → Templates → Reset password**: pega el contenido de `supabase/email-restablecer.html`.
   El link del correo apunta a `/auth/confirm`, que funciona aunque abran el correo en otro dispositivo.
3. **Authentication → Emails → SMTP Settings**: configura un SMTP propio (p. ej. Resend).
   El correo por defecto de Supabase sólo envía a los miembros del equipo del proyecto y con un límite muy bajo por hora.

Rutas: `/recuperar` (pedir enlace), `/auth/confirm` (valida el enlace), `/nueva-contrasena` (elegir contraseña; también accesible desde *Personalizar → Cambiar contraseña*).

## Recordatorios por correo

Cada madrugada (cron de Vercel `0 10 * * *` UTC = entre 4 y 5 a. m. en Mérida) se manda **un correo por persona** con sus citas de hoy, mañana y en 2 días (según lo que cada quien elija en *Personalizar*). Si no hay citas, no se manda nada.

1. La bitácora anti-duplicados ya viene en `supabase/schema.sql`.
2. Variables en Vercel (Settings → Environment Variables), **sin** `NEXT_PUBLIC_`:
   - `SUPABASE_SECRET_KEY` → Supabase → Project Settings → API Keys → *Secret key* (`sb_secret_...`). Sólo la usa el servidor.
   - `RESEND_API_KEY` → la API key de Resend (`re_...`).
   - `CRON_SECRET` → cualquier texto largo y aleatorio. Vercel lo manda solo al llamar al cron.
   - Opcional: `NEXT_PUBLIC_SITE_URL` (link del botón "Abrir la agenda"), `RECORDATORIOS_REMITENTE`, `RECORDATORIOS_ZONA`.
3. Redeploy. En Vercel → Settings → Cron Jobs debe aparecer `/api/recordatorios`.

Pruebas: *Personalizar → Enviarme una prueba* manda el correo sólo a quien lo pide.
En Vercel → Cron Jobs → **Run** lo ejecuta de verdad (no repite si ya se mandó ese día).

## Varias agendas (para vender la app) y panel de admin

- Cada cliente tiene **su propia agenda**: citas, clínicas, materias y compañero aislados por RLS (`agenda_id` + `mi_agenda()`).
- `supabase/schema.sql` es el ÚNICO script: instala desde cero o migra una base vieja (lo que hubiera se vuelve la primera agenda). Se puede correr varias veces.
- Tu cuenta (`aperezmdz21@gmail.com`) queda en la tabla `superadmins`. Si creas tu usuario después de correr el script, agrégalo con:
  `insert into public.superadmins (user_id) select id from auth.users where email = 'aperezmdz21@gmail.com' on conflict do nothing;`
- **/admin**: sólo los superadmins lo ven (a cualquier otro le da 404). Ahí creas agendas nuevas e invitas al dueño, asignas/reasignas dueño, reenvías invitaciones, editas notas internas y eliminas agendas.
- Plantilla de invitación: `supabase/email-invitacion.html` → Authentication → Emails → Templates → *Invite user*.
