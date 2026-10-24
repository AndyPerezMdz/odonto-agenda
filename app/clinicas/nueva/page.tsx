import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSuperadmin } from "@/lib/admin";
import { personalDe } from "@/lib/personalServer";
import CrearAgendaClinicas from "@/components/CrearAgendaClinicas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Abre tu agenda de clínicas", robots: { index: false, follow: false } };

// 3.1 · Para quien ya tiene cuenta (p. ej. sólo Mi agenda) y quiere su agenda de clínicas.
// Misma cuenta: elige universidad y confirma que es estudiante con su correo institucional.
export default async function NuevaAgendaClinicas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/clinicas/nueva");
  const db = createAdminClient();
  if (await esSuperadmin(db, user.id)) redirect("/admin");
  const { data: perfil } = await db.from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle();
  if (perfil?.agenda_id) redirect("/");
  const tieneMi = !!(await personalDe(db, user.id));
  return (
    <CrearAgendaClinicas
      desdeMi={tieneMi}
      subtitulo={tieneMi ? "Con tu misma cuenta: cambias entre Mi agenda y la de clínicas desde el menú. Citas, pacientes y tu compañero/a." : undefined}
    />
  );
}
