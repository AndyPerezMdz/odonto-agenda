import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSuperadmin } from "@/lib/admin";
import Agenda from "@/components/Agenda";
import AuthCard from "@/components/AuthCard";
import SoloNavegador from "@/components/SoloNavegador";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle();

  // Cuenta sin agenda: si es el superadmin, a su panel; si no, avisar
  if (!perfil?.agenda_id) {
    if (await esSuperadmin(createAdminClient(), user.id)) redirect("/admin");
    return (
      <AuthCard titulo="Tu cuenta no tiene agenda" subtitulo="Tu acceso fue retirado o tu invitación ya no es válida. Pídele al dueño de la agenda que te invite de nuevo.">
        <form action="/auth/salir" method="post">
          <button className="btn btn-sec w-full">Cerrar sesión</button>
        </form>
      </AuthCard>
    );
  }

  return (
    <SoloNavegador>
      <Agenda userId={user.id} />
    </SoloNavegador>
  );
}
