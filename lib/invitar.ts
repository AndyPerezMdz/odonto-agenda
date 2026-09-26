import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

export const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

/**
 * Invita a alguien por correo y lo mete a una agenda con un rol.
 * El correo de invitación lo manda Supabase (con tu SMTP de Resend).
 */
export async function invitarUsuario(
  db: Db,
  { email, agendaId, rol, sitio }: { email: string; agendaId: string; rol: "owner" | "companero"; sitio: string }
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${sitio}/auth/confirm?next=/bienvenida`,
  });
  if (error || !data.user) {
    const msg = error && /already been registered|already exists/i.test(error.message)
      ? "Ese correo ya tiene cuenta en la plataforma."
      : error?.message ?? "No se pudo invitar.";
    return { error: msg };
  }

  // El trigger ya creó su perfil (sin agenda). Aquí se le asigna agenda y rol.
  const { error: e2 } = await db.from("perfiles").update({ agenda_id: agendaId, rol }).eq("id", data.user.id);
  if (e2) {
    await db.auth.admin.deleteUser(data.user.id); // no dejar usuarios huérfanos
    return { error: e2.message };
  }
  return { id: data.user.id };
}
