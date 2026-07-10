import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import TiltCard from "@/components/motion/TiltCard";
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  BadgeCheck,
  Layers,
  Calculator,
  ArrowRight,
} from "@/components/icons";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import f from "@/components/featureShowcase.module.css";

/* Icônes des cartes (clés string du contenu CMS). */
const ICONS = {
  FileText,
  ShieldCheck,
  CheckCircle,
  BadgeCheck,
  Layers,
  Calculator,
} as const;

/**
 * Grandes cartes immersives vers les pages connexes (sections `portal_cards`).
 * La tonalité de fond reste un choix de mise en page de chaque page.
 * La pastille chiffrée (`stat`) ajoute la rangée icône + stat (recette de la
 * page Avantages).
 */
export default function PortalCards({
  content,
  tone = "soft",
}: {
  content: SectionContentOf<"portal_cards">;
  tone?: "white" | "soft";
}) {
  const toneCls = tone === "white" ? "tone-white" : "tone-soft";
  return (
    <section className={`${f.portalSec} ${toneCls}`}>
      <div className="wrap">
        <Reveal className="sec-head">
          <div className="kicker">{content.kicker}</div>
          <h2 className="sec-title">{content.title}</h2>
        </Reveal>
        <StaggerGroup className={f.portalGrid}>
          {content.cards.map((card) => {
            const Icon = ICONS[card.icon as keyof typeof ICONS];
            return (
              <StaggerItem key={card.href} variant="up">
                <TiltCard className={f.portalCard}>
                  <Link href={card.href} className={f.portalLink}>
                    {card.stat ? (
                      <div className={f.portalIcoRow}>
                        <div className={f.portalIco}>
                          <Icon width={30} height={30} />
                        </div>
                        <span className={f.portalStat}>{card.stat}</span>
                      </div>
                    ) : (
                      <div className={f.portalIco}>
                        <Icon width={30} height={30} />
                      </div>
                    )}
                    <h3 className={f.portalTitle}>{card.title}</h3>
                    <p className={f.portalText}>{card.text}</p>
                    <span className={f.portalMore}>
                      {content.linkLabel ?? "Découvrir"}{" "}
                      <ArrowRight width={16} height={16} />
                    </span>
                  </Link>
                </TiltCard>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
