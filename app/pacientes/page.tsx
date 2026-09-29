import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PaginaPacientes from "@/components/PaginaPacientes";
import SoloNavegador from "@/components/SoloNavegador";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pacientes" };

export default async function BancoPacientesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SoloNavegador>
      <PaginaPacientes userId={user.id} />
    </SoloNavegador>
  );
}
