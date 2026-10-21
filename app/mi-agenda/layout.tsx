import { fuentePapel } from "@/lib/fuentePapel";
import { metaMiAgenda, viewportMiAgenda } from "@/lib/metaMiAgenda";

// 2.3 · Página pública de Mi agenda (para quien no es de odonto): misma letra e identidad que la agenda.
export const metadata = { ...metaMiAgenda, robots: { index: true, follow: true } };
export const viewport = viewportMiAgenda;

export default function LayoutMiAgenda({ children }: { children: React.ReactNode }) {
  return <div className={`mi-agenda ${fuentePapel.variable}`}>{children}</div>;
}
