"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldPlus,
  Search,
  Burger,
  Close,
  Phone,
  Mail,
  MapPin,
  Facebook,
  LinkedIn,
  Instagram,
  XSocial,
  Caret,
} from "./icons";
import { loginUrl } from "@/lib/appLinks";
import { lines } from "@/components/cms/inline";
import styles from "./Header.module.css";

type NavChild = { label: string; href: string };
type NavLink = { label: string; href: string; children?: NavChild[] };

/* Icônes des réseaux sociaux du drawer (clés string des réglages CMS). */
const SOCIAL_ICONS = { Facebook, LinkedIn, Instagram, XSocial } as const;

/** Réglages consommés par le header (sous-ensemble de site_settings). */
type HeaderSettings = {
  logoLabel: string;
  loginLabel: string;
  drawer: {
    title: string;
    followLabel: string;
    socials: { label: string; icon: string; href: string }[];
  };
};
type ContactSettings = { phone: string; email: string; address: string };

export default function Header({
  nav,
  header,
  contact,
}: {
  nav: NavLink[];
  header: HeaderSettings;
  contact: ContactSettings;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Groupes (accordéon) dépliés dans le drawer, indexés par label.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Un lien parent est actif si lui-même ou l'un de ses enfants l'est.
  const isGroupActive = (link: NavLink) =>
    isActive(link.href) || (link.children?.some((c) => isActive(c.href)) ?? false);

  // Fond blanc au scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Verrou du scroll + fermeture clavier quand le drawer est ouvert
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
        <div className={`wrap ${styles.nav}`}>
          <Link href="/" className={styles.logo}>
            <ShieldPlus className={styles.shield} />
            {header.logoLabel}
          </Link>
          <ul className={styles.menu}>
            {nav.map((link) =>
              link.children ? (
                <li key={link.label} className={styles.hasChildren}>
                  <Link
                    href={link.href}
                    className={isGroupActive(link) ? styles.active : undefined}
                    aria-current={isActive(link.href) ? "page" : undefined}
                  >
                    {link.label}
                    <Caret className={styles.caret} />
                  </Link>
                  <div className={styles.dropdown}>
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={isActive(child.href) ? styles.active : undefined}
                        aria-current={isActive(child.href) ? "page" : undefined}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </li>
              ) : (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={isActive(link.href) ? styles.active : undefined}
                    aria-current={isActive(link.href) ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            )}
          </ul>
          <div className={styles.navRight}>
            <a href={loginUrl()} className={styles.loginLink}>
              {header.loginLabel}
            </a>
            <button className={styles.iconBtn} aria-label="Rechercher">
              <Search width={22} height={22} />
            </button>
            <button
              className={styles.iconBtn}
              aria-label="Ouvrir le menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Burger width={26} height={26} />
            </button>
          </div>
        </div>
      </header>

      {/* ---- Panneau latéral (drawer) ---- */}
      <div
        className={`${styles.overlay} ${drawerOpen ? styles.open : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={`${styles.drawer} ${drawerOpen ? styles.open : ""}`}
        aria-hidden={!drawerOpen}
      >
        <button
          className={styles.drawerClose}
          aria-label="Fermer"
          onClick={() => setDrawerOpen(false)}
        >
          <Close width={20} height={20} />
        </button>
        <Link
          href="/"
          className={styles.logo}
          onClick={() => setDrawerOpen(false)}
        >
          <ShieldPlus className={styles.shield} />
          {header.logoLabel}
        </Link>
        <h3 className={styles.drawerTitle}>{lines(header.drawer.title)}</h3>
        <nav className={styles.drawerNav}>
          {nav.map((link) => {
            if (!link.children) {
              return (
                <div key={link.label}>
                  <Link
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    className={isActive(link.href) ? styles.active : undefined}
                    aria-current={isActive(link.href) ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                </div>
              );
            }
            // Groupe avec sous-pages : le label mène à SA page ; un bouton
            // chevron distinct déplie/replie les sous-pages (accordéon).
            // Ouvert si déplié manuellement ou si une de ses pages est active.
            const expanded = openGroups[link.label] ?? isGroupActive(link);
            return (
              <div key={link.label}>
                <div
                  className={`${styles.groupRow} ${
                    isGroupActive(link) ? styles.active : ""
                  }`}
                >
                  <Link
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    className={styles.groupLink}
                    aria-current={isActive(link.href) ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                  <button
                    type="button"
                    className={styles.groupToggle}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Replier" : "Déplier"} ${link.label}`}
                    onClick={() => toggleGroup(link.label)}
                  >
                    <Caret
                      className={`${styles.groupCaret} ${
                        expanded ? styles.groupCaretOpen : ""
                      }`}
                    />
                  </button>
                </div>
                <div
                  className={`${styles.drawerSub} ${
                    expanded ? styles.drawerSubOpen : ""
                  }`}
                >
                  <div className={styles.drawerSubInner}>
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setDrawerOpen(false)}
                        className={isActive(child.href) ? styles.active : undefined}
                        aria-current={isActive(child.href) ? "page" : undefined}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className={styles.drawerContact}>
          <span>
            <span className={styles.dc}>
              <Phone width={16} height={16} />
            </span>
            {contact.phone}
          </span>
          <span>
            <span className={styles.dc}>
              <Mail width={16} height={16} />
            </span>
            {contact.email}
          </span>
          <span>
            <span className={styles.dc}>
              <MapPin width={16} height={16} />
            </span>
            {contact.address}
          </span>
        </div>
        <div className={styles.drawerFollow}>
          <b>{header.drawer.followLabel}</b>
          <div className={styles.ds}>
            {header.drawer.socials.map((social) => {
              const Icon = SOCIAL_ICONS[social.icon as keyof typeof SOCIAL_ICONS];
              return (
                <a href={social.href} aria-label={social.label} key={social.label}>
                  <Icon width={17} height={17} />
                </a>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
