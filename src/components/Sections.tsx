import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle,
  Grid,
  ShieldCheck,
  Lock,
  Clock,
  Check,
  FileText,
  Signature,
  Calculator,
  Calendar,
  Smartphone,
  Invoice,
  BadgeCheck,
  Shield,
  Refresh,
  ArrowRight,
} from "./icons";
import s from "./sections.module.css";

/** Niveau de titre d'une section : h1 quand la section est le sujet de la
 *  page (un seul par page), h2 sinon (teaser sur la home, sous-section). */
type Heading = "h1" | "h2";

/** Tonalité de fond de la section, pilotée par la page (alternance
 *  blanc ↔ bleu clair ↔ bleu moyen). "white" par défaut. */
type Tone = "white" | "soft" | "medium";

/** Props communes aux sections « piliers » réutilisables. */
type PillarProps = {
  /** Niveau du titre principal. Défaut h2. */
  as?: Heading;
  /** Affiche un lien « En savoir plus → » vers la page dédiée (teaser home). */
  teaserHref?: string;
  /** Tonalité de fond (alternance pilotée par la page). Défaut "white". */
  tone?: Tone;
};

/** Classe de tonalité à concaténer sur la <section>. */
function toneClass(tone: Tone = "white") {
  if (tone === "soft") return "tone-soft";
  if (tone === "medium") return "tone-medium";
  return "tone-white";
}

/** Lien « En savoir plus → » optionnel, rendu sous une section teaser. */
function LearnMore({ href }: { href?: string }) {
  if (!href) return null;
  return (
    <div style={{ textAlign: "center" }}>
      <Link href={href} className="learn-more">
        En savoir plus <ArrowRight width={16} height={16} />
      </Link>
    </div>
  );
}

/** Rangée de liens internes entre pages connexes (maillage SEO). */
export function CrossLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  return (
    <nav className="cross-links" aria-label="Pages liées">
      {links.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label} <ArrowRight width={15} height={15} />
        </Link>
      ))}
    </nav>
  );
}

/* ---------------- PAGE HERO ---------------- */
/** Bandeau hero des pages intérieures : fond dégradé + h1 unique + lead.
 *  Réutilise les utilitaires globaux .sec-head / .kicker / .sec-title. */
