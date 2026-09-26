import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import SitePromo from "@/components/site/SitePromo";
import SocialRail from "@/components/site/SocialRail";
import ScrollEffects from "@/components/ScrollEffects";
import { getMenu } from "@/lib/cms/collections";
import { getSettings } from "@/lib/cms/settings";
import { getPublishedCities } from "@/lib/cms/cities";
import { SETTINGS } from "@/data/content/site";
import c from "@/components/site/chrome.module.css";

/** Layout de l'espace public (vitrine) : bandeau promo, en-tête et pied de
 *  page partagés, alimentés par les menus et réglages du CMS. */
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [nav, settings, cities] = await Promise.all([
    getMenu("header"),
    getSettings(),
    getPublishedCities(),
  ]);
  /* Réseaux du back office, complétés par ceux du code que la base n'a pas
     encore (YouTube : l'ancien site en ligne ne connaît pas son icône, on ne
     peut l'écrire en base qu'après la mise en ligne de la refonte).
     Un réseau sans adresse réelle ("#") n'est pas affiché. */
  const socials = [
    ...settings.socials,
    ...SETTINGS.socials.filter((s) => !settings.socials.some((d) => d.icon === s.icon)),
  ].filter((s) => /^https?:\/\//.test(s.href));

  return (
    <div className={c.site}>
      <SitePromo promo={settings.promoBanner} />
      <SiteHeader nav={nav} header={settings.header} contact={settings.contact} />
      <main>{children}</main>
      <SiteFooter
        footer={settings.footer}
        contact={settings.contact}
        socials={socials}
        cities={cities}
      />
      <SocialRail socials={socials} />
      <ScrollEffects />
    </div>
  );
}
