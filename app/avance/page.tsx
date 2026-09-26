import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Avance from "@/components/Avance";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi avance" };

export default async function AvancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <Avance userId={user.id} />;
}
