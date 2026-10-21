import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SoloNavegador from "@/components/SoloNavegador";
import AgendaPersonal from "@/components/personal/AgendaPersonal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo · Mi agenda", robots: { index: false, follow: false } };

// 2.2 · Demo de Mi agenda con datos de ejemplo (para quien todavía no la tiene). No escribe nada.
export default async function DemoPersonalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className="mi-agenda">
      <SoloNavegador>
        <AgendaPersonal userId={user.id} nombre="" tieneClinica={false} demo />
      </SoloNavegador>
    </div>
  );
}
