import type { SectionContentOf } from "@/lib/cms/sections.schema";
import { BtnRow, Crumb, CrumbJsonLd, Eyebrow, HeroGrid, Section, Sub, Text, Title, TrustLine, type Tint } from "./Kit";
import { Devices, PhotoFrame } from "./Visuals";
import k from "./kit.module.css";

/**
 * En-tête de page (section `page_hero` du CMS), construction de la
 * référence : texte à gauche (fil d'Ariane ou sur-titre, h1, sous-titre,
 * texte, boutons, ligne de preuves), visuel à droite posé sur une forme.
 * Sans image ni écran : en-tête centré, texte seul.
 */
export default function PageHead({
  content,
  crumbs,
  variant = 0,
  tint = "white",
  phone = true,
  imagePosition,
  textOnly,
}: {
  content: SectionContentOf<"page_hero">;
  /** Fil d'Ariane (absent sur l'accueil, qui montre le sur-titre). */
  crumbs?: { label: string; href: string }[];
  variant?: number;
  tint?: Tint;
  phone?: boolean;
  imagePosition?: string;
  /** En-tête centré sans visuel, même si le CMS fournit une image. */
  textOnly?: boolean;
}) {
  const text = (
    <>
      {crumbs ? (
        <>
          <Crumb items={crumbs} />
          <CrumbJsonLd items={crumbs} />
        </>
      ) : (
        content.kicker && <Eyebrow>{content.kicker}</Eyebrow>
      )}
      {content.badge && <span className={k.badge}>{content.badge}</span>}
      <Title as="h1">{content.title}</Title>
      {/* Sous-titre et texte forment un seul chapô sous le h1 : le
          sous-titre reste un cran sous le titre, le texte le détaille. */}
      {(content.sub || content.lead) && (
        <div className={k.intro}>
          {content.sub && <Sub>{content.sub}</Sub>}
          {content.lead && <Text>{content.lead}</Text>}
        </div>
      )}
      <BtnRow links={content.ctas ?? []} />
      <TrustLine items={content.trust ?? []} />
    </>
  );

  const visual = textOnly ? null : content.mockup ? (
    <Devices screen={content.mockup} variant={variant} phone={phone} highlight={content.highlight ?? null} />
  ) : content.image?.path ? (
    <PhotoFrame
      src={content.image.path}
      alt={content.image.alt}
      variant={variant}
      position={imagePosition ?? content.imagePos ?? "50% 50%"}
      priority
    />
  ) : null;

  return (
    <Section tint={tint} hero center={!visual}>
      {visual ? <HeroGrid visual={visual}>{text}</HeroGrid> : <div data-hero-text="" style={{ maxWidth: 900, marginInline: "auto" }}>{text}</div>}
    </Section>
  );
}
