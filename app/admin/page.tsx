import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { superadminEnSesion } from "@/lib/admin";
import PanelAdmin from "@/components/PanelAdmin";
import SoloNavegador from "@/components/SoloNavegador";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Panel", robots: { index: false, follow: false } };

// Tu panel. Para cualquier otra persona esta página NO existe (404).
export default async function AdminPage() {
  const s = await superadminEnSesion();
  if (!s) notFound();
  return (
    <SoloNavegador>
      <PanelAdmin email={s.user.email ?? ""} />
    </SoloNavegador>
  );
}
