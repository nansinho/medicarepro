import type { Metadata } from "next";
import Link from "next/link";
import { Crumb, CrumbJsonLd, HeroGrid, Head, Section, Split, Sub, Text, Title } from "@/components/site/Kit";
import { OfferBlock } from "@/components/site/Blocks";
import { PhotoFrame } from "@/components/site/Visuals";
import CitySearch from "@/components/site/CitySearch";
import { getPublishedCities, type CityListItem } from "@/lib/cms/cities";
import { regionAnchor } from "@/lib/cms/city-data";
import { getPageSections, pick } from "@/lib/cms/pages";
import s from "@/components/site/city.module.css";

export const metadata: Metadata = {
  /* Pas « logiciel podologue » en tête : c'est la cible de l'accueil. Le hub
     vise la recherche par ville, chaque ville visant « logiciel podologue + ville ». */
  title: { absolute: "Partout en France : MediCare Pro ville par ville" },
  description:
    "MediCare Pro, le logiciel de gestion de cabinet des pédicures-podologues, partout en France et en outre-mer. Trouvez la page de votre ville.",
  alternates: { canonical: "/logiciel-podologue" },
};

/* Hub des pages locales : recherche, puis les villes publiées par région. */
export default async function LogicielPodologueHub() {
  const [cities, home] = await Promise.all([getPublishedCities(), getPageSections("/")]);
  const offer = pick(home, "offer", "offer_band");

  const byRegion = new Map<string, CityListItem[]>();
  for (const city of cities) {
    const list = byRegion.get(city.region) ?? [];
    list.push(city);
    byRegion.set(city.region, list);
  }
  const regions = [...byRegion.keys()].sort((a, b) => a.localeCompare(b, "fr"));
  const crumbs = [
    { label: "Accueil", href: "/" },
    { label: "Partout en France", href: "/logiciel-podologue" },
  ];

  return (
    <>
      <Section hero>
        <HeroGrid
          visual={
            <PhotoFrame
              src="/images/bilans-hero-pieds.jpg"
              alt="Une praticienne tient les pieds d'un patient"
              variant={2}
              position="50% 35%"
              priority
            />
          }
        >
          <Crumb items={crumbs} />
          <CrumbJsonLd items={crumbs} />
          <Title as="h1">MediCare Pro, partout en France</Title>
          <Sub>De Lille à Marseille, et en outre-mer.</Sub>
          <div style={{ marginTop: 18 }}>
            <Text>
              Le logiciel des pédicures-podologues fonctionne entièrement en ligne : où que soit votre cabinet,
              la mise en route se fait à distance, avec vos données hébergées en France.
            </Text>
          </div>
          <CitySearch cities={cities} />
        </HeroGrid>
      </Section>

      {regions.length > 0 ? (
        <Section tint="violet" edge={0} center>
          <Head eyebrow="Par région" title="Choisissez votre région" centered />
          <div className={s.regions}>
            {regions.map((region) => {
              const list = byRegion.get(region) ?? [];
              return (
                <section key={region} id={regionAnchor(region)} className={s.region}>
                  <h3>
                    {region}
                    <small>
                      {list.length} {list.length > 1 ? "villes" : "ville"}
                    </small>
                  </h3>
                  <div className={s.chips}>
                    {list.map((city) => (
                      <Link key={city.slug} href={`/logiciel-podologue/${city.slug}`}>
                        {city.name}
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section tint={regions.length > 0 ? "white" : "violet"} edge={regions.length > 0 ? undefined : 0}>
        <Split
          reverse
          visual={
            <PhotoFrame
              src="/images/fonctionnalites/podologue-medicarepro-section-3.jpg"
              alt="Soin du pied en cabinet de podologie"
              variant={4}
            />
          }
          title="Un logiciel 100 % en ligne, où que soit votre cabinet"
          text="Métropole ou outre-mer, en ville ou à la campagne, au cabinet comme à domicile : MediCare Pro vous accompagne de la même façon."
          items={[
            "**Mise en route à distance**, avec la reprise de vos données.",
            "**Hébergement certifié HDS** en France, chez OVHcloud.",
            "**Support 7j/7** par chat pour les abonnés.",
            "**Sur ordinateur, tablette et smartphone**, même en tournée à domicile.",
          ]}
          cta={{ label: "Demander une démo", href: "/contact" }}
        />
      </Section>

      <Section tight>
        <OfferBlock content={offer} />
      </Section>
    </>
  );
}
