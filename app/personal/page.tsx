import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";
import AuthCard from "@/components/AuthCard";
import SoloNavegador from "@/components/SoloNavegador";
import EntrarPersonal from "@/components/personal/EntrarPersonal";
import CrearPassword from "@/components/personal/CrearPassword";
import AgendaPersonal from "@/components/personal/AgendaPersonal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi agenda", robots: { index: false, follow: false } };

// Agenda personal (2.1). Sin sesión: entrar. Sin alta: aviso. Primera vez: crear contraseña.
export default async function PersonalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <EntrarPersonal />;

  const db = createAdminClient();
  const p = await personalDe(db, user.id);
  const { data: perfil } = await db.from("perfiles").select("agenda_id,nombre").eq("id", user.id).maybeSingle();
  if (!p) {
    return (
      <div className="mi-agenda">
        <AuthCard titulo="Esta cuenta no tiene agenda propia" subtitulo={`Entraste como ${user.email}. Si te dieron una, entra con el correo que te dieron de alta.`}>
          <div className="flex flex-col gap-2">
            {perfil?.agenda_id && <Link href="/" className="btn btn-primario w-full">Ir a mi agenda de clínicas</Link>}
            <form action="/auth/salir" method="post"><button className="btn btn-sec w-full">Salir y entrar con otro correo</button></form>
          </div>
        </AuthCard>
      </div>
    );
  }
  const nombre = (p.nombre ?? perfil?.nombre ?? "").split(" ")[0];
  if (!p.password_at) return <CrearPassword nombre={nombre} email={user.email ?? ""} />;

  await db.from("personales").update({ ultimo_acceso: new Date().toISOString() }).eq("user_id", user.id);
  return (
    <div className="mi-agenda">
      <SoloNavegador>
        <AgendaPersonal userId={user.id} nombre={nombre} tieneClinica={!!perfil?.agenda_id} />
      </SoloNavegador>
    </div>
  );
}
