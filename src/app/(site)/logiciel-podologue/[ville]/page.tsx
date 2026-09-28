import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { after } from "next/server";
import { ChevronRight } from "@/components/icons";
import {
  BtnRow,
  Crumb,
  CrumbJsonLd,
  HeroGrid,
  Section,
  Split,
  Sub,
  Text,
  Title,
} from "@/components/site/Kit";
import { CtaBlock, FaqBlock } from "@/components/site/Blocks";
import { PhotoFrame } from "@/components/site/Visuals";
import CityFigures from "@/components/site/CityFigures";
import { getPublishedCity, getPublishedCities, getNearbyCities } from "@/lib/cms/cities";
import { cityLabel, regionAnchor, RPPS_DATASET_URL } from "@/lib/cms/city-data";
import { fold } from "@/lib/ai/city-quality";
import { JSONLD_ORG } from "@/data/content/site";
import { getPageSections, pick } from "@/lib/cms/pages";
import { isPermanent, resolveRedirect } from "@/lib/cms/redirects";
import { recordRedirectHit } from "@/lib/cms/seo-log";
import s from "@/components/site/city.module.css";

type Params = { ville: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://medicarepro.fr";

export async function generateStaticParams(): Promise<Params[]> {
  const cities = await getPublishedCities();
  return cities.map((c) => ({ ville: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { ville } = await params;
  const city = await getPublishedCity(ville);
  if (!city) return {};
  return {
    title: { absolute: city.seoTitle },
    description: city.seoDescription,
    alternates: { canonical: `/logiciel-podologue/${city.slug}` },
    openGraph: { title: city.seoTitle, description: city.seoDescription },
  };
}

export default async function VillePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { ville } = await params;
  const city = await getPublishedCity(ville);

  if (!city) {
    /* Slug renommé / dépublié ? Redirection gérée si elle existe. */
    const managed = await resolveRedirect(`/logiciel-podologue/${ville}`);
    if (managed) {
      after(() => recordRedirectHit(managed.id));
      if (isPermanent(managed)) permanentRedirect(managed.to_path);
      redirect(managed.to_path);
    }
    notFound();
  }

  const [nearby, all, aProposSections] = await Promise.all([
    getNearbyCities(ville),
    getPublishedCities(),
    getPageSections("/a-propos"),
  ]);
  const cta = pick(aProposSections, "cta_band", "cta_band");
  const sameRegion = all.filter((c) => c.region === city.region && c.slug !== city.slug).slice(0, 6);

  const url = `${SITE_URL}/logiciel-podologue/${city.slug}`;
  const label = cityLabel(city.name, city.deptCode, city.localData?.homonyme);
  const crumbs = [
    { label: "Accueil", href: "/" },
    { label: "Partout en France", href: "/logiciel-podologue" },
    { label: city.region, href: `/logiciel-podologue#${regionAnchor(city.region)}` },
    { label, href: `/logiciel-podologue/${city.slug}` },
  ];

  /* Questions balisées : seulement celles qui citent la ville. Les questions
     génériques (hébergement, mise en route…) reviennent d'une page à l'autre,
     et Google demande de ne baliser qu'une fois une FAQ répétée sur un site. */
  const localFaq = city.faq.filter((item) => fold(item.q).includes(fold(city.name)));

  /* JSON-LD : page (date, source des chiffres) + Service rattaché à
     l'entreprise (même @id que le JSON-LD global) + FAQPage locale. Pas de
     LocalBusiness (MediCare Pro n'a pas d'établissement dans la ville). */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name: city.seoTitle,
        description: city.seoDescription,
        inLanguage: "fr-FR",
        dateModified: city.updatedAt,
        publisher: { "@id": JSONLD_ORG["@id"] },
        about: { "@id": `${url}#service` },
        ...(city.localData
          ? {
              citation: {
                "@type": "Dataset",
                name: "Annuaire Santé : extractions des données en libre accès (RPPS)",
                url: RPPS_DATASET_URL,
                creator: { "@type": "Organization", name: "Agence du Numérique en Santé" },
              },
            }
          : {}),
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `Logiciel de gestion de cabinet pour podologues ${city.nameLocative}`,
        serviceType: "Logiciel de gestion pour pédicures-podologues",
        provider: { "@id": JSONLD_ORG["@id"] },
        areaServed: {
          "@type": "City",
          name: label,
          containedInPlace: { "@type": "AdministrativeArea", name: city.deptName },
        },
        url,
      },
      localFaq.length > 0
        ? {
            "@type": "FAQPage",
            "@id": `${url}#faq`,
            mainEntity: localFaq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }
        : null,
    ].filter(Boolean),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Section hero>
        <HeroGrid
          visual={
            <PhotoFrame
              src="/images/fonctionnalites/podologue-medicarepro-section-hero.jpg"
              alt="Une pédicure-podologue examine le pied d'un patient"
              variant={1}
              position="20% 50%"
              priority
            />
          }
        >
          <Crumb items={crumbs} />
          <CrumbJsonLd items={crumbs} />
          <Title as="h1">{city.h1}</Title>
          <Sub>{`${city.deptName} · ${city.region}`}</Sub>
          <div style={{ marginTop: 18 }}>
            <Text>{city.content.intro}</Text>
          </div>
          <BtnRow
            links={[
              { label: "Demander une démo", href: "/contact" },
              { label: "Voir les tarifs", href: "/tarifs" },
            ]}
          />
        </HeroGrid>
      </Section>

      <Section tint="violet" edge={1}>
        <Split
          reverse
          visual={
            city.localData ? (
              <CityFigures data={city.localData} nameLocative={city.nameLocative} />
            ) : (
              <PhotoFrame
                src="/images/fonctionnalites/podologue-medicarepro-section-3.jpg"
                alt="Soin du pied en cabinet de podologie"
                variant={0}
              />
            )
          }
          title={`Un logiciel pensé pour les podologues ${city.nameLocative}`}
          text={city.content.contexte_local}
        />
      </Section>

      <Section>
        <Split
          visual={
            <PhotoFrame
              src="/images/fonctionnalites/podologue-medicarepro-section-2.jpg"
              alt="Une praticienne soigne le pied d'une patiente"
              variant={3}
            />
          }
          title={`Ce que MediCare Pro change pour un cabinet ${city.nameLocative}`}
          text={city.content.benefices}
          items={[
            "**Dossiers patients et 13 bilans podologiques normés**, scores calculés automatiquement.",
            "**Facturation et comptabilité automatisées**, carte Vitale intégrée.",
            "**Hébergement HDS en France**, conforme RGPD.",
          ]}
          cta={{ label: "Découvrir les bilans", href: "/bilans" }}
        />
      </Section>

      {city.faq.length > 0 && (
        <Section tint="blue" edge={5}>
          <FaqBlock title={`Cabinets ${city.nameLocative} : vos questions`} items={city.faq} />
        </Section>
      )}

      <Section tight>
        <div className={s.near}>
          {nearby.length > 0 && (
            <nav aria-label="Villes proches">
              <h2>Villes proches</h2>
              <ul>
                {nearby.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/logiciel-podologue/${n.slug}`}>
                      {n.name} <ChevronRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {sameRegion.length > 0 && (
            <nav aria-label={`Autres villes, ${city.region}`}>
              <h2>{city.region}</h2>
              <ul>
                {sameRegion.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/logiciel-podologue/${n.slug}`}>
                      {n.name} <ChevronRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <nav aria-label="Pour aller plus loin">
            <h2>Pour aller plus loin</h2>
            <ul>
              {[
                { label: "Partout en France", href: "/logiciel-podologue" },
                { label: "Bilans podologiques", href: "/bilans" },
                { label: "Tarifs", href: "/tarifs" },
                { label: "Sécurité et HDS", href: "/securite" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>
                    {l.label} <ChevronRight aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Section>

      <Section tight>
        <CtaBlock
          title={cta.title}
          lead={cta.text}
          primary={cta.cta}
          secondary={{ label: "Demander une démo", href: "/contact" }}
        />
      </Section>
    </>
  );
}
