import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Agenda from "@/components/Agenda";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <Agenda userId={user.id} />;
}
