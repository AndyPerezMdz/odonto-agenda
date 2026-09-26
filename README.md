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
