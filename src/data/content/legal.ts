/**
 * Contenu des 6 pages légales (/cgu, /cgv, /mentions-legales,
 * /confidentialite, /dpa, /cookies), en documents Tiptap JSON (headings
 * niveau 2, paragraphes, listes à puces, liens, gras).
 *
 * LES PDF OFFICIELS FONT FOI : les documents contractuels sont les PDF
 * versionnés de public/legal/, référencés par src/lib/legal/registry.ts
 * (CGV v2.1, CGU v1.0, DPA v2.1, Confidentialité v2.1, Cookies v2.1 —
 * tous datés de juillet 2026). Les pages ci-dessous ne retranscrivent PAS
 * leur contenu : elles le présentent brièvement (sans valeur contractuelle)
 * et pointent vers le PDF à télécharger. Toute nouvelle version d'un
 * document passe par le registre (nouveau fichier versionné + sha256),
 * puis par la mise à jour des versions mentionnées ici.
 *
 * Identité de l'éditeur : MEDICARE PRO, SAS au capital de 1 000 €,
 * 340 chemin du plan marseillais, 13320 Bouc-Bel-Air, SIRET
 * 102 034 121 00016, RCS Aix-en-Provence 102 034 121. Les marqueurs
 * [À COMPLÉTER : …] restants (mentions légales) sont conservés en texte
 * brut (sources : onglet Réglages > Légal du back-office, plus tard).
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";
import { LEGAL_DOCUMENTS } from "@/lib/legal/registry";

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
        lead: "Les règles d'utilisation du logiciel MediCare Pro — version 1.0 (juillet 2026). Le document officiel PDF fait foi.",
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
          p(
            "Les conditions générales d'utilisation (CGU) définissent les règles d'utilisation du logiciel SaaS MediCare Pro, édité par ",
            bold("MEDICARE PRO"),
            ", SAS au capital de 1 000 € (voir les ",
            link("mentions légales", "/mentions-legales"),
            "). Annexe B du contrat SaaS, elles complètent les ",
            link("conditions générales de vente", "/cgv"),
            " et s'imposent au praticien titulaire comme à tout utilisateur auquel il donne accès (collaborateur, secrétariat).",
          ),
          p(
            "Version officielle en vigueur : ",
            bold(`Version ${LEGAL_DOCUMENTS.cgu.version} — Juillet 2026`),
            ".",
          ),
          p(
            bold("Le document officiel ci-dessous fait foi"),
            " — cette page n'en est qu'une présentation, sans valeur contractuelle : ",
            link(
              `télécharger les CGU (PDF, version ${LEGAL_DOCUMENTS.cgu.version})`,
              LEGAL_DOCUMENTS.cgu.pdfHref,
            ),
            ".",
          ),
          h2("Ce que couvre ce document"),
          ul(
            [
              text(
                "L'accès au logiciel : prérequis techniques et objectif de disponibilité de 99,5 %.",
              ),
            ],
            [
              text(
                "Les comptes et la sécurité : identifiants personnels, authentification à deux facteurs (2FA) obligatoire.",
              ),
            ],
            [
              text(
                "Les règles d'utilisation du logiciel et les usages interdits, dont les fonctionnalités d'intelligence artificielle.",
              ),
            ],
            [
              text(
                "Les données et contenus du client, et la propriété intellectuelle du logiciel.",
              ),
            ],
            [
              text(
                "La suspension d'accès, la responsabilité, l'évolution des CGU et le droit applicable.",
              ),
            ],
          ),
          p(
            "Pour toute question sur ce document, écrivez-nous à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ".",
          ),
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
            "Le site medicarepro.fr est édité par ",
            bold("MEDICARE PRO"),
            ", société par actions simplifiée (SAS) au capital de 1 000 €, immatriculée au RCS d'Aix-en-Provence sous le numéro 102 034 121 (SIRET 102 034 121 00016), dont le siège social est situé 340 chemin du plan marseillais, 13320 Bouc-Bel-Air, France.",
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
          h2("Prestataire de paiement"),
          p(
            "Paiement sécurisé par carte bancaire : Monetico Paiement (Crédit Industriel et Commercial — CIC / Euro-Information). Les reconductions d'abonnement sont opérées par le CIC sur la carte enregistrée lors de la souscription. Les données de carte bancaire sont saisies exclusivement sur les pages de paiement sécurisées de Monetico et ne transitent jamais par le site medicarepro.fr.",
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
        lead: "Comment nous protégeons vos données personnelles et de santé, conformément au RGPD — version 2.1 (juillet 2026). Le document officiel PDF fait foi.",
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
          p(
            "La politique de confidentialité décrit comment ",
            bold("MEDICARE PRO"),
            " collecte, traite, conserve et protège les données personnelles — y compris les données de santé — dans le cadre du site medicarepro.fr et du logiciel MediCare Pro, conformément au RGPD et à la loi Informatique et Libertés.",
          ),
          p(
            "Version officielle en vigueur : ",
            bold(`Version ${LEGAL_DOCUMENTS.confidentialite.version} — Juillet 2026`),
            ".",
          ),
          p(
            bold("Le document officiel ci-dessous fait foi"),
            " — cette page n'en est qu'une présentation, sans valeur contractuelle : ",
            link(
              `télécharger la politique de confidentialité (PDF, version ${LEGAL_DOCUMENTS.confidentialite.version})`,
              LEGAL_DOCUMENTS.confidentialite.pdfHref,
            ),
            ".",
          ),
          h2("Ce que couvre ce document"),
          ul(
            [
              text(
                "L'identité du responsable et du sous-traitant : MediCare Pro agit en sous-traitant (art. 28 RGPD) pour le compte des praticiens, responsables du traitement des données de leurs patients.",
              ),
            ],
            [
              text(
                "Les données personnelles collectées, les finalités et les bases légales de chaque traitement.",
              ),
            ],
            [
              text(
                "Les destinataires des données et les durées de conservation appliquées.",
              ),
            ],
            [
              text(
                "Les mesures de sécurité et l'hébergement des données de santé en France chez un hébergeur certifié HDS.",
              ),
            ],
            [
              text(
                "Vos droits (accès, rectification, effacement, limitation, opposition, portabilité) et leurs modalités d'exercice.",
              ),
            ],
            [
              text(
                "Les cookies, l'absence de transfert hors Union européenne et le contact du délégué à la protection des données (DPO).",
              ),
            ],
          ),
          h2("Exercer vos droits"),
          p(
            "Pour exercer vos droits sur vos données, écrivez-nous à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ". Vous pouvez également introduire une réclamation auprès de la CNIL (",
            link("www.cnil.fr", "https://www.cnil.fr", true),
            "). Pour en savoir plus sur nos mesures techniques, consultez la page ",
            link("Sécurité", "/securite"),
            ".",
          ),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;

/* ---------------- /cgv ---------------- */

