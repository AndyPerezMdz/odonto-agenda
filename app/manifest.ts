import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" con nombre, ícono y colores propios.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agenda de clínicas",
    short_name: "Agenda",
    description: "Agenda compartida de pacientes",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#2f5d50",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
