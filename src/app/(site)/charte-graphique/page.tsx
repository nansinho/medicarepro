import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Download, X } from "lucide-react";
import { Btn, Crumb, CrumbJsonLd, Head, HeroGrid, Section, Sub, Text, Title } from "@/components/site/Kit";
import { CardFrame } from "@/components/site/Visuals";
import c from "@/components/site/charte.module.css";
import k from "@/components/site/kit.module.css";

export const metadata: Metadata = {
  title: "Charte graphique",
  description:
    "Le logo MediCare Pro et ses règles d'usage : déclinaisons, versions de couleur, zone de protection, palette et typographies. Kit logo SVG et PNG à télécharger.",
  alternates: { canonical: "/charte-graphique" },
};

const SVG = (f: string) => `/brand/svg/${f}.svg`;
const PNG = (f: string, w: number) => `/brand/png/${f}-${w}px.png`;

type Variant = { file: string; title: string; text: string; bg: string; png: number };

const FORMS: Variant[] = [
  {
    file: "medicarepro-logo-horizontal",
    title: "Horizontal · version principale",
    text: "En-tête du site, documents, signatures d'e-mail.",
    bg: c.onLight,
    png: 1200,
  },
  {
    file: "medicarepro-logo-vertical",
    title: "Vertical",
    text: "Formats carrés ou hauts : réseaux sociaux, affiches, kakémonos.",
    bg: c.onLight,
    png: 900,
  },
  {
    file: "medicarepro-pictogramme",
    title: "Pictogramme seul",
    text: "Raccourci de la PWA, favicon, avatar, quand le nom figure déjà à côté.",
    bg: c.onLight,
    png: 1024,
  },
  {
    file: "medicarepro-typographie",
    title: "Mot-symbole seul",
    text: "Mentions discrètes et espaces très étroits, sans place pour le pictogramme.",
    bg: c.onLight,
    png: 1200,
  },
];

const COLORS: Variant[] = [
  {
    file: "medicarepro-logo-horizontal",
    title: "Couleur",
    text: "Sur fond blanc ou très clair. Version à privilégier.",
    bg: c.onWhite,
    png: 1200,
  },
  {
    file: "medicarepro-logo-horizontal-fond-sombre",
    title: "Fond sombre",
    text: "Pictogramme en couleur, texte en blanc, sur bleu nuit ou fond foncé uni.",
    bg: c.onDark,
    png: 1200,
  },
  {
    file: "medicarepro-logo-horizontal-bleu-nuit",
    title: "Monochrome bleu nuit",
    text: "Impression une couleur, tampon, gravure.",
    bg: c.onWhite,
    png: 1200,
  },
  {
    file: "medicarepro-logo-horizontal-blanc",
    title: "Monochrome blanc",
    text: "Sur photo ou fond de couleur de la palette.",
    bg: c.onPhoto,
    png: 1200,
  },
];

const PALETTE: [string, string, string, string, string][] = [
  ["Turquoise", "#1FB6A8", "Bilans", "31 182 168", "83 0 8 29"],
  ["Bleu", "#2E6FD0", "Agenda, boutons", "46 111 208", "78 47 0 18"],
  ["Violet", "#8A2BE2", "Orthèses", "138 43 226", "39 81 0 11"],
  ["Ambre", "#EEA700", "Facturation, offres", "238 167 0", "0 30 100 7"],
  ["Bleu ciel", "#6AC6DE", "Portail patient", "106 198 222", "52 11 0 13"],
  ["Vert", "#4CC96B", "Comptabilité", "76 201 107", "62 0 47 21"],
  ["Indigo", "#1C1C82", "Contour, sécurité", "28 28 130", "78 78 0 49"],
];

const TINTS: [string, string][] = [
  ["Turquoise clair", "#E6F6F3"],
  ["Bleu clair", "#E9F1FC"],
  ["Violet clair", "#F1EAFB"],
  ["Ambre clair", "#FFF4DD"],
  ["Ciel clair", "#E4F4FA"],
  ["Marine", "#1D3E5E"],
];

const FILES: [string, string, string, number[]][] = [
  ["medicarepro-logo-horizontal", "Horizontal, fond clair", "principal", [1200, 2400]],
  ["medicarepro-logo-horizontal-fond-sombre", "Horizontal, fond sombre", "", [1200, 2400]],
  ["medicarepro-logo-horizontal-bleu-nuit", "Horizontal, bleu nuit", "", [1200, 2400]],
  ["medicarepro-logo-horizontal-blanc", "Horizontal, blanc", "", [1200, 2400]],
  ["medicarepro-logo-vertical", "Vertical, fond clair", "", [900, 1800]],
  ["medicarepro-logo-vertical-fond-sombre", "Vertical, fond sombre", "", [900, 1800]],
  ["medicarepro-logo-vertical-bleu-nuit", "Vertical, bleu nuit", "", [900, 1800]],
  ["medicarepro-logo-vertical-blanc", "Vertical, blanc", "", [900, 1800]],
  ["medicarepro-pictogramme", "Pictogramme, couleur", "", [1024, 2048]],
  ["medicarepro-pictogramme-bleu-nuit", "Pictogramme, bleu nuit", "", [1024, 2048]],
  ["medicarepro-pictogramme-blanc", "Pictogramme, blanc", "", [1024, 2048]],
  ["medicarepro-typographie", "Mot-symbole, fond clair", "", [1200, 2400]],
  ["medicarepro-typographie-blanc", "Mot-symbole, blanc", "", [1200, 2400]],
];

