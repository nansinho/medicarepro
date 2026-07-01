import type { Metadata } from "next";
import { Figtree, Poppins } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://medicarepro.fr"),
  title: {
    default: "MediCare Pro — Tout votre cabinet dans une seule application",
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
    title: "MediCare Pro — Tout votre cabinet dans une seule application",
    description:
      "Le logiciel complet de gestion pour podologues : dossiers patients, bilans, facturation automatisée, comptabilité et conformité RGPD. Hébergement HDS en France.",
    locale: "fr_FR",
    type: "website",
    siteName: "MediCare Pro",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${figtree.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
