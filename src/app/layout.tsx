import type { Metadata, Viewport } from "next";
import { Figtree, Poppins } from "next/font/google";
import { JSONLD_ORG, JSONLD_SOFTWARE } from "@/data/content/site";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-head",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/* viewport-fit=cover : nécessaire pour que env(safe-area-inset-*) se résolve
   sur les iPhone à encoche (pastille « Je m'abonne » + footer mobile). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://medicarepro.fr"),
  title: {
    default: "MediCare Pro — Le logiciel tout-en-un des pédicures-podologues",
    template: "%s — MediCare Pro",
  },
  description:
    "MediCare Pro : logiciel complet de gestion de cabinet pour podologues. Dossiers patients, consultations, facturation automatisée, signature électronique, comptabilité et conformité RGPD. Hébergement HDS en France.",
  keywords: [
    "logiciel podologue",
    "gestion cabinet podologie",
    "logiciel médical",
    "facturation podologue",
    "HDS",
    "RGPD",
  ],
  authors: [{ name: "MediCare Pro" }],
  openGraph: {
    title: "MediCare Pro — Le logiciel tout-en-un des pédicures-podologues",
    description:
      "Le logiciel complet de gestion pour podologues : dossiers patients, bilans, facturation automatisée, comptabilité et conformité RGPD. Hébergement HDS en France.",
    locale: "fr_FR",
    type: "website",
    siteName: "MediCare Pro",
  },
  robots: { index: true, follow: true },
};

/* Données structurées schema.org : aident Google à comprendre que MediCare Pro
   est un logiciel SaaS destiné aux podologues (rich results, panneau de marque).
   Payloads centralisés dans le contenu du site (JSON-LD piloté par la DB plus tard). */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [JSONLD_ORG, JSONLD_SOFTWARE],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${figtree.variable} ${poppins.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
