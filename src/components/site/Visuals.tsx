import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Calendar, Check } from "@/components/icons";
import { CrossMark, DrawnArrow } from "./Symbols";
import { Icon } from "./icon";
import AppScreen, { type ScreenKind } from "./screens/AppScreen";
import PhoneMock from "./screens/PhoneMock";
import v from "./visuals.module.css";

/* ============================================================
   Visuels : photo posée sur une forme, ordinateur + téléphone
   posés sur une forme, formes coupées au bord des sections.
   Les variantes tournent par index (passé par la page) pour que
   deux visuels voisins ne se ressemblent jamais.
   data-anim : le visuel se construit une fois, à son entrée à l'écran
   (ScrollEffects) ou dès l'affichage dans le haut de page.
   ============================================================ */

const TEAL = "var(--shape-teal)";
const AMBER = "var(--shape-amber)";
const VIOLET = "var(--shape-violet)";
const BLUE = "var(--shape-blue)";
const SKY = "var(--shape-sky)";

function Shape({
  style,
  kind,
  color,
}: {
  style: CSSProperties;
  kind?: "circle" | "sq" | "ring";
  color: string;
}) {
  const cls = [v.shp, kind ? v[kind] : ""].join(" ");
  const s: CSSProperties =
    kind === "ring"
      ? { borderColor: color, ...style }
      : { background: color, ...style };
  return <span className={cls} style={s} aria-hidden="true" />;
}

function Dot({ style, size, color }: { style: CSSProperties; size: number; color: string }) {
  return (
    <span
      className={v.dot}
      style={{ width: size, height: size, background: color, ...style }}
      aria-hidden="true"
    />
  );
}

function Cross({ style, color }: { style: CSSProperties; color: string }) {
  return <CrossMark className={v.cross} style={{ color, ...style }} />;
}

/* ---------- Photo posée sur une forme (6 variantes) ---------- */

const FRAME_DECO: ReactNode[] = [
  // 0 : carré arrondi décalé en bas à gauche + deux points
  <>
    <Shape kind="sq" color={TEAL} style={{ left: 6, bottom: 14, width: "74%", height: "72%" }} />
    <Dot style={{ left: "18%", top: 0 }} size={22} color={TEAL} />
    <Dot style={{ left: "10%", top: "9%" }} size={11} color={VIOLET} />
  </>,
  // 1 : demi-cercle ambre qui dépasse à droite
  <>
    <Shape
      color={AMBER}
      style={{ right: 0, top: "14%", width: "46%", aspectRatio: "1 / 2", borderRadius: "0 999px 999px 0" }}
    />
    <Dot style={{ left: "2%", top: "4%" }} size={18} color={VIOLET} />
    <Dot style={{ left: "14%", bottom: "4%" }} size={12} color={BLUE} />
  </>,
  // 2 : croix du logo en bas à droite
  <>
    <Cross color={TEAL} style={{ right: "-4%", bottom: "-6%", width: "46%" }} />
    <Dot style={{ left: "4%", top: "2%" }} size={16} color={AMBER} />
    <Dot style={{ left: "12%", top: "11%" }} size={9} color={TEAL} />
  </>,
  // 3 : quart de cercle violet en haut à gauche + anneau
  <>
    <Shape
      color={VIOLET}
      style={{ left: 0, top: 0, width: "52%", aspectRatio: "1", borderRadius: "100% 0 0 0" }}
    />
    <Shape kind="ring" color={TEAL} style={{ right: "4%", bottom: 0, width: "24%", aspectRatio: "1", borderWidth: 12 }} />
    <Dot style={{ right: "30%", top: "3%" }} size={12} color={AMBER} />
  </>,
  // 4 : carré bleu incliné en haut à droite + demi-cercle turquoise en bas
  <>
    <Shape
      kind="sq"
      color={BLUE}
      style={{ right: 10, top: 8, width: "60%", height: "62%", transform: "rotate(6deg)" }}
    />
    <Shape
      color={TEAL}
      style={{ left: "12%", bottom: 0, width: "30%", aspectRatio: "2 / 1", borderRadius: "999px 999px 0 0" }}
    />
    <Dot style={{ left: "3%", top: "10%" }} size={16} color={AMBER} />
  </>,
  // 5 : grand cercle ambre + petit carré violet
  <>
    <Shape kind="circle" color={AMBER} style={{ right: "-2%", bottom: "6%", width: "58%", aspectRatio: "1" }} />
    <Shape
      kind="sq"
      color={VIOLET}
      style={{ left: "4%", top: "4%", width: "18%", aspectRatio: "1", transform: "rotate(-10deg)", borderRadius: 18 }}
    />
    <Dot style={{ right: "8%", top: "6%" }} size={12} color={TEAL} />
  </>,
];

export function PhotoFrame({
  src,
  alt,
  variant = 0,
  position = "50% 50%",
  priority,
  sizes = "(max-width: 920px) 92vw, 46vw",
}: {
  src: string;
  alt: string;
  variant?: number;
  position?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={v.frame} data-anim="vis">
      {FRAME_DECO[variant % FRAME_DECO.length]}
      <div className={v.photo}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectPosition: position }}
        />
      </div>
    </div>
  );
}

/** Carte blanche (logo, attestation…) posée sur une forme, comme une photo. */
export function CardFrame({ children, variant = 0 }: { children: ReactNode; variant?: number }) {
  return (
    <div className={v.frame} data-anim="vis">
      {FRAME_DECO[variant % FRAME_DECO.length]}
      <div className={v.cardIn}>{children}</div>
    </div>
  );
}