export const PAGE_CGV = {
  slug: "/cgv",
  title: "Conditions générales de vente",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Informations légales",
        title: "Conditions générales de vente",
        lead: "Conditions applicables à la souscription de l'abonnement MediCare Pro par les professionnels — version 2.1 (juillet 2026). Le document officiel PDF fait foi.",
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
          p(
            "Les conditions générales de vente (CGV) régissent la souscription à l'abonnement au logiciel SaaS MediCare Pro, édité par ",
            bold("MEDICARE PRO"),
            ", SAS au capital de 1 000 €, RCS Aix-en-Provence 102 034 121 (voir les ",
            link("mentions légales", "/mentions-legales"),
            "). Elles s'appliquent exclusivement aux professionnels de santé agissant dans le cadre de leur activité ; toute souscription emporte leur acceptation sans réserve.",
          ),
          p(
            "Version officielle en vigueur : ",
            bold(`Version ${LEGAL_DOCUMENTS.cgv.version} — Juillet 2026`),
            ".",
          ),
          p(
            bold("Le document officiel ci-dessous fait foi"),
            " — cette page n'en est qu'une présentation, sans valeur contractuelle : ",
            link(
              `télécharger les CGV (PDF, version ${LEGAL_DOCUMENTS.cgv.version})`,
              LEGAL_DOCUMENTS.cgv.pdfHref,
            ),
            ".",
          ),
          h2("Ce que couvre ce document"),
          ul(
            [
              text(
                "La souscription en ligne à l'abonnement et la description du service.",
              ),
            ],
            [
              text(
                "Les offres et tarifs en vigueur, la facturation et le paiement (carte bancaire via Monetico).",
              ),
            ],
            [
              text(
                "La reconduction automatique de l'abonnement par carte bancaire, son montant, sa périodicité et ses modalités d'arrêt.",
              ),
            ],
            [
              text(
                "La résiliation selon la formule choisie (sans engagement ou engagement 12 mois).",
              ),
            ],
            [
              text(
                "L'hébergement des données, les garanties et responsabilités, le droit applicable et la médiation.",
              ),
            ],
          ),
          p(
            "L'",
            link("accord de traitement des données (DPA)", "/dpa"),
            " constitue l'annexe 1 des CGV. Pour toute question, écrivez-nous à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ".",
          ),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;

/* ---------------- /dpa ---------------- */

export const PAGE_DPA = {
  slug: "/dpa",
  title: "Accord de Traitement des Données (DPA)",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Informations légales",
        title: "Accord de Traitement des Données (DPA)",
        lead: "L'accord de sous-traitance des données prévu par l'article 28 du RGPD — version 2.1 (juillet 2026). Le document officiel PDF fait foi.",
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
          p(
            "L'accord de traitement des données (Data Processing Agreement, DPA) constitue l'annexe 1 des ",
            link("conditions générales de vente", "/cgv"),
            ". Conclu en application de l'article 28 du RGPD, il encadre la relation entre le praticien, responsable du traitement des données de ses patients, et ",
            bold("MEDICARE PRO"),
            ", qui agit en qualité de sous-traitant.",
          ),
          p(
            "Version officielle en vigueur : ",
            bold(`Version ${LEGAL_DOCUMENTS.dpa.version} — Juillet 2026`),
            ".",
          ),
          p(
            bold("Le document officiel ci-dessous fait foi"),
            " — cette page n'en est qu'une présentation, sans valeur contractuelle : ",
            link(
              `télécharger le DPA (PDF, version ${LEGAL_DOCUMENTS.dpa.version})`,
              LEGAL_DOCUMENTS.dpa.pdfHref,
            ),
            ".",
          ),
          h2("Ce que couvre ce document"),
          ul(
            [
              text(
                "L'objet et la description du traitement : catégories de données (dont données de santé) et de personnes concernées.",
              ),
            ],
            [
              text(
                "Les obligations du sous-traitant : instructions, confidentialité, sécurité et sous-traitants ultérieurs.",
              ),
            ],
            [
              text(
                "La notification des violations de données et l'assistance au responsable de traitement.",
              ),
            ],
            [
              text(
                "Les transferts de données, le délégué à la protection des données (DPO) et le registre des traitements.",
              ),
            ],
            [
              text(
                "Le sort des données en fin de contrat, l'audit, la responsabilité et le droit applicable.",
              ),
            ],
          ),
          p(
            "Pour toute question sur ce document, écrivez-nous à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ".",
          ),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;

/* ---------------- /cookies ---------------- */

export const PAGE_COOKIES = {
  slug: "/cookies",
  title: "Politique de Cookies",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Informations légales",
        title: "Politique de Cookies",
        lead: "Des cookies techniques uniquement, conformément à la directive ePrivacy et aux recommandations de la CNIL — version 2.1 (juillet 2026). Le document officiel PDF fait foi.",
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
          p(
            "La politique de cookies décrit les cookies et le stockage local utilisés par le site medicarepro.fr et le logiciel MediCare Pro, conformément à la directive ePrivacy, à l'article 82 de la loi Informatique et Libertés et aux recommandations de la CNIL. ",
            bold(
              "MediCare Pro utilise exclusivement des cookies techniques",
            ),
            " : aucun cookie publicitaire, analytique ou de traçage n'est déposé.",
          ),
          p(
            "Version officielle en vigueur : ",
            bold(`Version ${LEGAL_DOCUMENTS.cookies.version} — Juillet 2026`),
            ".",
          ),
          p(
            bold("Le document officiel ci-dessous fait foi"),
            " — cette page n'en est qu'une présentation, sans valeur contractuelle : ",
            link(
              `télécharger la politique de cookies (PDF, version ${LEGAL_DOCUMENTS.cookies.version})`,
              LEGAL_DOCUMENTS.cookies.pdfHref,
            ),
            ".",
          ),
          h2("Ce que couvre ce document"),
          ul(
            [
              text(
                "La définition des cookies et du stockage local, et leur rôle dans le fonctionnement du service.",
              ),
            ],
            [
              text(
                "La liste des cookies techniques utilisés (session, authentification, sécurité, préférences) et leurs finalités.",
              ),
            ],
            [
              text(
                "La base légale : des cookies strictement nécessaires, exemptés de consentement préalable.",
              ),
            ],
            [
              text(
                "La gestion des cookies depuis le navigateur et les mesures de sécurité appliquées.",
              ),
            ],
          ),
          p(
            "Le traitement des données personnelles est détaillé dans la ",
            link("politique de confidentialité", "/confidentialite"),
            ". Pour toute question, écrivez-nous à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ".",
          ),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;