function Downloads({ file, png }: { file: string; png: number[] }) {
  return (
    <div className={c.dl}>
      <a href={SVG(file)} download>
        <Download aria-hidden="true" /> SVG
      </a>
      {png.map((w) => (
        <a key={w} href={PNG(file, w)} download>
          <Download aria-hidden="true" /> PNG {w} px
        </a>
      ))}
    </div>
  );
}

function VariantCard({ v }: { v: Variant }) {
  return (
    <div className={c.variant}>
      <div className={`${c.preview} ${v.bg}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG vectoriel du kit */}
        <img src={SVG(v.file)} alt={v.title} />
      </div>
      <div className={c.vBody}>
        <b>{v.title}</b>
        <span>{v.text}</span>
        <Downloads file={v.file} png={[v.png]} />
      </div>
    </div>
  );
}

const DONTS: { title: string; text: string; style?: CSSProperties; photo?: boolean; fake?: boolean }[] = [
  { title: "Déformer", text: "Toujours redimensionner en conservant les proportions.", style: { transform: "scale(1.2, 0.6)" } },
  { title: "Changer les couleurs", text: "Seules les versions fournies sont autorisées.", style: { filter: "hue-rotate(140deg) saturate(1.6)" } },
  { title: "Pivoter", text: "Le logo reste horizontal.", style: { transform: "rotate(-12deg)" } },
  { title: "Ajouter des effets", text: "Ni ombre, ni contour, ni relief.", style: { filter: "drop-shadow(6px 6px 5px rgba(0,0,0,.45))" } },
  { title: "Recomposer le nom", text: "Toujours utiliser les fichiers, jamais une autre police.", fake: true },
  { title: "Poser la couleur sur une photo", text: "Sur image ou fond chargé : version blanche.", photo: true },
];

export default function ChartePage() {
  const crumbs = [
    { label: "Accueil", href: "/" },
    { label: "Charte graphique", href: "/charte-graphique" },
  ];

  return (
    <>
      <Section hero>
        <HeroGrid
          visual={
            <CardFrame variant={0}>
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG vectoriel du kit */}
              <img
                src={SVG("medicarepro-logo-vertical")}
                alt="Logo MediCare Pro, version verticale"
                style={{ width: "72%", height: "auto" }}
              />
            </CardFrame>
          }
        >
          <Crumb items={crumbs} />
          <CrumbJsonLd items={crumbs} />
          <Title as="h1">Charte graphique</Title>
          <Sub>Le logo MediCare Pro et ses règles d&apos;usage.</Sub>
          <div style={{ marginTop: 18 }}>
            <Text>
              Toutes les versions du logo en SVG et en PNG, la palette, les typographies et les règles à respecter pour
              que la marque reste reconnaissable partout.
            </Text>
          </div>
          <div className={k.row}>
            <Btn href="/brand/medicarepro-kit-logo.zip" size="lg" icon={<Download aria-hidden="true" />}
              download>
              Kit logo complet (ZIP)
            </Btn>
            <Btn
              href="/brand/medicarepro-charte-graphique.pdf"
              variant="outline"
              size="lg"
              icon={<Download aria-hidden="true" />}
              download
            >
              Charte en PDF
            </Btn>
          </div>
        </HeroGrid>
      </Section>

      <Section tint="blue" edge={1}>
        <Head eyebrow="01 · Le logo" title="Un pictogramme, un nom" />
        <div className={c.stage}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG vectoriel du kit */}
          <img src={SVG("medicarepro-logo-horizontal")} alt="Logo MediCare Pro" />
        </div>
        <div className={c.parts}>
          <div style={{ "--c": "var(--brand-teal)" } as CSSProperties}>
            <h3>Le pictogramme</h3>
            <p>
              La croix du soin, tracée d&apos;un seul ruban aux couleurs de nos modules, entoure l&apos;étoile à quatre
              branches. Les orbites et les points rappellent le suivi du patient dans le temps.
            </p>
          </div>
          <div style={{ "--c": "#182A45" } as CSSProperties}>
            <h3>Le mot MEDICARE</h3>
            <p>
              En capitales Montserrat Bold, bleu nuit. Il est dessiné une fois pour toutes et fourni vectorisé : on ne
              le recompose jamais au clavier.
            </p>
          </div>
          <div style={{ "--c": "#767E8C" } as CSSProperties}>
            <h3>La mention PRO</h3>
            <p>
              Plus petite, en gris ardoise, alignée sur le haut des capitales. Elle signe l&apos;outil des
              professionnels de santé sans concurrencer le nom.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <Head eyebrow="02 · Construction" title="Des proportions fixes" />
        {/* eslint-disable-next-line @next/next/no-img-element -- schéma SVG */}
        <img
          className={c.guide}
          src="/brand/guides/construction.svg"
          alt="Construction du logo : le pictogramme mesure 2,3 x, PRO 0,48 x, l'espace entre pictogramme et texte 0,44 x, x étant la hauteur du M"
        />
        <div className={c.parts}>
          <div style={{ "--c": "var(--brand-blue)" } as CSSProperties}>
            <h3>L&apos;unité x</h3>
            <p>Toutes les mesures dérivent de x, la hauteur de capitale du « M » de MEDICARE.</p>
          </div>
          <div style={{ "--c": "var(--brand-violet)" } as CSSProperties}>
            <h3>PRO</h3>
            <p>Hauteur de capitale 0,48 x, haut aligné sur le haut des capitales, à 0,28 x du « E ».</p>
          </div>
          <div style={{ "--c": "var(--brand-teal)" } as CSSProperties}>
            <h3>Le pictogramme</h3>
            <p>Hauteur 2,3 x dans la version horizontale, à 0,44 x du texte, centré sur les capitales.</p>
          </div>
          <div style={{ "--c": "var(--brand-amber)" } as CSSProperties}>
            <h3>Version verticale</h3>
            <p>Pictogramme large de la moitié du texte, centré au-dessus, à 0,75 x des capitales.</p>
          </div>
        </div>
      </Section>

      <Section tint="teal" edge={0}>
        <Head eyebrow="03 · Déclinaisons" title="Quatre formes, un seul logo" />
        <div className={c.variants}>
          {FORMS.map((v) => (
            <VariantCard key={v.file} v={v} />
          ))}
        </div>
      </Section>

      <Section>
        <Head eyebrow="04 · Versions de couleur" title="Toujours lisible, quel que soit le fond" />
        <div className={c.variants}>
          {COLORS.map((v) => (
            <VariantCard key={v.file} v={v} />
          ))}
        </div>
      </Section>

      <Section tint="violet" edge={2}>
        <Head
          eyebrow="05 · Zone de protection"
          title="De l'air autour du logo"
          lead="Aucun texte, bord de page ou autre élément n'entre dans une marge égale à x (la hauteur du « M ») sur les quatre côtés du logo."
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- schéma SVG */}
        <img
          className={c.guide}
          src="/brand/guides/zone-de-protection.svg"
          alt="Zone de protection : une marge égale à x tout autour du logo"
          style={{ maxWidth: 900 }}
        />
        <div className={c.mins}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG du kit */}
            <img src={SVG("medicarepro-logo-horizontal")} alt="" style={{ height: 28 }} />
            <b>Horizontal</b>
            <span>30 mm de large à l&apos;impression, 120 px à l&apos;écran.</span>
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG du kit */}
            <img src={SVG("medicarepro-logo-vertical")} alt="" style={{ height: 48 }} />
            <b>Vertical</b>
            <span>22 mm de large à l&apos;impression, 90 px à l&apos;écran.</span>
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG du kit */}
            <img src={SVG("medicarepro-pictogramme")} alt="" style={{ height: 28 }} />
            <b>Pictogramme</b>
            <span>8 mm à l&apos;impression, 24 px à l&apos;écran.</span>
          </div>
        </div>
      </Section>

      <Section>
        <Head eyebrow="06 · Couleurs" title="La palette MediCare Pro" />
        <div className={c.bigSw}>
          <div>
            <i style={{ "--c": "#182A45" } as CSSProperties} />
            <p>
              <b>Bleu nuit</b>
              MEDICARE, titres, fonds sombres
              <br />
              HEX #182A45 · RVB 24 42 69
              <br />
              CMJN 65 39 0 73
            </p>
          </div>
          <div>
            <i style={{ "--c": "#767E8C" } as CSSProperties} />
            <p>
              <b>Gris ardoise</b>
              Mention PRO, textes secondaires
              <br />
              HEX #767E8C · RVB 118 126 140
              <br />
              CMJN 16 10 0 45
            </p>
          </div>
        </div>
        <h3 className={c.subTitle}>Les couleurs du pictogramme, une par module</h3>
        <div className={c.sws}>
          {PALETTE.map(([name, hex, use, rgb, cmyk]) => (
            <div key={hex} className={c.sw}>
              <i style={{ "--c": hex } as CSSProperties} />
              <p>
                <b>{name}</b>
                {use}
                <br />
                {hex}
                <br />
                RVB {rgb}
                <br />
                CMJN {cmyk}
              </p>
            </div>
          ))}
        </div>
        <h3 className={c.subTitle}>Les fonds du site</h3>
        <div className={c.sws}>
          {TINTS.map(([name, hex]) => (
            <div key={hex} className={c.sw}>
              <i style={{ "--c": hex, height: 56 } as CSSProperties} />
              <p>
                <b>{name}</b>
                {hex}
              </p>
            </div>
          ))}
        </div>
        <p className={k.note}>
          Valeurs CMJN indicatives, calculées depuis le RVB : à valider avec l&apos;imprimeur (profil Fogra39
          recommandé).
        </p>
      </Section>

      <Section tint="amber" edge={5}>
        <Head eyebrow="07 · Typographies" title="Trois familles, trois rôles" />
        <div className={c.types}>
          <div className={c.type}>
            <span className={c.tag} style={{ "--t": "var(--tint-blue)", "--c": "var(--brand-blue)" } as CSSProperties}>
              Logo
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- spécimen vectorisé */}
            <img src="/brand/guides/specimen-montserrat.svg" alt="Montserrat Bold : alphabet en capitales et chiffres" />
            <p>
              <b>Montserrat Bold.</b>{" "}Réservée au logo, déjà vectorisé dans les fichiers fournis. Ne pas l&apos;employer
              pour les textes courants.
            </p>
          </div>
          <div className={c.type}>
            <span className={c.tag} style={{ "--t": "var(--tint-teal)", "--c": "var(--brand-teal-ink)" } as CSSProperties}>
              Site et documents
            </span>
            <div className={c.aa} style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}>
              Aa
            </div>
            <div className={c.alpha} style={{ fontFamily: "var(--font-body)" }}>
              Abcdefghijklmnopqrstuvwxyz
              <br />
              àâçéèêëîïôûù 0123456789
            </div>
            <p>
              <b>Poppins</b>{" "}400, 500, 600, 700. Titres et textes du site, supports commerciaux, présentations.
            </p>
          </div>
          <div className={c.type}>
            <span className={c.tag} style={{ "--t": "var(--tint-violet)", "--c": "var(--brand-violet)" } as CSSProperties}>
              Logiciel
            </span>
            <div className={c.aa} style={{ fontFamily: "var(--font-app)", fontWeight: 600 }}>
              Aa
            </div>
            <div className={c.alpha} style={{ fontFamily: "var(--font-app)" }}>
              Abcdefghijklmnopqrstuvwxyz
              <br />
              àâçéèêëîïôûù 0123456789
            </div>
            <p>
              <b>Inter</b>{" "}400 à 700. Écrans du logiciel et captures d&apos;interface.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <Head eyebrow="08 · À éviter" title="Ce qu'on ne fait jamais" />
        <div className={c.donts}>
          {DONTS.map((d) => (
            <div key={d.title} className={c.dont}>
              <div className={`${c.preview} ${d.photo ? c.onPhoto : c.onLight}`}>
                <span className={c.cross} aria-hidden="true">
                  <X />
                </span>
                {d.fake ? (
                  <span className={c.fake}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- SVG du kit */}
                    <img src={SVG("medicarepro-pictogramme")} alt="" />
                    MediCare Pro
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element -- SVG du kit */
                  <img src={SVG("medicarepro-logo-horizontal")} alt="" style={d.style} />
                )}
              </div>
              <b>{d.title}</b>
              <span>{d.text}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section tint="blue" edge={4} id="telechargements">
        <Head
          eyebrow="09 · Téléchargements"
          title="Le kit logo"
          lead="Les SVG sont vectoriels, à privilégier pour l'impression et le web. Les PNG sont sur fond transparent. Les versions « fond sombre » et « blanc » sont blanches : ouvrez-les sur un fond foncé pour les voir."
        />
        <div className={k.row} style={{ marginTop: 0, marginBottom: 28 }}>
          <Btn href="/brand/medicarepro-kit-logo.zip" size="lg" icon={<Download aria-hidden="true" />}
              download>
            Tout télécharger (ZIP, 4,9 Mo)
          </Btn>
          <Btn
            href="/brand/medicarepro-charte-graphique.pdf"
            variant="outline"
            size="lg"
            icon={<Download aria-hidden="true" />}
              download
          >
            Charte en PDF (1 Mo)
          </Btn>
        </div>
        <div className={c.tableWrap}>
          <table className={c.files}>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Fichiers</th>
              </tr>
            </thead>
            <tbody>
              {FILES.map(([file, label, , png]) => (
                <tr key={file}>
                  <td>{label}</td>
                  <td>
                    <Downloads file={file} png={png} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
