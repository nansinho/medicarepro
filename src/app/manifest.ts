import type { MetadataRoute } from "next";

/** Web App Manifest : identité de l'app pour mobiles et installation PWA. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MediCare Pro — Logiciel pour podologues",
    short_name: "MediCare Pro",
    description:
      "Tout votre cabinet de podologie dans une seule application : dossiers patients, facturation, agenda, bilans et comptabilité.",
    start_url: "/",
    display: "browser",
    lang: "fr",
    background_color: "#ffffff",
    theme_color: "#2b6fd6",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
