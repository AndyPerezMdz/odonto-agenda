import type { Metadata } from "next";
import SoloNavegador from "@/components/SoloNavegador";
import AgendaPersonal from "@/components/personal/AgendaPersonal";

export const metadata: Metadata = { title: "Demo", robots: { index: false, follow: false } };

// 2.3 · Demo pública de Mi agenda: sin cuenta, con ejemplos de cualquier persona (no de odonto). No guarda nada.
export default function DemoPublica() {
  return (
    <SoloNavegador>
      <AgendaPersonal userId="demo" nombre="" tieneClinica={false} demo publico odonto={false} />
    </SoloNavegador>
  );
}
