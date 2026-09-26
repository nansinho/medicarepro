import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { Mail, MapPin, Phone, ShieldCheck } from "@/components/icons";
import type { CityListItem } from "@/lib/cms/cities";
import { Icon } from "./icon";
import c from "./chrome.module.css";

type FooterSettings = {
  tagline: string;
  badges: { icon: string | null; label: string }[];
  copyright: string;
};
type ContactSettings = { phone: string; phoneHref: string; email: string; address: string };
type SocialLink = { label: string; icon: string; href: string };

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "MediCare Pro",
    links: [
      { label: "Qui sommes-nous ?", href: "/a-propos" },
      { label: "Nous contacter", href: "/contact" },
      { label: "Blog", href: "/blog" },
      { label: "Plan du site", href: "/plan-du-site" },
      { label: "Charte graphique", href: "/charte-graphique" },
    ],
  },
  {
    title: "Le logiciel",
    links: [
      { label: "Fonctionnalités", href: "/fonctionnalites" },
      { label: "Bilans podologiques", href: "/bilans" },
      { label: "Avantages", href: "/avantages" },
      { label: "Tarifs", href: "/tarifs" },
      { label: "Sécurité et HDS", href: "/securite" },
    ],
  },
  {
    title: "Nos services",
    links: [
      { label: "Démonstration personnalisée", href: "/contact" },
      { label: "Reprise de vos données", href: "/contact" },
      { label: "Questions fréquentes", href: "/tarifs#faq" },
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
    <footer className={c.foot}>
      <div className={c.w}>
        <div className={c.ftop}>
          <div className={c.fbrand}>
            <Link href="/" aria-label="MediCare Pro, accueil">
              <BrandLogo size={42} variant="light" />
            </Link>
            <p>{footer.tagline}</p>
            <div className={c.fcontact}>
              <a href={contact.phoneHref}>
                <Phone aria-hidden="true" />
                {contact.phone}
              </a>
              <a href={`mailto:${contact.email}`}>
                <Mail aria-hidden="true" />
                {contact.email}
              </a>
              <span>
                <MapPin aria-hidden="true" />
                {contact.address}
              </span>
            </div>
            {footer.badges.length > 0 && (
              <div className={c.fbadges}>
                {footer.badges.map((b) => (
                  <span key={b.label}>
                    <ShieldCheck aria-hidden="true" />
                    {b.label}
                  </span>
                ))}
              </div>
            )}
            {socials.length > 0 && (
              <div className={c.socials}>
                {socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                    <Icon name={s.icon} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h2>{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2>Partout en France</h2>
            <ul>
              {cities.slice(0, 6).map((city) => (
                <li key={city.slug}>
                  <Link href={`/logiciel-podologue/${city.slug}`}>{city.name}</Link>
                </li>
              ))}
              <li>
                <Link href="/logiciel-podologue">
                  {cities.length > 0 ? "Toutes les villes" : "Le logiciel près de chez vous"}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={c.fbottom}>
          <span>{footer.copyright}</span>
          <nav className={c.legal} aria-label="Informations légales">
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
