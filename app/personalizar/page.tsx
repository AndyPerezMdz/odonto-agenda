import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Personalizar from "@/components/Personalizar";

export const dynamic = "force-dynamic";

export default async function PersonalizarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <Personalizar userId={user.id} />;
}
