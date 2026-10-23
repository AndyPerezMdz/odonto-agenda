import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";
import SoloNavegador from "@/components/SoloNavegador";
import AjustesPersonal from "@/components/personal/AjustesPersonal";
import { estadoMiDe } from "@/lib/planMiServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ajustes", robots: { index: false, follow: false } };

export default async function AjustesPersonalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/personal");
  const p = await personalDe(createAdminClient(), user.id);
  if (!p || !p.password_at) redirect("/personal");
  return (
    <div className="mi-agenda">
      <SoloNavegador>
        <AjustesPersonal
          userId={user.id}
          email={user.email ?? ""}
          pro={(await estadoMiDe(createAdminClient(), user.id))?.pro ?? true}
          perfil={p.perfil === "odonto" ? "odonto" : "general"}
          tieneClinica={!!(await createAdminClient().from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle()).data?.agenda_id}
        />
      </SoloNavegador>
    </div>
  );
}
