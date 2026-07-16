import Link from "next/link";
import BrandLogo from "./BrandLogo";
import {
  ShieldCheck,
  ArrowRight,
  Play,
  Facebook,
  LinkedIn,
  XSocial,
  Instagram,
} from "./icons";
import { resolveHref } from "@/lib/appLinks";
import type { MenuItem } from "@/data/content/site";
import s from "./sections3.module.css";

/* Icônes des réseaux sociaux et badges (clés string des réglages CMS).
   Le X est légèrement plus petit (équilibre optique). */
const SOCIAL_ICONS = { Facebook, LinkedIn, XSocial, Instagram } as const;
const BADGE_ICONS = { ShieldCheck } as const;

/** Réglages consommés par le footer (sous-ensemble de site_settings). */
type FooterSettings = {
  tagline: string;
  productHeading: string;
  resourcesHeading: string;
  newsletter: {
    heading: string;
    text: string;
    placeholder: string;
    inputLabel: string;
    buttonLabel: string;
  };
  badges: { icon: string | null; label: string }[];
  copyright: string;
  followLabel: string;
};
type ContactSettings = {
  phone: string;
  phoneHref: string;
  email: string;
  address: string;
};
type SocialLink = { label: string; icon: string; href: string };

/** Lien interne (route) → <Link> ; externe/placeholder → <a>. */
function FootLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/")) {
    return <Link href={href}>{label}</Link>;
  }
  return <a href={href}>{label}</a>;
}

/** Une colonne de liens du footer, avec sous-titre descriptif optionnel. */
function FootCol({
  heading,
  intro,
  links,
}: {
  heading: string;
  intro?: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div data-rv-footcol>
      <h4>{heading}</h4>
      {intro && <p className={s.footColIntro}>{intro}</p>}
      <div className={s.footLinks}>
        {links.map((l) => (
          <FootLink key={l.label} href={l.href} label={l.label} />
        ))}
      </div>
    </div>
  );
}

/* Sous-ensembles fixes des menus (répartition en colonnes équilibrées).
   Les libellés restent alignés sur les routes réelles du site. */
const PRODUCT_LINKS = [
  { label: "Fonctionnalités", href: "/fonctionnalites" },
  { label: "Bilans podologiques", href: "/bilans" },
  { label: "Sécurité & conformité", href: "/securite" },
  { label: "Avantages", href: "/avantages" },
  { label: "Tarifs", href: "/tarifs" },
];
const COMPANY_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Logiciel podologue par ville", href: "/logiciel-podologue" },
];
const RESOURCES_LINKS = [
  { label: "FAQ", href: "/tarifs" },
  { label: "Plan du site", href: "/plan-du-site" },
];
const LEGAL_LINKS = [
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "CGU", href: "/cgu" },
  { label: "CGV", href: "/cgv" },
  { label: "DPA", href: "/dpa" },
  { label: "Cookies", href: "/cookies" },
  { label: "Mentions légales", href: "/mentions-legales" },
];

export default function Footer({
  footer,
  contact,
  socials,
}: {
  /* product / resources restent acceptés pour compat mais le footer compose
     désormais ses colonnes à partir des sous-ensembles ci-dessus. */
  product?: MenuItem[];
  resources?: MenuItem[];
  footer: FooterSettings;
  contact: ContactSettings;
  socials: SocialLink[];
}) {
  return (
    <footer className={s.footer}>
      {/* Halos bleus dérivants (décor) */}
      <div className={`${s.footHalo} ${s.footHaloA}`} aria-hidden="true" />
      <div className={`${s.footHalo} ${s.footHaloB}`} aria-hidden="true" />

      {/* ---- Barre haute fine : accroche + CTA + newsletter en ligne ---- */}
      <div className="wrap">
        <div className={s.footLead}>
          <div className={s.footLeadCopy}>
            <h2 className={s.footLeadTitle}>
              Tout votre cabinet de podologie, dans une seule application.
            </h2>
            <p className={s.footLeadText}>
              Dès 24,84&nbsp;€/mois, tout inclus. Hébergé en France (HDS).
            </p>
          </div>
          <div className={s.footLeadActions}>
            <a
              href={resolveHref("app:register")}
              target="_blank"
              rel="noopener noreferrer"
              className={s.footLeadPrimary}
            >
              Je m&apos;abonne
              <ArrowRight width={15} height={15} className={s.footLeadArrow} />
            </a>
            <Link href="/contact" className={s.footLeadSecondary}>
              <Play width={13} height={13} />
              Voir la démo
            </Link>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className={s.footTop}>
          {/* Marque + tagline + réassurance */}
          <div className={s.footBrand} data-rv-footcol>
            <Link href="/" className={s.footLogo} aria-label="MediCare Pro — accueil">
              <BrandLogo size={30} variant="light" />
            </Link>
            <p className={s.footTagline}>{footer.tagline}</p>
            <div className={s.footContact}>
              <span>{contact.address}</span>
              <a href={contact.phoneHref}>{contact.phone}</a>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </div>
            <div className={s.footBadges}>
              {footer.badges.map((badge) => {
                const Icon = badge.icon
                  ? BADGE_ICONS[badge.icon as keyof typeof BADGE_ICONS]
                  : null;
                return (
                  <span className={s.footBadge} key={badge.label}>
                    {Icon ? (
                      <Icon width={13} height={13} />
                    ) : (
                      <span className={s.footDot} aria-hidden="true" />
                    )}
                    {badge.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Colonnes de liens */}
          <FootCol heading="Produit" intro="Tout le cabinet, réuni." links={PRODUCT_LINKS} />
          <FootCol heading="Entreprise" intro="Qui sommes-nous." links={COMPANY_LINKS} />
          <FootCol heading="Ressources" intro="Aide & documentation." links={RESOURCES_LINKS} />
          <FootCol heading="Légal" intro="Conformité & données." links={LEGAL_LINKS} />

          {/* Newsletter compacte */}
          <div className={s.footNews} data-rv-footcol>
            <h4>{footer.newsletter.heading}</h4>
            <p className={s.footColIntro}>{footer.newsletter.text}</p>
            {/* TODO(backend) : brancher l'inscription newsletter (Supabase). */}
            <div className={s.nbox}>
              <input
                type="email"
                placeholder={footer.newsletter.placeholder}
                aria-label={footer.newsletter.inputLabel}
              />
              <button className={s.nbtn} type="button" aria-label={footer.newsletter.buttonLabel}>
                <ArrowRight width={16} height={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={s.footBottom}>
        <div className="wrap">
          <div className={s.wrapInner}>
            <small>{footer.copyright}</small>
            <div className={s.footBottomLinks}>
              <Link href="/mentions-legales">Mentions légales</Link>
              <Link href="/confidentialite">Confidentialité</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/plan-du-site">Plan du site</Link>
            </div>
            <div className={s.footSocialRow}>
              {socials.map((social) => {
                const Icon = SOCIAL_ICONS[social.icon as keyof typeof SOCIAL_ICONS];
                const size = social.icon === "XSocial" ? 14 : 15;
                const external = social.href.startsWith("http");
                return (
                  <a
                    href={social.href}
                    aria-label={social.label}
                    key={social.label}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    <Icon width={size} height={size} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
