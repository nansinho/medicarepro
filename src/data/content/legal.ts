/**
 * Contenu des 3 pages légales (/cgu, /mentions-legales, /confidentialite) —
 * extraction 1:1 des JSX de src/app/(site)/{cgu,mentions-legales,confidentialite}/page.tsx,
 * convertis en documents Tiptap JSON (headings niveau 2, paragraphes, listes à
 * puces, liens, gras). Les marqueurs [À COMPLÉTER : …] sont conservés en texte
 * brut (sources : onglet Réglages > Légal du back-office, plus tard).
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

/* ---------------- Helpers de construction Tiptap ---------------- */

type TiptapMark = { type: string; attrs?: Record<string, unknown> };
type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
  content?: TiptapNode[];
  text?: string;
};

const text = (value: string, marks?: TiptapMark[]): TiptapNode => ({
  type: "text",
  ...(marks ? { marks } : {}),
  text: value,
});

const bold = (value: string): TiptapNode => text(value, [{ type: "bold" }]);

const link = (
  value: string,
  href: string,
  external = false,
): TiptapNode =>
  text(value, [
    {
      type: "link",
      attrs: external
        ? { href, target: "_blank", rel: "noopener noreferrer" }
        : { href },
    },
  ]);

const h2 = (value: string): TiptapNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
});

const p = (...content: (TiptapNode | string)[]): TiptapNode => ({
  type: "paragraph",
  content: content.map((c) => (typeof c === "string" ? text(c) : c)),
});

const ul = (...items: TiptapNode[][]): TiptapNode => ({
  type: "bulletList",
  content: items.map((content) => ({
    type: "listItem",
    content: [{ type: "paragraph", content }],
  })),
});

const doc = (...content: TiptapNode[]) => ({
  type: "doc" as const,
  content,
});

/* ---------------- /cgu ---------------- */

