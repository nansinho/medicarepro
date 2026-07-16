import Link from "next/link";
import BrandLogo from "./BrandLogo";
import {
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Facebook,
  LinkedIn,
  XSocial,
  Instagram,
} from "./icons";
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

/** Lien interne (route) → <Link> ; placeholder ("#") → <a>. */
function FootLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/")) {
    return <Link href={href}>{label}</Link>;
  }
  return <a href={href}>{label}</a>;
}

export default function Footer({
  product,
  resources,
  footer,
  contact,
  socials,
}: {
  product: MenuItem[];
  resources: MenuItem[];
  footer: FooterSettings;
  contact: ContactSettings;
  socials: SocialLink[];
}) {
  return (
    <footer className={s.footer}>
      {/* Halos bleus dérivants (décor) */}
      <div className={`${s.footHalo} ${s.footHaloA}`} aria-hidden="true" />
      <div className={`${s.footHalo} ${s.footHaloB}`} aria-hidden="true" />

      <div className="wrap">
        <div className={s.footTop}>
          {/* Marque + contact */}
          <div className={s.footBrand} data-rv-footcol>
            <Link href="/" className={s.footLogo} aria-label="MediCare Pro — accueil">
              <BrandLogo size={34} variant="light" />
            </Link>
            <p className={s.footTagline}>{footer.tagline}</p>
            <div className={s.footContact}>
              <span>
                <span className={s.fc}>
                  <MapPin width={16} height={16} />
                </span>
                {contact.address}
              </span>
              <a href={contact.phoneHref}>
                <span className={s.fc}>
                  <Phone width={16} height={16} />
                </span>
                {contact.phone}
              </a>
              <a href={`mailto:${contact.email}`}>
                <span className={s.fc}>
                  <Mail width={16} height={16} />
                </span>
                {contact.email}
              </a>
            </div>
          </div>

          <div data-rv-footcol>
            <h4>{footer.productHeading}</h4>
            <div className={s.footLinks}>
              {product.map((l) => (
                <FootLink key={l.label} href={l.href} label={l.label} />
              ))}
            </div>
          </div>

          <div data-rv-footcol>
            <h4>{footer.resourcesHeading}</h4>
            <div className={s.footLinks}>
              {resources.map((l) => (
                <FootLink key={l.label} href={l.href} label={l.label} />
              ))}
            </div>
          </div>

          {/* Newsletter + badges de confiance */}
          <div className={s.news} data-rv-footcol>
            <h4>{footer.newsletter.heading}</h4>
            <p>{footer.newsletter.text}</p>
            {/* TODO(backend) : brancher l'inscription newsletter (Supabase). */}
            <div className={s.nbox}>
              <input
                type="email"
                placeholder={footer.newsletter.placeholder}
                aria-label={footer.newsletter.inputLabel}
              />
              <button className={`btn ${s.nbtn}`} type="button">
                {footer.newsletter.buttonLabel} <ArrowRight className="ico ar" />
              </button>
            </div>
            <div className={s.footBadges}>
              {footer.badges.map((badge) => {
                const Icon = badge.icon
                  ? BADGE_ICONS[badge.icon as keyof typeof BADGE_ICONS]
                  : null;
                return (
                  <span className={s.footBadge} key={badge.label}>
                    {Icon ? (
                      <Icon width={14} height={14} />
                    ) : (
                      <span className={s.footDot} aria-hidden="true" />
                    )}
                    {badge.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={s.footBottom}>
        <div className="wrap">
          <div className={s.wrapInner}>
            <small>{footer.copyright}</small>
            <div className={s.socials}>
              {footer.followLabel}
              {socials.map((social) => {
                const Icon =
                  SOCIAL_ICONS[social.icon as keyof typeof SOCIAL_ICONS];
                const size = social.icon === "XSocial" ? 16 : 17;
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
