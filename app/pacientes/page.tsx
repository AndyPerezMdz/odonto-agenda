import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BancoPacientes from "@/components/BancoPacientes";
import SoloNavegador from "@/components/SoloNavegador";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Banco de pacientes" };

export default async function BancoPacientesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SoloNavegador>
      <BancoPacientes userId={user.id} />
    </SoloNavegador>
  );
}
