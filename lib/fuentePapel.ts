import { DM_Serif_Display } from "next/font/google";

// 2.3 · La letra de libro de Mi agenda (sólo la cargan sus páginas, no la de clínicas).
export const fuentePapel = DM_Serif_Display({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-papel" });
