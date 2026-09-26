"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import SearchOverlay, { prefetchSearchIndex } from "@/components/SearchOverlay";
import { ArrowRight, Burger, Caret, Close, Phone, Search, User } from "@/components/icons";
import { loginUrl } from "@/lib/appLinks";
import type { MenuItem } from "@/data/content/site";
import { Icon } from "./icon";
import { navIntro, navMeta } from "./navMeta";
import c from "./chrome.module.css";

type HeaderSettings = { logoLabel: string; loginLabel: string };
type ContactSettings = { phone: string; phoneHref: string };

const cx = (...v: (string | false | undefined)[]) => v.filter(Boolean).join(" ");

/** Pastille colorée d'une entrée de sous-menu. */
function MenuIcon({ href }: { href: string }) {
  const m = navMeta(href);
  return (
    <i className={c.mi} style={{ "--c": m.c, "--t": m.t } as CSSProperties}>
      <Icon name={m.icon} />
    </i>
  );
}

export default function SiteHeader({
  nav,
  header,
  contact,
}: {
  nav: MenuItem[];
  header: HeaderSettings;
  contact: ContactSettings;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openDesk, setOpenDesk] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const navRef = useRef<HTMLUListElement>(null);

  const isActive = (href: string) => {
    const path = href.split("#")[0];
    return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
  };
  /* Un groupe est actif si l'une de ses pages l'est ; les ancres (/tarifs#faq)
     ne comptent pas, sinon deux groupes s'allument pour la même page. */
  const groupActive = (item: MenuItem) =>
    item.children?.some((ch) => !ch.href.includes("#") && isActive(ch.href)) ?? isActive(item.href);

  /* Ombre de l'en-tête dès qu'on quitte le haut de page. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Changement de page : tout se referme (ajustement pendant le rendu,
     sans effet, cf. « You might not need an effect »). */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
    setOpenDesk(null);
  }

  /* Échap referme ; clic hors du menu referme le sous-menu ouvert au clavier. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDesk(null);
        setMobileOpen(false);
      }
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setMobileOpen(false);
        setSearchOpen(true);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDesk(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  return (
    <header className={cx(c.hdr, scrolled && c.scrolled)}>
      <div className={cx(c.w, c.bar)}>
        <Link href="/" className={c.logo} aria-label={`${header.logoLabel}, accueil`}>
          <BrandLogo size={42} />
        </Link>

        <nav aria-label="Navigation principale" className={c.navWrap}>
          <ul className={c.nav} ref={navRef}>
            {nav.map((item) =>
              item.children && item.children.length > 0 ? (
                <li
                  key={item.label}
                  className={cx(c.navItem, openDesk === item.label && c.open)}
                  onMouseLeave={() => setOpenDesk((v) => (v === item.label ? null : v))}
                >
                  <button
                    type="button"
                    className={cx(c.navLink, groupActive(item) && c.cur)}
                    aria-expanded={openDesk === item.label}
                    onClick={() => setOpenDesk((v) => (v === item.label ? null : item.label))}
                  >
                    {item.label}
                    <Caret aria-hidden="true" />
                  </button>
                  {/* Panneau pleine largeur sous la barre, aligné sur le
                      conteneur : une surface généreuse, jamais une petite
                      boîte accrochée au libellé. */}
                  <div className={c.menu}>
                    <div className={cx(c.w, c.menuIn)}>
                      <div className={c.menuIntro}>
                        <p className={c.menuTitle}>{item.label}</p>
                        {navIntro(item.href) && (
                          <p className={c.menuLead}>{navIntro(item.href)}</p>
                        )}
                        {!item.children.some((ch) => ch.href === item.href) && (
                          <Link href={item.href} className={c.menuAll}>
                            Tout voir
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                      <div className={c.menuGrid}>
                        {item.children.map((ch) => {
                          const courant = isActive(ch.href) && !ch.href.includes("#");
                          const desc = navMeta(ch.href).d;
                          return (
                            <Link
                              key={ch.href + ch.label}
                              href={ch.href}
                              className={cx(c.menuLink, courant && c.cur)}
                              aria-current={courant ? "page" : undefined}
                            >
                              <MenuIcon href={ch.href} />
                              <span className={c.menuText}>
                                <span className={c.menuLabel}>{ch.label}</span>
                                {desc && <span className={c.menuDesc}>{desc}</span>}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                      {!item.children.some((ch) => ch.href.startsWith("/contact")) && (
                        <Link href="/contact" className={c.menuCard}>
                          <span className={c.menuCardKicker}>Démonstration</span>
                          <span className={c.menuCardTitle}>Voir MediCare Pro en action</span>
                          <span className={c.menuCardText}>
                            Un conseiller vous présente le logiciel et répond à vos questions.
                          </span>
                          <span className={c.menuCardCta}>
                            Demander une démo
                            <ArrowRight aria-hidden="true" />
                          </span>
                          <span className={c.menuCardPhone}>
                            <Phone aria-hidden="true" />
                            ou au {contact.phone}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ) : (
                <li key={item.label} className={c.navItem}>
                  <Link
                    href={item.href}
                    className={cx(c.navLink, isActive(item.href) && c.cur)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        {/* Trois éléments, même hauteur, même dessin. Le téléphone n'est plus
            dans la barre : il vit dans la carte « Démonstration » des menus,
            dans le menu mobile et dans le pied de page. */}
        <div className={c.right}>
          <button
            type="button"
            className={c.iconBtn}
            aria-label="Rechercher sur le site"
            onClick={() => setSearchOpen(true)}
            onMouseEnter={prefetchSearchIndex}
            onFocus={prefetchSearchIndex}
          >
            <Search aria-hidden="true" />
          </button>
          <a href={loginUrl()} className={c.login} aria-label={header.loginLabel}>
            <User aria-hidden="true" />
            <span className={c.loginText}>{header.loginLabel}</span>
          </a>
          {/* L'appel à l'action de la page, pas un raccourci vers « Contact » :
              c'est ce qu'on attend d'un visiteur qui découvre le logiciel. */}
          <Link href="/contact" className={c.cta}>
            Demander une démo
          </Link>
          <button
            type="button"
            className={cx(c.iconBtn, c.burger)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            aria-controls="menu-mobile"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <Close aria-hidden="true" /> : <Burger aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Menu mobile : panneau pleine largeur sous la barre, jamais une fenêtre centrée. */}
      <div id="menu-mobile" className={c.mpanel} hidden={!mobileOpen}>
        <div className={c.w}>
          <nav className={c.mnav} aria-label="Menu mobile">
            {nav.map((item) =>
              item.children && item.children.length > 0 ? (
                <div key={item.label} className={cx(c.mgroup, openGroup === item.label && c.open)}>
                  <button
                    type="button"
                    className={c.mhead}
                    aria-expanded={openGroup === item.label}
                    onClick={() => setOpenGroup((v) => (v === item.label ? null : item.label))}
                  >
                    {item.label}
                    <Caret aria-hidden="true" />
                  </button>
                  {openGroup === item.label && (
                    <div className={c.msub}>
                      {item.children.map((ch) => (
                        <Link key={ch.href + ch.label} href={ch.href} onClick={() => setMobileOpen(false)}>
                          <MenuIcon href={ch.href} />
                          {ch.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div key={item.label} className={c.mgroup}>
                  <Link href={item.href} className={c.mhead} onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </Link>
                </div>
              ),
            )}
          </nav>
          <div className={c.mactions}>
            <Link href="/contact" className={c.mPrimary} onClick={() => setMobileOpen(false)}>
              Demander une démo
            </Link>
            <a href={loginUrl()} className={c.mOutline}>
              {header.loginLabel}
            </a>
            <a href={contact.phoneHref} className={c.mTel}>
              <Phone aria-hidden="true" />
              {contact.phone}
            </a>
          </div>
        </div>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
