import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSuperadmin } from "@/lib/admin";
import Agenda from "@/components/Agenda";
import SinAgenda from "@/components/SinAgenda";
import SoloNavegador from "@/components/SoloNavegador";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle();

  // Cuenta sin agenda: si es el superadmin, a su panel; si no, que cree la suya (o termine su registro)
  if (!perfil?.agenda_id) {
    if (await esSuperadmin(createAdminClient(), user.id)) redirect("/admin");
    return <SinAgenda />;
  }

  return (
    <SoloNavegador>
      <Agenda userId={user.id} />
    </SoloNavegador>
  );
}
