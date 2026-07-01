import type { Metadata } from "next";
import Link from "next/link";
import SecurityHero from "@/components/SecurityHero";
import SecurityShowcase from "@/components/SecurityShowcase";
import type { SecuritySection } from "@/components/SecurityShowcase";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import TiltCard from "@/components/motion/TiltCard";
import CountUp from "@/components/motion/CountUp";
import {
  Server,
  OvhLogo,
  BadgeCheck,
  Globe,
  Key,
  Refresh,
  FileText,
  CheckCircle,
  Check,
  ArrowRight,
} from "@/components/icons";
import f from "@/components/featureShowcase.module.css";
import sec from "@/components/security.module.css";

export const metadata: Metadata = {
  title: "Sécurité et conformité des données de santé",
  description:
    "Vos données patients protégées au plus haut niveau : hébergement HDS chez OVHcloud dans des datacenters en France, conformité RGPD, chiffrement de bout en bout, authentification forte et sauvegardes quotidiennes.",
  alternates: { canonical: "/securite" },
};

/* Les 4 sections immersives, alternées gauche/droite, 2 « vedettes » foncées.
   `icon`/`logo` sont des CLÉS (string) : une page Server Component ne peut pas
   passer de composant en prop à un Client Component → résolu dans SecurityShowcase. */
const SECTIONS: SecuritySection[] = [
  {
    icon: "Server",
    kicker: "Infrastructure",
    title: "Hébergement HDS en France",
    text: "Vos données de santé sont hébergées chez un prestataire certifié Hébergeur de Données de Santé (HDS), exclusivement sur le territoire français. Aucune donnée patient ne quitte la France.",
    points: [
      "Certification HDS conforme à l'article L.1111-8 du Code de la santé publique",
      "Datacenters situés sur le sol français",
      "Redondance et haute disponibilité de l'infrastructure",
      "Isolation stricte des environnements de production",
    ],
    image: "/images/securite/podologue-medicarepro-servers-section1.jpg",
    alt: "Baies de serveurs hébergeant les données de santé MediCare Pro",
    tone: "white",
    reverse: false,
  },
  {
    icon: "Globe",
    kicker: "Hébergeur",
    title: "Hébergé chez OVHcloud, datacenters en France",
    text: "Nous nous appuyons sur OVHcloud, leader européen du cloud et hébergeur certifié HDS. Vos données patients sont stockées dans ses datacenters français, sous souveraineté européenne — à l'abri des législations extra-européennes.",
    points: [
      "OVHcloud : hébergeur certifié HDS et souveraineté européenne",
      "Datacenters Tier III+ en France, sécurisés 24h/24",
      "Aucune dépendance au Cloud Act américain",
      "Engagement de réversibilité de vos données",
    ],
    image: "/images/securite/podologue-medicarepro-servers-section2.jpg",
    alt: "Couloir de datacenter OVHcloud hébergeant MediCare Pro",
    tone: "dark",
    reverse: true,
  },
  {
    icon: "Lock",
    kicker: "Chiffrement",
    title: "Chiffrement de bout en bout",
    text: "Vos données sont chiffrées en transit et au repos. Les communications passent par des canaux TLS et le stockage est protégé par un chiffrement AES robuste : même en cas d'accès physique, les données restent illisibles.",
    points: [
      "Chiffrement AES-256 des données au repos",
      "Connexions chiffrées TLS 1.3 de bout en bout",
      "Authentification forte pour bloquer tout accès non autorisé",
      "Cloisonnement des accès par rôle (podologue, cabinet)",
    ],
    image: "/images/securite/podologue-medicarepro-servers-section3.jpg",
    alt: "Flux de données chiffrées illustré par du code binaire",
    tone: "soft",
    reverse: false,
  },
  {
    icon: "Shield",
    kicker: "Conformité",
    title: "Conformité RGPD & droits des patients",
    text: "Le traitement de vos données respecte le Règlement Général sur la Protection des Données : finalités déclarées, minimisation, consentement et respect intégral des droits des patients. Vous restez maître de vos données.",
    points: [
      "Finalités de traitement déclarées et limitées",
      "Droit d'accès, de rectification et d'effacement garantis",
      "Registre des traitements tenu à jour",
      "Sous-traitants conformes RGPD et localisés en Europe",
    ],
    image: "/images/securite/podologue-medicarepro-servers-section4.jpg",
    alt: "Conformité RGPD et souveraineté des données européennes",
    tone: "dark",
    reverse: true,
  },
];

/* Garanties chiffrées (compteurs animés). */
const GUARANTEES = [
  {
    icon: Server,
    to: 99.9,
    decimals: 1,
    suffix: " %",
    label: "de disponibilité garantie",
  },
  {
    icon: Key,
    to: 256,
    suffix: " bits",
    label: "de chiffrement AES des données",
  },
  {
    icon: Refresh,
    to: 24,
    suffix: " h",
    label: "fréquence des sauvegardes",
  },
  {
    icon: Globe,
    to: 100,
    suffix: " %",
    label: "des données hébergées en France",
  },
];

