import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" con nombre, ícono y colores propios.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La agendita",
    short_name: "La agendita",
    description: "Tu agenda de clínicas y tu agenda personal",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#2b2520",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