export const PAGE_CGU = {
  slug: "/cgu",
  title: "Conditions générales d'utilisation",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Informations légales",
        title: "Conditions générales d'utilisation",
        lead: "Les présentes conditions régissent l'utilisation du site vitrine medicarepro.fr.",
        image: {
          mediaId: null,
          path: "/images/fonctionnalites/podologue-medicarepro-section-2.jpg",
          alt: "",
        },
      },
    },
    {
      key: "body",
      type: "rich_text",
      content: {
        type: "rich_text",
        body: doc(
          h2("1. Objet"),
          p(
            "Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'utilisation du site medicarepro.fr (le « Site »), édité par [À COMPLÉTER : raison sociale]. En naviguant sur le Site, l'utilisateur accepte les présentes CGU sans réserve.",
          ),
          h2("2. Description du service"),
          p(
            "Le Site est un site vitrine présentant MediCare Pro, logiciel de gestion de cabinet destiné aux pédicures-podologues : dossiers patients, facturation, comptabilité, agenda, bilans podologiques et signature électronique. La souscription à l'abonnement et l'utilisation du logiciel s'effectuent sur l'application dédiée (app.medicarepro.fr) et sont régies par des conditions contractuelles propres, communiquées lors de l'inscription.",
          ),
          h2("3. Accès au Site"),
          p(
            "Le Site est accessible gratuitement, 24 h/24 et 7 j/7, sous réserve des opérations de maintenance et des aléas techniques. L'éditeur ne saurait être tenu responsable d'une indisponibilité temporaire du Site.",
          ),
          h2("4. Propriété intellectuelle"),
          p(
            "Tous les éléments du Site (textes, visuels, logos, marque « MediCare Pro », interfaces) sont protégés par le droit de la propriété intellectuelle et demeurent la propriété exclusive de l'éditeur. Toute reproduction non autorisée constitue une contrefaçon.",
          ),
          h2("5. Responsabilité"),
          p(
            "Les informations publiées sur le Site (dont les contenus du blog à destination des professionnels) sont fournies à titre informatif et ne constituent ni un avis médical, ni un engagement contractuel. L'éditeur s'efforce d'assurer l'exactitude des informations mais ne peut la garantir de manière absolue.",
          ),
          h2("6. Liens externes"),
          p(
            "Le Site peut contenir des liens vers des sites tiers. L'éditeur n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.",
          ),
          h2("7. Données personnelles"),
          p(
            "Les traitements de données personnelles liés au Site sont décrits dans la ",
            link("politique de confidentialité", "/confidentialite"),
            ".",
          ),
          h2("8. Droit applicable"),
          p(
            "Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou leur exécution relève, à défaut de résolution amiable, de la compétence des tribunaux français.",
          ),
          p("Dernière mise à jour : [À COMPLÉTER : date]."),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;

/* ---------------- /mentions-legales ---------------- */

export const PAGE_MENTIONS = {
  slug: "/mentions-legales",
  title: "Mentions légales",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Informations légales",
        title: "Mentions légales",
        lead: "Informations relatives à l'éditeur et à l'hébergement du site medicarepro.fr.",
        image: {
          mediaId: null,
          path: "/images/about-app.jpg",
          alt: "",
        },
      },
    },
    {
      key: "body",
      type: "rich_text",
      content: {
        type: "rich_text",
        body: doc(
          h2("Éditeur du site"),
          p(
            "Le site medicarepro.fr est édité par [À COMPLÉTER : raison sociale], [À COMPLÉTER : forme juridique] au capital de [À COMPLÉTER] €, immatriculée au RCS de [À COMPLÉTER] sous le numéro [À COMPLÉTER : SIREN/SIRET], dont le siège social est situé [À COMPLÉTER : adresse complète].",
          ),
          p(
            "Numéro de TVA intracommunautaire : [À COMPLÉTER]. Directeur de la publication : [À COMPLÉTER : nom du dirigeant].",
          ),
          p(
            "Contact : ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ".",
          ),
          h2("Hébergement"),
          p(
            "Le site est hébergé par OVHcloud (OVH SAS), 2 rue Kellermann, 59100 Roubaix, France — téléphone : 1007 — ",
            link("www.ovhcloud.com", "https://www.ovhcloud.com", true),
            ". Les données de santé traitées par l'application MediCare Pro sont hébergées en France chez un hébergeur certifié HDS (Hébergeur de Données de Santé).",
          ),
          h2("Propriété intellectuelle"),
          p(
            "L'ensemble des contenus du site (textes, visuels, logos, interfaces, marque « MediCare Pro ») est protégé par le droit de la propriété intellectuelle. Toute reproduction, représentation ou diffusion, totale ou partielle, sans autorisation écrite préalable de l'éditeur est interdite et constitue une contrefaçon sanctionnée par le Code de la propriété intellectuelle.",
          ),
          h2("Données personnelles"),
          p(
            "Les traitements de données personnelles réalisés via ce site sont décrits dans notre ",
            link("politique de confidentialité", "/confidentialite"),
            ".",
          ),
          h2("Droit applicable"),
          p(
            "Le présent site est soumis au droit français. En cas de litige, et à défaut de résolution amiable, les tribunaux français seront seuls compétents.",
          ),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;

/* ---------------- /confidentialite ---------------- */

export const PAGE_CONFIDENTIALITE = {
  slug: "/confidentialite",
  title: "Politique de confidentialité",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Informations légales",
        title: "Politique de confidentialité",
        lead: "Comment nous collectons, utilisons et protégeons vos données personnelles, conformément au RGPD.",
        image: {
          mediaId: null,
          path: "/images/securite/podologue-medicarepro-servers-section1.jpg",
          alt: "",
        },
      },
    },
    {
      key: "body",
      type: "rich_text",
      content: {
        type: "rich_text",
        body: doc(
          h2("1. Responsable du traitement"),
          p(
            "Le responsable du traitement des données collectées via le site medicarepro.fr est [À COMPLÉTER : raison sociale], [À COMPLÉTER : adresse du siège]. Contact : ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ".",
          ),
          h2("2. Données collectées sur ce site"),
          p(
            "Le site vitrine collecte uniquement les données que vous nous transmettez volontairement via le formulaire de contact / demande de démonstration : nom, adresse email, numéro de téléphone, taille du cabinet et contenu de votre message.",
          ),
          p(
            "Le site vitrine ne collecte ",
            bold("aucune donnée de santé"),
            ". Les données de santé traitées par le logiciel MediCare Pro (application app.medicarepro.fr) font l'objet d'un traitement distinct, hébergé en France chez un hébergeur certifié HDS, et décrit dans les conditions propres à l'application.",
          ),
          h2("3. Finalités et bases légales"),
          ul(
            [
              text(
                "Répondre à vos demandes de contact et de démonstration — base légale : mesures précontractuelles (art. 6.1.b RGPD).",
              ),
            ],
            [
              text(
                "Gestion de la relation commerciale et prospection auprès de professionnels — base légale : intérêt légitime (art. 6.1.f RGPD).",
              ),
            ],
          ),
          h2("4. Durées de conservation"),
          p(
            "Les données issues du formulaire de contact sont conservées au maximum 3 ans à compter du dernier échange, puis supprimées ou anonymisées.",
          ),
          h2("5. Destinataires et sous-traitants"),
          p(
            "Les données sont destinées exclusivement à l'équipe MediCare Pro. Elles sont hébergées en France par OVHcloud (OVH SAS, 2 rue Kellermann, 59100 Roubaix). Aucune donnée n'est vendue ni transférée hors de l'Union européenne.",
          ),
          h2("6. Vos droits"),
          p(
            "Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité sur vos données. Pour les exercer, écrivez-nous à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ". Vous pouvez également introduire une réclamation auprès de la CNIL (",
            link("www.cnil.fr", "https://www.cnil.fr", true),
            ").",
          ),
          h2("7. Cookies"),
          p(
            "Le site n'utilise pas de cookies publicitaires ni de traceurs tiers. Seuls des cookies techniques strictement nécessaires au fonctionnement du site peuvent être déposés ; ils ne requièrent pas de consentement. Si des outils de mesure d'audience venaient à être ajoutés, cette politique serait mise à jour et votre consentement recueilli le cas échéant.",
          ),
          h2("8. Sécurité"),
          p(
            "Nous mettons en œuvre des mesures techniques et organisationnelles adaptées : chiffrement des échanges (TLS), hébergement en France, contrôle des accès et sauvegardes régulières. Pour en savoir plus, consultez notre page ",
            link("Sécurité", "/securite"),
            ".",
          ),
          p("Dernière mise à jour : [À COMPLÉTER : date]."),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;
