import { DM_Serif_Display } from "next/font/google";

// 2.3 · Mi agenda tiene su propia letra (de libro): sólo se carga aquí, no en la de clínicas.
const serif = DM_Serif_Display({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-papel" });

export default function LayoutPersonal({ children }: { children: React.ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
