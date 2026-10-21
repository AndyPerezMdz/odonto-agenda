import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";
import AuthCard from "@/components/AuthCard";
import SoloNavegador from "@/components/SoloNavegador";
import CrearPassword from "@/components/personal/CrearPassword";
import AgendaPersonal from "@/components/personal/AgendaPersonal";
import BotonActivar from "@/components/personal/BotonActivar";
import { estadoMiDe } from "@/lib/planMiServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Mi agenda" }, robots: { index: false, follow: false } };

// Agenda personal (2.1). Sin sesión: entrar. Sin alta: aviso. Primera vez: crear contraseña.
export default async function PersonalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?a=mi");

  const db = createAdminClient();
  const p = await personalDe(db, user.id);
  const { data: perfil } = await db.from("perfiles").select("agenda_id,nombre").eq("id", user.id).maybeSingle();
  if (!p) {
    return (
      <div className="mi-agenda">
        <AuthCard
          logo="/mi-agenda-icon.svg"
          serif
          titulo="Todavía no tienes Mi agenda"
          subtitulo={`Entraste como ${user.email}. ${perfil?.agenda_id ? "Si tu agenda de clínicas es Pro, tu Mi agenda también, sin pagar extra." : "Actívala y empieza con días de Pro de prueba."}`}
        >
          <div className="flex flex-col gap-2">
            <BotonActivar />
            {perfil?.agenda_id && <Link href="/" className="btn btn-sec w-full">Ir a mi agenda de clínicas</Link>}
            <form action="/auth/salir" method="post"><input type="hidden" name="a" value="mi" /><button className="btn btn-sec w-full">Salir y entrar con otro correo</button></form>
          </div>
        </AuthCard>
      </div>
    );
  }
  const nombre = (p.nombre ?? perfil?.nombre ?? "").split(" ")[0];
  if (!p.password_at) return <CrearPassword nombre={nombre} email={user.email ?? ""} />;

  await db.from("personales").update({ ultimo_acceso: new Date().toISOString() }).eq("user_id", user.id);
  const estado = await estadoMiDe(db, user.id);
  return (
    <div className="mi-agenda">
      <SoloNavegador>
        <AgendaPersonal userId={user.id} nombre={nombre} tieneClinica={!!perfil?.agenda_id} odonto={p.perfil !== "general"} estado={estado} />
      </SoloNavegador>
    </div>
  );
}
