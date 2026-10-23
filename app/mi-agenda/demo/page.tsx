import type { Metadata } from "next";
import SoloNavegador from "@/components/SoloNavegador";
import AgendaPersonal from "@/components/personal/AgendaPersonal";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo", robots: { index: false, follow: false } };

// La demo de Mi agenda (una sola, 2.8): sin cuenta, con ejemplos de cualquier persona y "La quiero" → registro.
// Con sesión (p. ej. desde la agenda de clínicas): ejemplos de odonto si usa clínicas, y "La quiero" la activa ahí mismo.
export default async function Demo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user ? await supabase.from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle() : { data: null };
  const odonto = !!perfil?.agenda_id;
  return (
    <SoloNavegador>
      <AgendaPersonal userId={user?.id ?? "demo"} nombre="" tieneClinica={false} demo publico={!user} odonto={odonto} />
    </SoloNavegador>
  );
}
