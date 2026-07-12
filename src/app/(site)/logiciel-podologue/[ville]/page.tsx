import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { after } from "next/server";
import { CtaBand } from "@/components/Sections2";
import { ArrowRight, MapPin, CheckCircle } from "@/components/icons";
import {
  getPublishedCity,
  getPublishedCities,
  getNearbyCities,
} from "@/lib/cms/cities";
import { getPageSections, pick } from "@/lib/cms/pages";
import { isPermanent, resolveRedirect } from "@/lib/cms/redirects";
import { recordRedirectHit } from "@/lib/cms/seo-log";
import v from "@/components/city.module.css";

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

  const [nearby, aProposSections] = await Promise.all([
    getNearbyCities(ville),
    getPageSections("/a-propos"),
  ]);
  const cta = pick(aProposSections, "cta_band", "cta_band");

  /* JSON-LD : Service (areaServed = la ville) + FAQPage. Pas de
     LocalBusiness (MediCare Pro n'a pas d'établissement dans la ville). */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: `Logiciel de gestion de cabinet ${city.nameLocative}`,
        serviceType: "Logiciel de gestion pour pédicures-podologues",
        provider: { "@type": "Organization", name: "MediCare Pro" },
        areaServed: { "@type": "City", name: city.name },
        url: `${SITE_URL}/logiciel-podologue/${city.slug}`,
      },
      city.faq.length > 0
        ? {
            "@type": "FAQPage",
            mainEntity: city.faq.map((item) => ({
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={v.hero}>
        <div className="wrap">
          <span className={v.kicker}>
            <MapPin width={14} height={14} /> {city.deptName} · {city.region}
          </span>
          <h1 className={v.title}>{city.h1}</h1>
          <p className={v.intro}>{city.content.intro}</p>
          <Link href="/tarifs" className={v.cta}>
            Découvrir l&apos;offre <ArrowRight width={16} height={16} />
          </Link>
        </div>
      </section>

      <article className="wrap">
        <div className={v.body}>
          <section>
            <h2>Un logiciel pensé pour les podologues {city.nameLocative}</h2>
            <p>{city.content.contexte_local}</p>
          </section>
          <section>
            <h2>Ce que MediCare Pro change au quotidien</h2>
            <p>{city.content.benefices}</p>
            <ul className={v.benefits}>
              <li>
                <CheckCircle width={17} height={17} /> Dossiers patients et 13
                bilans podologiques normés
              </li>
              <li>
                <CheckCircle width={17} height={17} /> Facturation et
                comptabilité automatisées
              </li>
              <li>
                <CheckCircle width={17} height={17} /> Hébergement HDS en France,
                conforme RGPD
              </li>
            </ul>
          </section>

          {city.faq.length > 0 && (
            <section className={v.faq}>
              <h2>Questions fréquentes</h2>
              {city.faq.map((item, i) => (
                <details key={i}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </section>
          )}
        </div>

        {nearby.length > 0 && (
          <nav className={v.nearby} aria-label="Villes proches">
            <h2>MediCare Pro dans les villes proches</h2>
            <div className={v.nearbyGrid}>
              {nearby.map((n) => (
                <Link
                  key={n.slug}
                  href={`/logiciel-podologue/${n.slug}`}
                  className={v.nearbyLink}
                >
                  <MapPin width={14} height={14} /> {n.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </article>

      <CtaBand content={cta} />
    </>
  );
}
