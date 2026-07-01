import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SideTabs from "@/components/SideTabs";
import ScrollEffects from "@/components/ScrollEffects";
import SmoothScroll from "@/components/motion/SmoothScroll";

/** Layout de l'espace public (vitrine) : header + footer partagés. */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <SideTabs />
      <main>{children}</main>
      <Footer />
      <ScrollEffects />
      <SmoothScroll />
    </>
  );
}
