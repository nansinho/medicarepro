import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "@/components/icons";
import { getPublishedCities } from "@/lib/cms/cities";
import v from "@/components/city.module.css";

export const metadata: Metadata = {
  title: "Logiciel podologue par ville",
  description:
    "MediCare Pro, le logiciel de gestion de cabinet pour pédicures-podologues, partout en France. Trouvez la page de votre ville.",
  alternates: { canonical: "/logiciel-podologue" },
};

/* Hub des pages villes : liste les villes publiées, groupées par région. */
export default async function LogicielPodologueHub() {
  const cities = await getPublishedCities();

  const byRegion = new Map<string, typeof cities>();
  for (const city of cities) {
    const list = byRegion.get(city.region) ?? [];
    list.push(city);
    byRegion.set(city.region, list);
  }
  const regions = [...byRegion.keys()].sort();

  return (
    <>
      <section className={v.hero}>
        <div className="wrap">
          <span className={v.kicker}>
            <MapPin width={14} height={14} /> Partout en France
          </span>
          <h1 className={v.title}>Le logiciel des podologues, près de chez vous</h1>
          <p className={v.intro}>
            MediCare Pro équipe les cabinets de pédicurie-podologie dans toute la
            France. Retrouvez la page dédiée à votre ville.
          </p>
        </div>
      </section>

      <div className="wrap">
        {cities.length === 0 ? (
          <p className={v.body}>
            Les pages locales arrivent bientôt. En attendant, découvrez{" "}
            <Link href="/fonctionnalites">les fonctionnalités</Link> de MediCare
            Pro.
          </p>
        ) : (
          <div className={v.hubRegions}>
            {regions.map((region) => (
              <section key={region}>
                <h2>{region}</h2>
                <div className={v.nearbyGrid}>
                  {byRegion.get(region)!.map((city) => (
                    <Link
                      key={city.slug}
                      href={`/logiciel-podologue/${city.slug}`}
                      className={v.nearbyLink}
                    >
                      <MapPin width={14} height={14} /> {city.name}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