/* ---------- Ordinateur + téléphone (4 variantes) ---------- */

const DEVICE_DECO: ReactNode[] = [
  // 0 : forme en D turquoise derrière l'écran
  <>
    <Shape
      color={TEAL}
      style={{ right: 0, top: "6%", width: "62%", height: "88%", borderRadius: "0 999px 999px 0" }}
    />
    <Dot style={{ left: "4%", top: "2%" }} size={18} color={VIOLET} />
    <Dot style={{ right: "2%", top: 0 }} size={12} color={AMBER} />
  </>,
  // 1 : demi-cercle ambre + carré violet
  <>
    <Shape
      color={AMBER}
      style={{ left: "8%", top: 0, width: "70%", aspectRatio: "2 / 1", borderRadius: "999px 999px 0 0" }}
    />
    <Shape
      kind="sq"
      color={VIOLET}
      style={{ right: 0, bottom: "6%", width: "22%", aspectRatio: "1", transform: "rotate(12deg)", borderRadius: 22 }}
    />
    <Dot style={{ left: 0, bottom: "18%" }} size={14} color={TEAL} />
  </>,
  // 2 : grand cercle bleu coupé + anneau turquoise
  <>
    <Shape kind="circle" color={BLUE} style={{ right: "-6%", top: "-6%", width: "64%", aspectRatio: "1" }} />
    <Shape kind="ring" color={TEAL} style={{ left: 0, bottom: "4%", width: "26%", aspectRatio: "1", borderWidth: 14 }} />
  </>,
  // 3 : carré arrondi turquoise + croix ambre
  <>
    <Shape
      kind="sq"
      color={TEAL}
      style={{ left: "4%", top: "4%", width: "68%", height: "84%", transform: "rotate(-4deg)" }}
    />
    <Cross color={AMBER} style={{ right: 0, bottom: 0, width: "26%" }} />
    <Dot style={{ right: "30%", top: 0 }} size={14} color={VIOLET} />
  </>,
];

export type Highlight = {
  title: string;
  text: string;
  cta: string;
  /** Clé d'icône du site ; défaut : agenda. */
  icon?: string;
};

export function Devices({
  screen,
  variant = 0,
  phone = true,
  highlight,
}: {
  screen: ScreenKind;
  variant?: number;
  phone?: boolean;
  /** Carte mise en avant sur l'écran, désignée par une flèche (hero). */
  highlight?: Highlight | null;
}) {
  return (
    <div className={v.devs} data-anim="vis" data-screen={screen}>
      {DEVICE_DECO[variant % DEVICE_DECO.length]}
      {highlight && <DrawnArrow className={v.arrow} />}
      <div className={v.laptop} aria-hidden="true">
        <div className={v.lpScr}>
          <AppScreen kind={screen} />
        </div>
        <div className={v.lpBase} />
      </div>
      {phone && (
        <div className={v.phoneSlot} aria-hidden="true">
          <PhoneMock />
        </div>
      )}
      {highlight && (
        <div className={v.hl} aria-hidden="true">
          <span className={v.hlOk}>
            <Check />
          </span>
          <span className={v.hlIco}>
            {highlight.icon ? <Icon name={highlight.icon} /> : <Calendar />}
          </span>
          <span className={v.hlBody}>
            <b>{highlight.title}</b>
            {highlight.text}
            <span className={v.hlPill}>{highlight.cta}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- Formes coupées au bord des sections (6 variantes) ----------
   Toujours ancrées dans les coins : la partie visible tient dans la marge
   et le rembourrage de la section, jamais derrière un texte. */

const EDGE: ReactNode[] = [
  <>
    <Shape kind="circle" color={TEAL} style={{ left: -130, top: -130, width: 260, aspectRatio: "1" }} />
    <Shape kind="sq" color={AMBER} style={{ right: -70, bottom: -70, width: 200, aspectRatio: "1", transform: "rotate(18deg)" }} />
  </>,
  <>
    <Shape kind="circle" color={VIOLET} style={{ right: -150, top: -150, width: 300, aspectRatio: "1" }} />
    <Shape kind="sq" color={SKY} style={{ left: -50, bottom: -50, width: 140, aspectRatio: "1" }} />
  </>,
  <>
    <Shape kind="ring" color={TEAL} style={{ left: -90, bottom: -90, width: 260, aspectRatio: "1", borderWidth: 34 }} />
    <Shape kind="circle" color={AMBER} style={{ right: -110, top: -110, width: 220, aspectRatio: "1" }} />
  </>,
  <>
    <Shape kind="sq" color={TEAL} style={{ right: -60, top: -60, width: 170, aspectRatio: "1", transform: "rotate(-14deg)" }} />
    <Shape kind="circle" color={BLUE} style={{ left: -140, bottom: -140, width: 280, aspectRatio: "1" }} />
  </>,
  <>
    <Cross color={TEAL} style={{ left: -110, top: -80, width: 260 }} />
    <Shape kind="circle" color={VIOLET} style={{ right: -130, bottom: -130, width: 300, aspectRatio: "1" }} />
  </>,
  <>
    <Shape kind="circle" color={AMBER} style={{ left: -120, bottom: -120, width: 240, aspectRatio: "1" }} />
    <Shape kind="sq" color={TEAL} style={{ right: -50, top: -50, width: 140, aspectRatio: "1", transform: "rotate(22deg)" }} />
  </>,
];

export function EdgeShapes({ variant }: { variant: number }) {
  return (
    <div className={v.edge} data-anim="edge" aria-hidden="true">
      {EDGE[((variant % EDGE.length) + EDGE.length) % EDGE.length]}
    </div>
  );
}
