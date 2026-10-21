import { fuentePapel } from "@/lib/fuentePapel";
import { metaMiAgenda, viewportMiAgenda } from "@/lib/metaMiAgenda";

// 2.3 · Mi agenda: su propia letra (de libro), su ícono y su nombre al instalarla.
export const metadata = metaMiAgenda;
export const viewport = viewportMiAgenda;

export default function LayoutPersonal({ children }: { children: React.ReactNode }) {
  return <div className={fuentePapel.variable}>{children}</div>;
}