/* Cartes portail vers les pages connexes. */
const HUB = [
  {
    icon: FileText,
    title: "Toutes les fonctionnalités",
    text: "Facturation, signature, comptabilité, agenda, bilans et application mobile — tout votre cabinet réuni.",
    href: "/fonctionnalites",
  },
  {
    icon: CheckCircle,
    title: "Tarifs tout inclus",
    text: "Un seul abonnement, sans option cachée. Sécurité, mises à jour et support compris.",
    href: "/tarifs",
  },
  {
    icon: BadgeCheck,
    title: "Les 13 bilans podologiques",
    text: "Des bilans normés avec scores calculés automatiquement, pour un suivi patient sécurisé.",
    href: "/bilans",
  },
];

export default function SecuritePage() {
  return (
    <>
      <SecurityHero />

      {/* 4 sections immersives (photos serveurs), alternées + 2 vedettes foncées */}
      {SECTIONS.map((section) => (
        <SecurityShowcase key={section.title} {...section} />
      ))}

      {/* Bande de garanties — bandeau foncé immersif avec compteurs animés */}
      <section className={`${f.statBand} ${f.statDark}`}>
        <div className={`wrap ${f.statInner}`}>
          <Reveal className={f.statHead}>
            <div className={f.statKicker}>Nos garanties</div>
            <h2 className={f.statTitle}>
              La sécurité, mesurée et garantie
            </h2>
          </Reveal>
          <StaggerGroup className={f.statGrid}>
            {GUARANTEES.map(({ icon: Icon, ...stat }) => (
              <StaggerItem key={stat.label} className={f.stat} variant="up">
                <span className={f.statIco}>
                  <Icon width={22} height={22} />
                </span>
                <b>
                  <CountUp
                    to={stat.to}
                    decimals={stat.decimals ?? 0}
                    suffix={stat.suffix}
                  />
                </b>
                <span className={f.statLabel}>{stat.label}</span>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Bande hébergeur — mise en avant du logo OVHcloud */}
      <section className={`${sec.host} tone-soft`}>
        <div className="wrap">
          <div className={sec.hostInner}>
            <Reveal variant="left" className={sec.hostLogoCard}>
              <OvhLogo className={sec.hostLogo} />
              <span className={sec.hostLogoCaption}>
                Hébergeur certifié HDS
              </span>
            </Reveal>
            <Reveal variant="right" className={sec.hostBody}>
              <div className={sec.hostKicker}>Infrastructure de confiance</div>
              <h2 className={sec.hostTitle}>
                Un hébergement souverain, en qui vous pouvez avoir confiance
              </h2>
              <p className={sec.hostText}>
                MediCare Pro s&apos;appuie sur OVHcloud, leader européen du cloud
                et acteur reconnu de l&apos;hébergement de données de santé. Vos
                données patients restent en France, sous protection européenne.
              </p>
              <ul className={sec.hostPoints}>
                {[
                  "Hébergeur agréé pour les données de santé (HDS)",
                  "Souveraineté européenne — hors Cloud Act",
                  "Datacenters français sécurisés en continu",
                ].map((point) => (
                  <li key={point}>
                    <span className={sec.hostTick}>
                      <Check width={13} height={13} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Grandes cartes immersives vers les pages connexes */}
      <section className={`${f.portalSec} tone-white`}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="kicker">Aller plus loin</div>
            <h2 className="sec-title">Découvrir MediCare Pro</h2>
          </Reveal>
          <StaggerGroup className={f.portalGrid}>
            {HUB.map(({ icon: Icon, title, text, href }) => (
              <StaggerItem key={href} variant="up">
                <TiltCard className={f.portalCard}>
                  <Link href={href} className={f.portalLink}>
                    <div className={f.portalIco}>
                      <Icon width={30} height={30} />
                    </div>
                    <h3 className={f.portalTitle}>{title}</h3>
                    <p className={f.portalText}>{text}</p>
                    <span className={f.portalMore}>
                      Découvrir <ArrowRight width={16} height={16} />
                    </span>
                  </Link>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* CTA final spectaculaire */}
      <SecuriteCta />
    </>
  );
}

/* CTA spectaculaire de fin de page Sécurité. */
function SecuriteCta() {
  return (
    <section className={f.ctaSec}>
      <div className="wrap">
        <Reveal variant="scale" className={f.ctaPanel}>
          <div className={f.ctaGlow} />
          <div className={f.ctaContent}>
            <div className={f.ctaKicker}>Vos patients méritent le meilleur</div>
            <h2 className={f.ctaTitle}>
              Vos données patients, entre de bonnes mains
            </h2>
            <p className={f.ctaLead}>
              Hébergement HDS en France, chiffrement de bout en bout et
              conformité RGPD — tout est inclus, à partir de 24,84 €/mois.
            </p>
            <div className={f.ctaActions}>
              <Link href="/register?plan=annual" className={f.ctaBtnPrimary}>
                Je m&apos;abonne <ArrowRight width={18} height={18} />
              </Link>
              <Link href="/contact" className={f.ctaBtnGhost}>
                Demander une démo
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
