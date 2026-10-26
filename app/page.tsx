import { redirect } from "next/navigation";
import { pendienteEscolar } from "@/lib/verificacionServer";
import { BloqueoVerificar } from "@/components/AvisoVerificar";
import { cookies } from "next/headers";
import { createClient, usuarioConReintento } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSuperadmin } from "@/lib/admin";
import { personalDe } from "@/lib/personalServer";
import Agenda from "@/components/Agenda";
import SinAgenda from "@/components/SinAgenda";
import SoloNavegador from "@/components/SoloNavegador";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await usuarioConReintento(supabase);
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle();

  // Cuenta sin agenda: si es el superadmin, a su panel; si no, que cree la suya (o termine su registro)
  if (!perfil?.agenda_id) {
    const db = createAdminClient();
    if (await esSuperadmin(db, user.id)) redirect("/admin");
    // Sólo tiene agenda personal: para allá
    if (await personalDe(db, user.id)) redirect("/personal");
    return <SinAgenda />;
  }

  // Tiene las dos agendas: entra a la última que usó (la cookie la pone cada agenda al abrirse)
  if ((await cookies()).get("ultima_agenda")?.value === "personal" && (await personalDe(createAdminClient(), user.id))) redirect("/personal");

  // 3.1 · Se le venció el plazo para confirmar que es estudiante: primero eso (no se borra nada)
  const pend = await pendienteEscolar(createAdminClient(), user);
  if (pend.necesita && pend.vencido) return <BloqueoVerificar uni={pend.universidad} plazo={pend.plazo} correoSugerido={pend.correoSugerido} />;

  return (
    <SoloNavegador>
      <Agenda userId={user.id} />
    </SoloNavegador>
  );
}
