import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import MiMaterial from "@/components/MiMaterial";
import SoloNavegador from "@/components/SoloNavegador";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi material" };

export default async function MaterialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SoloNavegador>
      <MiMaterial userId={user.id} />
    </SoloNavegador>
  );
}
