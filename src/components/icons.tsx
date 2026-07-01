/**
 * Icônes SVG centralisées (style "lucide", trait fin, cohérent).
 * Toutes héritent de currentColor — la couleur est pilotée par le parent.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ShieldPlus(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}

export function Shield(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
    </svg>
  );
}

export function ShieldCheck(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function Caret(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronUp(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.4} {...props}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

export function Search(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function Burger(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function Close(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function Phone(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

export function Mail(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function MapPin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function Headset(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="2" y="14" width="5" height="6" rx="2" />
      <rect x="17" y="14" width="5" height="6" rx="2" />
      <path d="M20 18v1a3 3 0 0 1-3 3h-3" />
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...base} strokeWidth={3} {...props}>
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
}

export function Play(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function Lock(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function CheckCircle(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="m5 12 5 5L20 7" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export function Grid(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function Clock(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function FileText(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  );
}

export function Signature(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <path d="M3 18c3-1 4-9 7-9s2 5 4 5 2-3 4-3" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function Calculator(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2" />
    </svg>
  );
}

export function Calendar(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function Smartphone(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function Invoice(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 7h6M9 11h6" />
    </svg>
  );
}

export function BadgeCheck(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <circle cx="12" cy="9" r="6" />
      <path d="m9 14-2 7 5-3 5 3-2-7" />
      <path d="m10 9 1.5 1.5L15 7" />
    </svg>
  );
}

export function Refresh(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function Image(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.3} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 16-5-5L5 21" />
    </svg>
  );
}

export function Monitor(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.3} {...props}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18M8 21h8" />
    </svg>
  );
}

export function User(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function Quote(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7 7h4v4c0 3-1.5 5-4 6V14H5V9a2 2 0 0 1 2-2Zm9 0h4v4c0 3-1.5 5-4 6V14h-2V9a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function Star(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />
    </svg>
  );
}

export function Facebook(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M14 9h3V6h-3c-2 0-3 1-3 3v2H8v3h3v7h3v-7h3l1-3h-4V9c0-.5.3-1 1-1Z" />
    </svg>
  );
}

export function LinkedIn(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 4h4v16H4zM6 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 6h4v2c.6-1 2-2 4-2 3 0 4 2 4 5v7h-4v-6c0-1.5-.5-2.5-2-2.5S14 13 14 14.5V20h-4Z" />
    </svg>
  );
}

export function Instagram(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

export function XSocial(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3 3h4l5 7 5-7h4l-7 9 7 9h-4l-5-7-5 7H3l7-9Z" />
    </svg>
  );
}

/* ---- Icônes ajoutées pour les écrans d'authentification (Phase 1) ---- */

export function Eye(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOff(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 7 10 7a18.4 18.4 0 0 1-3.2 4.1M6.6 6.6A18.4 18.4 0 0 0 2 11s3.5 7 10 7a10.6 10.6 0 0 0 4.3-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
    </svg>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function Minus(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function Plus(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Users(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M16 4.2a3.5 3.5 0 0 1 0 6.8M21 20c0-2.8-1.8-4.4-4.5-4.9" />
    </svg>
  );
}

export function Info(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function FileSignature(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v9" />
      <path d="M14 2v5h5M20 9v11a2 2 0 0 1-2 2H8" />
      <path d="M4 17c1.5 0 1.5-2 3-2s1.5 2 3 2" />
    </svg>
  );
}

export function CircleCheck(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5L16 9" />
    </svg>
  );
}

/* ------- Sécurité / infrastructure ------- */

export function Server(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </svg>
  );
}

export function Key(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <circle cx="8" cy="8" r="5" />
      <path d="m11.5 11.5 8.5 8.5M16 16l2.5-2.5M14 18l2.5-2.5" />
    </svg>
  );
}

export function Globe(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
    </svg>
  );
}

/**
 * Logo OVHcloud (officiel, monochrome — source SimpleIcons).
 * Path *rempli* : hérite de currentColor via `fill` (pilote la couleur depuis
 * le parent, comme les icônes stroke). Dimensionner via width/height.
 */
export function OvhLogo(props: IconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="OVHcloud"
      {...props}
    >
      <title>OVHcloud</title>
      <path d="M19.881 10.095l2.563-4.45C23.434 7.389 24 9.404 24 11.555c0 2.88-1.017 5.523-2.71 7.594h-6.62l2.04-3.541h-2.696l3.176-5.513h2.691zm-2.32-5.243L9.333 19.14l.003.009H2.709C1.014 17.077 0 14.435 0 11.555c0-2.152.57-4.17 1.561-5.918L5.855 13.1 10.6 4.852h6.961z" />
    </svg>
  );
}

/* ------- Avantages (valeurs, gain de temps, économies) ------- */

export function Sparkles(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M12 3l1.8 4.6L18.4 9.4 13.8 11.2 12 15.8 10.2 11.2 5.6 9.4l4.6-1.8Z" />
      <path d="M19 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
    </svg>
  );
}

export function Zap(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function TrendingUp(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 4h6v6" />
    </svg>
  );
}

export function Wallet(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v0H5a2 2 0 0 0-2 2Z" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 13h.01" />
    </svg>
  );
}

export function Layers(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5M3 18l9 5 9-5" />
    </svg>
  );
}
