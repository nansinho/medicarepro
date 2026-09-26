import type { CSSProperties, ReactNode } from "react";

/* ============================================================
   Pièces communes des écrans du logiciel : icônes au trait de
   l'app, fenêtre (barre d'adresse + menu latéral), unité --u.
   Les écrans sont des illustrations (aria-hidden côté parent) :
   données d'exemple, patients anonymisés.
   ============================================================ */

/** Mesure écran : n pixels de la maquette à 820px de large. */
export const u = (n: number) => `calc(${n} * var(--u))`;

const PATHS: Record<string, ReactNode> = {
  cal: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2" />
    </>
  ),
  foot: (
    <>
      <path d="M9.2 21.5c-2.3 0-3.6-1.8-3.2-4.4.3-2.3 1.6-3.5 1.4-6-.2-2.5 1.1-4.6 3.4-4.6 2.5 0 3.6 2.1 3.2 5-.4 2.9-1.5 4.1-1.6 6.1-.1 2.3-1 3.9-3.2 3.9z" />
      <circle cx="15.8" cy="4.2" r="1.6" />
      <circle cx="18.6" cy="6.6" r="1.2" />
      <circle cx="12.8" cy="3" r="1.1" />
    </>
  ),
  insole: (
    <>
      <path d="M12 2.5c3.4 0 5.4 2.6 5.1 6.8-.2 3-1.6 4.6-1.6 7.3 0 2.9-1.5 4.9-3.7 4.9s-3.8-1.8-3.8-4.6c0-2.3 1-3.8.8-6.4C8.5 6.4 8.7 2.5 12 2.5z" />
      <path d="M9.6 9h5.2" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  chart: <path d="M3 21h18M6.5 17v-5M11 17V7M15.5 17v-8M20 17V4" />,
  spark: (
    <>
      <path d="M11 3l1.9 4.9L17.8 9.8l-4.9 1.9L11 16.6l-1.9-4.9L4.2 9.8l4.9-1.9z" />
      <path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" />
      <path d="M8.5 12l2.4 2.4 4.6-4.8" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="M4.5 12.5l4.5 4.5 10.5-11" />,
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  pen: (
    <>
      <path d="M3 21l3.8-1 11.4-11.4a2.1 2.1 0 0 0-3-3L3.8 17z" />
      <path d="M13.5 7.5l3 3" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  file: (
    <>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
      <path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h5" />
    </>
  ),
  msg: <path d="M4 4.5h16v12H9l-5 4z" />,
  home: <path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7.5h3l1.6-2.5h6.8L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </>
  ),  /* Écran « Nouvelle consultation » (menu, bilans, traçabilité). */
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  chev: <path d="M6 9l6 6 6-6" />,
  chevUp: <path d="M6 15l6-6 6 6" />,
  bell: <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  build: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
      <path d="M8.5 7h2M13.5 7h2M8.5 11h2M13.5 11h2M8.5 15h2M13.5 15h2M10.5 21v-3h3v3" />
    </>
  ),
  clip: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3h6v3H9zM9 11h6M9 15h4" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z" />,
  drop: <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" />,
  bolt: <path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z" />,
  move: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />,
  person: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7.5v6M7.5 10.5l4.5-2 4.5 2M12 13.5l-3.5 7.5M12 13.5l3.5 7.5" />
    </>
  ),
  shoe: <path d="M3 17V9.5l4 .5 3 3 5 1.5 5.2 1.1c.8.2 1.3.9 1.3 1.7V17zM3 19.5h18.5" />,
  link: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10" />,
  print: (
    <>
      <path d="M7 8V3.5h10V8M7 17H5a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 5 8.5h14a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 19 17h-2" />
      <path d="M7 14h10v6.5H7z" />
    </>
  ),
  down: <path d="M12 3.5v12M7 11l5 5 5-5M4 20.5h16" />,
  trash: <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14M10 10.5v6M14 10.5v6" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  qr: <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  wrench: <path d="M15 3.5a5 5 0 0 0-4.6 6.9l-6.9 6.9a2 2 0 0 0 2.8 2.8l6.9-6.9A5 5 0 0 0 20.5 9l-3 1-2-2 1-3z" />,
  euro: <path d="M17.5 6.5a7 7 0 1 0 0 11M4 10h9M4 14h9" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17.2h.01" />
    </>
  ),
};

export function AppIcon({ name, style }: { name: keyof typeof PATHS | string; style?: CSSProperties }) {
  return (
    <svg
      className="i"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {PATHS[name] ?? PATHS.check}
    </svg>
  );
}

/** Pictogramme officiel (menu de l'app). */
export function AppBrand() {
  return (
    <div className="app-brand">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique */}
      <img
        src="/brand/svg/medicarepro-logo-horizontal.svg"
        alt=""
        style={{ width: "auto", height: u(24) }}
      />
    </div>
  );
}

const SIDE: [string, string][] = [
  ["grid", "Tableau de bord"],
  ["cal", "Agenda"],
  ["users", "Patients"],
  ["foot", "Bilans"],
  ["insole", "Orthèses"],
  ["receipt", "Facturation"],
  ["chart", "Comptabilité"],
  ["msg", "Messagerie"],
];

/** Menu latéral de l'app praticien, entrée active mise en avant. */
export function AppSide({
  on,
  items = SIDE,
  footer = "Cabinet · 2 praticiens",
  initials = "CP",
}: {
  on: string;
  items?: [string, string][];
  footer?: string;
  initials?: string;
}) {
  return (
    <aside className="app-side">
      <AppBrand />
      {items.map(([icon, label]) => (
        <a key={label} className={label === on ? "on" : undefined}>
          <AppIcon name={icon} />
          {label}
        </a>
      ))}
      <span className="sp" />
      <div className="app-user">
        <i>{initials}</i>
        {footer}
      </div>
    </aside>
  );
}

/** Fenêtre de navigateur + app (barre d'adresse, menu, zone principale). */
export function AppWin({
  url,
  side,
  children,
}: {
  url: string;
  side: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="win">
      <div className="win-bar">
        <i />
        <i />
        <i />
        <span className="win-url">
          <AppIcon name="lock" />
          {url}
        </span>
      </div>
      <div className="app">
        {side}
        <div className="app-main">{children}</div>
      </div>
    </div>
  );
}

/** En-tête d'écran : titre, sous-titre, actions à droite. */
export function AppHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children?: ReactNode;
}) {
  return (
    <div className="app-head">
      <div>
        <h4>{title}</h4>
        <p>{sub}</p>
      </div>
      {children && <div style={{ display: "flex", gap: u(6) }}>{children}</div>}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

/** Voûte plantaire du pied (bilans, semelles). */
export function FootSole({ fill = "#EAF2FD", stroke = "#9CB8E2" }: { fill?: string; stroke?: string }) {
  return (
    <g style={{ fill, stroke, strokeWidth: 1.3 }}>
      <path d="M62 282C37 282 29 257 31 232C33 202 27 176 21 146C15 118 13 97 19 82C27 66 48 60 70 58C91 57 105 64 107 82C109 102 97 124 89 146C83 164 85 188 89 210C93 238 91 282 62 282Z" />
      <ellipse cx="88" cy="30" rx="14" ry="19" />
      <ellipse cx="64" cy="27" rx="8.5" ry="11.5" />
      <ellipse cx="47" cy="33" rx="7.5" ry="10" />
      <ellipse cx="33" cy="42" rx="6.8" ry="9" />
      <ellipse cx="21" cy="55" rx="6" ry="8" />
    </g>
  );
}
