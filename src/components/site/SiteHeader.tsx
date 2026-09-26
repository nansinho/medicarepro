"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import SearchOverlay, { prefetchSearchIndex } from "@/components/SearchOverlay";
import { Burger, Caret, Close, Phone, Search } from "@/components/icons";
import { loginUrl } from "@/lib/appLinks";
import type { MenuItem } from "@/data/content/site";
import { Icon } from "./icon";
import { navMeta } from "./navMeta";
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
          <BrandLogo size={46} />
        </Link>

        <nav aria-label="Navigation principale">
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
                  <div className={c.menu}>
                    {item.children.map((ch) => (
                      <Link
                        key={ch.href + ch.label}
                        href={ch.href}
                        className={isActive(ch.href) && !ch.href.includes("#") ? c.cur : undefined}
                        aria-current={isActive(ch.href) && !ch.href.includes("#") ? "page" : undefined}
                      >
                        <MenuIcon href={ch.href} />
                        {ch.label}
                      </Link>
                    ))}
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

        <div className={c.right}>
          <a href={contact.phoneHref} className={c.tel} aria-label={`Appeler le ${contact.phone}`}>
            <Phone aria-hidden="true" />
            <span>{contact.phone}</span>
          </a>
          <a href={loginUrl()} className={c.login}>
            {header.loginLabel}
          </a>
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
          <Link href="/contact" className={c.contact}>
            Contact
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