export function PageHero({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead: string;
}) {
  return (
    <section className="page-hero">
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">{kicker}</div>
          <h1 className="sec-title">{title}</h1>
          <p className="lead">{lead}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- VALUES ---------------- */
const VALUES = [
  {
    icon: CheckCircle,
    title: "Simplicité",
    text: "Une prise en main immédiate, sans formation.",
  },
  {
    icon: Grid,
    title: "Tout-en-un",
    text: "Patients, factures, compta, agenda : un seul outil.",
  },
  {
    icon: ShieldCheck,
    title: "Conformité",
    text: "RGPD et données de santé hébergées en HDS.",
  },
  {
    icon: Lock,
    title: "Sécurité",
    text: "Chiffrement complet, authentification forte.",
  },
  {
    icon: Clock,
    title: "Gain de temps",
    text: "Facturation et bilans automatisés.",
  },
];

export function Values({ as = "h2", teaserHref, tone }: PillarProps) {
  const H = as;
  return (
    <section className={`${s.values} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">Nos engagements</div>
          <H className="sec-title">Pensé pour votre quotidien</H>
        </div>
        <div className={s.valuesGrid}>
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div className={s.value} key={title} data-rv-value>
              <div className={s.vico}>
                <Icon width={34} height={34} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <LearnMore href={teaserHref} />
      </div>
    </section>
  );
}

/* ---------------- ABOUT ---------------- */
const ABOUT_POINTS = [
  "Dossiers patients complets",
  "Consultations détaillées",
  "Facturation automatisée",
  "Signature électronique",
  "Comptabilité intégrée",
  "Multi-cabinet",
];

export function About({ as = "h2", teaserHref, tone }: PillarProps) {
  const H = as;
  return (
    <section className={`${s.about} ${toneClass(tone)}`}>
      <div className={`wrap ${s.aboutGrid}`}>
        <div className={`${s.photo} ${s.aboutPhoto}`} data-rv-aboutphoto>
          <Image
            src="/images/about-app.jpg"
            alt="Logiciel médical MediCare Pro sur ordinateur"
            fill
            sizes="(max-width: 760px) 100vw, 45vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div data-rv-abouttext>
          <div className="kicker">MediCare Pro</div>
          <H className={s.aboutTitle}>Conçu par et pour les podologues</H>
          <p className="lead">
            MediCare Pro regroupe en une seule application tout ce qu&apos;un
            cabinet de podologie utilise au quotidien. Un podologue dépense en
            moyenne 285 €/mois en outils séparés : MediCare Pro centralise tout,
            sans option payante cachée.
          </p>
          <ul className={s.checkList}>
            {ABOUT_POINTS.map((point) => (
              <li key={point}>
                <span className={s.tick}>
                  <Check width={13} height={13} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          {teaserHref && (
            <Link href={teaserHref} className="learn-more">
              En savoir plus <ArrowRight width={16} height={16} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FEATURES ---------------- */
const FEATURES = [
  { icon: FileText, title: "Bilans podologiques" },
  { icon: Signature, title: "Signature électronique" },
  { icon: Calculator, title: "Comptabilité" },
  { icon: Calendar, title: "Agenda" },
  { icon: Smartphone, title: "Application PWA" },
  { icon: Invoice, title: "Facturation auto" },
];

export function Features({
  as = "h2",
  teaserHref,
  tone,
  title = "Fonctionnalités",
}: PillarProps & { title?: string }) {
  const H = as;
  return (
    <section className={`${s.features} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className={s.featPanel}>
          <H className={s.featTitle}>{title}</H>
          <p className={s.sub}>6 fonctionnalités uniques sur le marché</p>
          <div className={s.featCards}>
            {FEATURES.map(({ icon: Icon, title }) => (
              <div className={s.featCard} key={title} data-rv-feat>
                <div className={s.fico}>
                  <Icon width={40} height={40} />
                </div>
                <h3>{title}</h3>
              </div>
            ))}
          </div>
        </div>
        <div className={s.featSpacer} />
        <LearnMore href={teaserHref} />
      </div>
    </section>
  );
}

/* ---------------- BILANS ---------------- */
const BILAN_CHIPS = [
  "Diabétique",
  "Risque de chute",
  "Posturologie",
  "Pédiatrie",
  "Vasculaire",
  "Neurologique",
];

export function Bilans({ as = "h2", tone }: PillarProps) {
  const H = as;
  return (
    <section className={`${s.bilans} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className={s.bilansInner} data-rv-bilans>
          <div>
            <div className="kicker">Bilans</div>
            <H className={s.bilansTitle}>
              Des bilans normés, des scores calculés automatiquement
            </H>
            <p>
              Saisissez vos bilans et laissez l&apos;application calculer les
              scores. Gagnez du temps tout en sécurisant votre suivi.
            </p>
          </div>
          <div className={s.chips}>
            {BILAN_CHIPS.map((chip) => (
              <span className={s.chip} key={chip} data-rv-chip>
                <span className={s.dot} />
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- CERTIFICATIONS ---------------- */
const CERTS = [
  { icon: BadgeCheck, title: "Hébergement HDS en France" },
  { icon: Shield, title: "Conformité RGPD" },
  { icon: Lock, title: "Chiffrement & authentification forte" },
  { icon: Refresh, title: "Sauvegardes quotidiennes" },
];

export function Certifications({ as = "h2", tone }: PillarProps) {
  const H = as;
  return (
    <section className={`${s.certs} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">Sécurité &amp; conformité</div>
          <H className="sec-title">Vos données de santé protégées</H>
        </div>
        <div className={s.certGrid}>
          {CERTS.map(({ icon: Icon, title }) => (
            <div className={s.cert} key={title} data-rv-cert>
              <div className={s.badge}>
                <Icon width={28} height={28} />
              </div>
              <h3>{title}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
