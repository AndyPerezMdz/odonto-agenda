import type { Metadata, Viewport } from "next";

// 2.3 · Mi agenda tiene su propia identidad: nombre, ícono y colores al instalarla (nada de muelas).
export const metaMiAgenda: Metadata = {
  title: { default: "Mi agenda", template: "%s · Mi agenda" },
  description: "Tu agenda personal: eventos, viajes, entregas y recordatorios. Sólo tú la ves.",
  manifest: "/mi-agenda.webmanifest",
  icons: { icon: "/mi-agenda-icon.svg", apple: "/mi-agenda-apple.png" },
  appleWebApp: { capable: true, title: "Mi agenda", statusBarStyle: "default" },
};

export const viewportMiAgenda: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ede2" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1915" },
  ],
};
