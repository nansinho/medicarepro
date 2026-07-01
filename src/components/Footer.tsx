import Link from "next/link";
import {
  ShieldPlus,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Facebook,
  LinkedIn,
  XSocial,
  Instagram,
} from "./icons";
import s from "./sections3.module.css";

const PRODUCT_LINKS = [
  { label: "Fonctionnalités", href: "/fonctionnalites" },
  { label: "Bilans", href: "/bilans" },
  { label: "Sécurité", href: "/securite" },
  { label: "Avantages", href: "/avantages" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Contact", href: "/contact" },
];

const OTHER_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/tarifs" },
  { label: "Confidentialité", href: "#" },
  { label: "CGU", href: "#" },
];

/** Lien interne (route) → <Link> ; placeholder ("#") → <a>. */
function FootLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/")) {
    return <Link href={href}>{label}</Link>;
  }
  return <a href={href}>{label}</a>;
}

export default function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.footWave} />
      <div className={s.footMain}>
        <div className="wrap">
          <div className={s.footShield}>
            <div style={{ textAlign: "center" }}>
              <ShieldPlus width={30} height={30} />
              <div className={s.fsName}>MediCare Pro</div>
            </div>
          </div>
          <div className={s.footCols}>
            <div data-rv-footcol>
              <h4>MediCare Pro</h4>
              <p>Logiciel de gestion de cabinet pour podologues.</p>
              <div className={s.footContact}>
                <span>
                  <span className={s.fc}>
                    <MapPin width={16} height={16} />
                  </span>
                  12 rue de la Santé, 75000 Paris
                </span>
                <span>
                  <span className={s.fc}>
                    <Phone width={16} height={16} />
                  </span>
                  01 23 45 67 89
                </span>
                <span>
                  <span className={s.fc}>
                    <Mail width={16} height={16} />
                  </span>
                  contact@medicarepro.fr
                </span>
              </div>
            </div>
            <div data-rv-footcol>
              <h4>Produit</h4>
              <div className={s.footLinks}>
                {PRODUCT_LINKS.map((l) => (
                  <FootLink key={l.label} href={l.href} label={l.label} />
                ))}
              </div>
            </div>
            <div data-rv-footcol>
              <h4>Liens</h4>
              <div className={s.footLinks}>
                {OTHER_LINKS.map((l) => (
                  <FootLink key={l.label} href={l.href} label={l.label} />
                ))}
              </div>
            </div>
            <div className={s.news} data-rv-footcol>
              <h4>Restez informé</h4>
              <p>Conseils et nouveautés, une fois par mois.</p>
              <div className={s.nbox}>
                <input type="email" placeholder="vous@email.com" />
                <button className="btn" type="button">
                  Envoyer <ArrowRight className="ico ar" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={s.footBottom}>
        <div className="wrap">
          <div className={s.wrapInner}>
            <div className={s.socials}>
              Suivez-nous
              <a href="#" aria-label="Facebook">
                <Facebook width={17} height={17} />
              </a>
              <a href="#" aria-label="LinkedIn">
                <LinkedIn width={17} height={17} />
              </a>
              <a href="#" aria-label="X">
                <XSocial width={16} height={16} />
              </a>
              <a href="#" aria-label="Instagram">
                <Instagram width={17} height={17} />
              </a>
            </div>
            <small>© 2026 MediCare Pro. Tous droits réservés.</small>
          </div>
        </div>
      </div>
    </footer>
  );
}
