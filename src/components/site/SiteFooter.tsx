import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { Mail, MapPin, Phone, ShieldCheck } from "@/components/icons";
import type { CityListItem } from "@/lib/cms/cities";
import { FOOTER_CREDIT, FOOTER_CTA, FOOTER_SEO } from "@/data/content/site";
import { Icon } from "./icon";
import { fr } from "./Kit";
import f from "./footer.module.css";

type FooterSettings = {
  tagline: string;
  badges: { icon: string | null; label: string }[];
  copyright: string;
};
type ContactSettings = { phone: string; phoneHref: string; email: string; address: string };
type SocialLink = { label: string; icon: string; href: string };
type Col = { title: string; links: { label: string; href: string }[] };

const COLS: Col[] = [
  {
    title: "Le logiciel",
    links: [
      { label: "Toutes les fonctionnalités", href: "/fonctionnalites" },
      { label: "Bilans podologiques", href: "/bilans" },
      { label: "Agenda et rappels", href: "/fonctionnalites#agenda" },
      { label: "Facturation et carte Vitale", href: "/fonctionnalites#facturation" },
      { label: "Comptabilité", href: "/fonctionnalites#comptabilite" },
      { label: "Sécurité et HDS", href: "/securite" },
    ],
  },
  {
    title: "Découvrir",
    links: [
      { label: "Tarifs", href: "/tarifs" },
      { label: "Avantages", href: "/avantages" },
      { label: "Démonstration personnalisée", href: "/contact" },
      { label: "Reprise de vos données", href: "/contact" },
      { label: "Questions fréquentes", href: "/tarifs#faq" },
      { label: "Partout en France", href: "/logiciel-podologue" },
    ],
  },
  {
    title: "MediCare Pro",
    links: [
      { label: "Qui sommes-nous ?", href: "/a-propos" },
      { label: "Blog", href: "/blog" },
      { label: "Nous contacter", href: "/contact" },
      { label: "Plan du site", href: "/plan-du-site" },
      { label: "Charte graphique", href: "/charte-graphique" },
    ],
  },
];

const LEGAL = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "CGU", href: "/cgu" },
  { label: "CGV", href: "/cgv" },
  { label: "DPA", href: "/dpa" },
  { label: "Cookies", href: "/cookies" },
];

function LinkCol({ col }: { col: Col }) {
  return (
    <nav className={f.col} aria-label={col.title}>
      <h2>{col.title}</h2>
      <ul>
        {col.links.map((l) => (
          <li key={l.label}>
            <Link href={l.href}>{fr(l.label)}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function SiteFooter({
  footer,
  contact,
  socials,
  cities,
}: {
  footer: FooterSettings;
  contact: ContactSettings;
  socials: SocialLink[];
  /** Villes publiées : maillage interne vers les pages locales. */
  cities: CityListItem[];
}) {
  return (
    <footer className={f.foot}>
      <div className={f.w}>
        {/* Bandeau d'appel */}
        <div className={f.cta}>
          <div>
            <h2>{fr(FOOTER_CTA.title)}</h2>
            <p>{fr(FOOTER_CTA.text)}</p>
          </div>
          <div className={f.ctaBtns}>
            <Link href={FOOTER_CTA.primary.href} className={`${f.btn} ${f.btnPrimary}`}>
              {FOOTER_CTA.primary.label}
            </Link>
            <Link href={FOOTER_CTA.secondary.href} className={`${f.btn} ${f.btnGhost}`}>
              {FOOTER_CTA.secondary.label}
            </Link>
          </div>
        </div>

        {/* Marque, coordonnées et colonnes de liens */}
        <div className={f.main}>
          <div className={f.brand}>
            <Link href="/" aria-label="MediCare Pro, accueil">
              <BrandLogo size={40} variant="light" />
            </Link>
            <p>{fr(footer.tagline)}</p>
            <div className={f.meta}>
              {footer.badges.length > 0 && (
                <div className={f.badges}>
                  {footer.badges.map((b) => (
                    <span key={b.label}>
                      <ShieldCheck aria-hidden="true" />
                      {b.label}
                    </span>
                  ))}
                </div>
              )}
              {socials.length > 0 && (
                <div className={f.socials}>
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`MediCare Pro sur ${s.label}`}
                    >
                      <Icon name={s.icon} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {COLS.map((col) => (
            <LinkCol key={col.title} col={col} />
          ))}

          <div className={`${f.col} ${f.colContact}`}>
            <h2>Contact</h2>
            <ul className={f.contact}>
              <li>
                <i aria-hidden="true">
                  <Phone />
                </i>
                <a href={contact.phoneHref}>{contact.phone}</a>
              </li>
              <li>
                <i aria-hidden="true">
                  <Mail />
                </i>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              <li>
                <i aria-hidden="true">
                  <MapPin />
                </i>
                <span>
                  {/* Rue, puis code postal et ville sur une ligne insécable
                      (« Bouc-Bel-Air » ne se coupe pas au trait d'union). */}
                  {contact.address.split(/,\s*/).map((part, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {i > 0 ? part.replace(/-/g, "‑") : part}
                    </span>
                  ))}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Référencement : ce que fait le logiciel, en petit */}
        <section className={f.seo} aria-labelledby="footer-seo-title">
          <h2 id="footer-seo-title">{fr(FOOTER_SEO.title)}</h2>
          {FOOTER_SEO.paragraphs.map((p) => (
            <p key={p.slice(0, 32)}>{fr(p)}</p>
          ))}
          {cities.length > 0 && (
            <>
              <h3>Le logiciel dans votre ville</h3>
              <ul className={f.searches}>
                {cities.slice(0, 24).map((city) => (
                  <li key={city.slug}>
                    <Link href={`/logiciel-podologue/${city.slug}`}>Logiciel podologue {city.name}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>{FOOTER_SEO.searchesTitle}</h3>
          <ul className={f.searches}>
            {FOOTER_SEO.searches.map((s) => (
              <li key={s.label}>
                <Link href={s.href}>{fr(s.label)}</Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Barre légale et crédit */}
        <div className={f.bottom}>
          <nav className={f.legal} aria-label="Informations légales">
            <span>{footer.copyright}</span>
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <p className={f.credit} style={{ margin: 0 }}>
            {FOOTER_CREDIT.label}{" "}
            <a href={FOOTER_CREDIT.href} target="_blank" rel="noopener">
              {FOOTER_CREDIT.name}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
