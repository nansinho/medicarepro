import { BtnRow, Section, Sub, Text, Title } from "@/components/site/Kit";
import { LinksRow } from "@/components/site/Blocks";

/* Page introuvable, dans l'habillage de la vitrine (en-tête et pied de page). */
export default function NotFound() {
  return (
    <>
      <Section hero center tint="white" edge={1}>
        <Title as="h1">Cette page est introuvable</Title>
        <Sub>Elle a peut-être changé d&apos;adresse.</Sub>
        <div style={{ marginTop: 18 }}>
          <Text>Revenez à l&apos;accueil ou choisissez une rubrique ci-dessous.</Text>
        </div>
        <BtnRow
          links={[
            { label: "Retour à l'accueil", href: "/" },
            { label: "Nous contacter", href: "/contact" },
          ]}
        />
      </Section>
      <Section tint="teal" tight>
        <LinksRow
          links={[
            { label: "Fonctionnalités", href: "/fonctionnalites" },
            { label: "Bilans podologiques", href: "/bilans" },
            { label: "Tarifs", href: "/tarifs" },
            { label: "Blog", href: "/blog" },
          ]}
        />
      </Section>
    </>
  );
}
