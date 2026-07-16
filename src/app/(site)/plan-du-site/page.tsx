import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/Sections";
import { ArrowRight } from "@/components/icons";
import { MENUS } from "@/data/content/site";
import s from "./plan.module.css";

const BASE = "https://medicarepro.fr";

export const metadata: Metadata = {
  title: "Plan du site",
  description:
    "Toutes les pages de MediCare Pro en un coup d'œil : fonctionnalités, bilans podologiques, sécurité, tarifs, blog et informations légales.",
  alternates: { canonical: "/plan-du-site" },
};

/* Groupes construits à partir des menus du site (source de vérité unique).
   Ajouter une page à un menu la fait apparaître ici automatiquement. */
type Item = { href: string; label: string; note?: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Découvrir",
    items: [
      { href: "/", label: "Accueil", note: "La podologie a trouvé son logiciel" },
      { href: "/a-propos", label: "À propos", note: "Né dans un cabinet, pas dans un open space" },
      { href: "/tarifs", label: "Tarifs", note: "Une offre unique, tout inclus" },
      { href: "/contact", label: "Contact", note: "Parler à l'équipe" },
    ],
  },
  {
    title: "Fonctionnalités",
    items: [
      { href: "/fonctionnalites", label: "Toutes les fonctionnalités" },
      { href: "/bilans", label: "Bilans podologiques", note: "13 bilans normés" },
      { href: "/securite", label: "Sécurité & conformité", note: "Hébergement HDS, RGPD" },
      { href: "/avantages", label: "Avantages", note: "Pourquoi choisir MediCare Pro" },
    ],
  },
  {
    title: "Ressources",
    items: [
      { href: "/blog", label: "Blog", note: "Conseils pour votre cabinet" },
      { href: "/logiciel-podologue", label: "Logiciel podologue par ville" },
    ],
  },
  {
    title: "Informations légales",
    items: MENUS.footer_resources
      .filter((l) =>
        ["/confidentialite", "/cgu", "/cgv", "/dpa", "/cookies", "/mentions-legales"].includes(
          l.href,
        ),
      )
      .map((l) => ({ href: l.href, label: l.label })),
  },
];

export default function PlanDuSitePage() {
  return (
    <>
      <PageHero
        kicker="Navigation"
        title="Plan du site"
        lead="Toutes les pages de MediCare Pro, réunies en un seul endroit pour retrouver rapidement ce que vous cherchez."
      />

      <div className="wrap">
        <div className={s.grid}>
          {GROUPS.map((group) => (
            <section className={s.group} key={group.title}>
              <h2 className={s.groupTitle}>{group.title}</h2>
              <ul className={s.list}>
                {group.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className={s.item}>
                      <span className={s.itemMain}>
                        <span className={s.itemLabel}>{it.label}</span>
                        {it.note && <span className={s.itemNote}>{it.note}</span>}
                      </span>
                      <ArrowRight width={16} height={16} className={s.itemArrow} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Renvoi vers le sitemap machine (SEO) */}
        <p className={s.xmlNote}>
          Vous cherchez le plan de site destiné aux moteurs de recherche ?{" "}
          <a href={`${BASE}/sitemap.xml`} target="_blank" rel="noopener noreferrer">
            sitemap.xml
          </a>
        </p>
      </div>
    </>
  );
}
