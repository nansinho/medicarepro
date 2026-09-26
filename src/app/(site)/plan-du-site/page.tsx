import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { Crumb, CrumbJsonLd, Section, Sub, Title } from "@/components/site/Kit";
import { getPublishedCities } from "@/lib/cms/cities";
import p from "@/components/site/prose.module.css";

const BASE = "https://medicarepro.fr";

export const metadata: Metadata = {
  title: "Plan du site",
  description:
    "Toutes les pages de MediCare Pro en un coup d'œil : fonctionnalités, bilans podologiques, sécurité, tarifs, blog et informations légales.",
  alternates: { canonical: "/plan-du-site" },
};

type Item = { href: string; label: string; note?: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Découvrir",
    items: [
      { href: "/", label: "Accueil", note: "Le logiciel des podologues" },
      { href: "/a-propos", label: "Qui sommes-nous ?", note: "Né dans un cabinet" },
      { href: "/tarifs", label: "Tarifs", note: "Une offre unique, tout inclus" },
      { href: "/contact", label: "Contact", note: "Parler à l'équipe" },
    ],
  },
  {
    title: "Le logiciel",
    items: [
      { href: "/fonctionnalites", label: "Toutes les fonctionnalités" },
      { href: "/bilans", label: "Bilans podologiques", note: "13 bilans normés" },
      { href: "/securite", label: "Sécurité et HDS", note: "Hébergement en France, RGPD" },
      { href: "/avantages", label: "Avantages", note: "Pourquoi choisir MediCare Pro" },
    ],
  },
  {
    title: "Ressources",
    items: [
      { href: "/blog", label: "Blog", note: "Conseils pour votre cabinet" },
      { href: "/tarifs#faq", label: "Questions fréquentes" },
      { href: "/logiciel-podologue", label: "Partout en France", note: "Les pages de votre région" },
      { href: "/charte-graphique", label: "Charte graphique", note: "Logo et kit à télécharger" },
    ],
  },
  {
    title: "Informations légales",
    items: [
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cgu", label: "CGU" },
      { href: "/cgv", label: "CGV" },
      { href: "/dpa", label: "DPA" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

export default async function PlanDuSitePage() {
  const cities = await getPublishedCities();
  const groups: Group[] =
    cities.length > 0
      ? [
          ...GROUPS,
          {
            title: "Villes",
            items: cities.map((c) => ({ href: `/logiciel-podologue/${c.slug}`, label: c.name, note: c.region })),
          },
        ]
      : GROUPS;
  const crumbs = [
    { label: "Accueil", href: "/" },
    { label: "Plan du site", href: "/plan-du-site" },
  ];

  return (
    <>
      <Section hero center>
        <Crumb items={crumbs} />
        <CrumbJsonLd items={crumbs} />
        <Title as="h1">Plan du site</Title>
        <Sub>Toutes les pages de MediCare Pro, réunies au même endroit.</Sub>
      </Section>

      <Section tint="blue" edge={1}>
        <div className={p.plan}>
          {groups.map((group) => (
            <section className={p.planGroup} key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href}>
                      <span>
                        {it.label}
                        {it.note && <small>{it.note}</small>}
                      </span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p style={{ marginTop: 32, textAlign: "center" }}>
          Plan destiné aux moteurs de recherche :{" "}
          <a href={`${BASE}/sitemap.xml`} style={{ color: "var(--brand-blue)" }}>
            sitemap.xml
          </a>
        </p>
      </Section>
    </>
  );
}
