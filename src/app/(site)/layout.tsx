import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PromoBanner from "@/components/PromoBanner";
import SideTabs from "@/components/SideTabs";
import ScrollEffects from "@/components/ScrollEffects";
import SmoothScroll from "@/components/motion/SmoothScroll";
import { getMenu } from "@/lib/cms/collections";
import { getSettings } from "@/lib/cms/settings";

/** Layout de l'espace public (vitrine) : header + footer partagés,
 *  alimentés par les menus et réglages du CMS. */
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [nav, footerProduct, footerResources, settings] = await Promise.all([
    getMenu("header"),
    getMenu("footer_product"),
    getMenu("footer_resources"),
    getSettings(),
  ]);

  return (
    <>
      <PromoBanner promo={settings.promoBanner} />
      <Header nav={nav} header={settings.header} contact={settings.contact} />
      <SideTabs tabs={settings.sideTabs} loginLabel={settings.header.loginLabel} />
      <main>{children}</main>
      <Footer
        product={footerProduct}
        resources={footerResources}
        footer={settings.footer}
        contact={settings.contact}
        socials={settings.socials}
      />
      <ScrollEffects />
      <SmoothScroll />
    </>
  );
}
