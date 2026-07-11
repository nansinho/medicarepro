/**
 * Contenu des 4 pages légales (/cgu, /cgv, /mentions-legales, /confidentialite),
 * en documents Tiptap JSON (headings niveau 2, paragraphes, listes à puces,
 * liens, gras). Identité de l'éditeur : MEDICARE PRO, SAS au capital de
 * 1 000 €, 340 chemin du plan marseillais, 13320 Bouc-Bel-Air, SIRET
 * 102 034 121 00016, RCS Aix-en-Provence 102 034 121. Les marqueurs
 * [À COMPLÉTER : …] restants sont conservés en texte brut (sources : onglet
 * Réglages > Légal du back-office, plus tard).
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
            "Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'utilisation du site medicarepro.fr (le « Site »), édité par MEDICARE PRO, SAS au capital de 1 000 € (voir les ",
            link("mentions légales", "/mentions-legales"),
            "). En naviguant sur le Site, l'utilisateur accepte les présentes CGU sans réserve.",
          ),
          h2("2. Description du service"),
          p(
            "Le Site est un site vitrine présentant MediCare Pro, logiciel de gestion de cabinet destiné aux pédicures-podologues : dossiers patients, facturation, comptabilité, agenda, bilans podologiques et signature électronique. La souscription à l'abonnement s'effectue en ligne sur le Site et est régie par les ",
            link("conditions générales de vente", "/cgv"),
            ". L'utilisation du logiciel s'effectue sur l'application dédiée (app.medicarepro.fr), régie par ses conditions contractuelles propres.",
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
            "Paiement sécurisé par carte bancaire : Monetico Paiement (Crédit Industriel et Commercial — CIC / Euro-Information). Prélèvements SEPA opérés via le CIC. Les données de carte bancaire sont saisies exclusivement sur les pages de paiement sécurisées de Monetico et ne transitent jamais par le site medicarepro.fr.",
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
            "Le responsable du traitement des données collectées via le site medicarepro.fr est MEDICARE PRO, SAS au capital de 1 000 €, 340 chemin du plan marseillais, 13320 Bouc-Bel-Air (SIRET 102 034 121 00016, RCS Aix-en-Provence 102 034 121). Contact : ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ".",
          ),
          h2("2. Données collectées sur ce site"),
          p(
            "Via le formulaire de contact / demande de démonstration, nous collectons les données que vous nous transmettez volontairement : nom, adresse email, numéro de téléphone, taille du cabinet et contenu de votre message.",
          ),
          p(
            "Lors de la souscription en ligne à l'abonnement (tunnel d'inscription), nous collectons en outre : l'identité du praticien (nom, prénom, email), les coordonnées du cabinet (nom, adresse, téléphone, email), les numéros RPPS et SIRET, ainsi que les coordonnées bancaires (IBAN) nécessaires au mandat de prélèvement SEPA — l'IBAN est conservé chiffré. Les données de carte bancaire sont traitées exclusivement par Monetico (CIC) : ",
            bold("la carte ne transite jamais par notre site"),
            ".",
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
            [
              text(
                "Gestion des abonnements et de la facturation (souscription, paiement, mandat SEPA, factures) — bases légales : exécution du contrat (art. 6.1.b RGPD) et respect de nos obligations comptables et fiscales (art. 6.1.c RGPD).",
              ),
            ],
          ),
          h2("4. Durées de conservation"),
          ul(
            [
              text(
                "Formulaire de contact : au maximum 3 ans à compter du dernier échange, puis suppression ou anonymisation.",
              ),
            ],
            [
              text(
                "Dossiers de souscription abandonnés (inscription non finalisée) : 30 jours.",
              ),
            ],
            [
              text(
                "Données de mandat SEPA : 15 mois après le dernier prélèvement (délai de contestation SEPA) ; l'IBAN chiffré est supprimé à la purge du mandat.",
              ),
            ],
            [
              text(
                "Pièces comptables (factures, journal des opérations) : 10 ans (obligation légale).",
              ),
            ],
          ),
          p(
            "La suppression du compte applicatif entraîne l'anonymisation des données de facturation non soumises à une obligation de conservation légale.",
          ),
          h2("5. Destinataires et sous-traitants"),
          p(
            "Les données sont destinées à l'équipe MediCare Pro et, pour les traitements liés à l'abonnement, aux destinataires suivants : Monetico / CIC (paiement par carte bancaire et prélèvements SEPA), l'éditeur de l'application app.medicarepro.fr (création et gestion du compte, hébergée en France chez OVHcloud, certifié HDS) et notre prestataire d'envoi d'emails (emails transactionnels). Les données du site sont hébergées en France par OVHcloud (OVH SAS, 2 rue Kellermann, 59100 Roubaix). Aucune donnée n'est vendue ni transférée hors de l'Union européenne.",
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
          p("Dernière mise à jour : 11 juillet 2026."),
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
        lead: "Conditions applicables à la souscription en ligne de l'abonnement MediCare Pro par les professionnels.",
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
          h2("1. Objet et champ d'application"),
          p(
            "Les présentes conditions générales de vente (CGV) régissent la souscription en ligne, sur le site medicarepro.fr, de l'abonnement au logiciel MediCare Pro, service en ligne (SaaS) de gestion de cabinet destiné aux pédicures-podologues, édité par ",
            bold("MEDICARE PRO"),
            ", SAS au capital de 1 000 €, dont le siège social est situé 340 chemin du plan marseillais, 13320 Bouc-Bel-Air, immatriculée au RCS d'Aix-en-Provence sous le numéro 102 034 121 (SIRET 102 034 121 00016) — ci-après « l'Éditeur ». Elles s'appliquent exclusivement aux clients professionnels (ci-après le « Client »). Toute souscription en ligne emporte acceptation pleine et entière des présentes CGV.",
          ),
          h2("2. Tarifs"),
          ul(
            [
              bold("Formule mensuelle"),
              text(" : 29,88 € TTC par mois, sans engagement de durée."),
            ],
            [
              bold("Formule annuelle"),
              text(
                " : 298,08 € TTC par an (soit 24,84 € TTC par mois), avec un engagement de 12 mois.",
              ),
            ],
            [
              bold("Collaborateur supplémentaire"),
              text(" : 15,00 € TTC par mois et par collaborateur."),
            ],
          ),
          p(
            "Les prix s'entendent toutes taxes comprises (TVA au taux de 20 %). Le prix applicable est celui en vigueur au jour de la souscription ; il est figé pour la période d'abonnement en cours. Toute évolution tarifaire ne s'applique qu'à compter du renouvellement suivant, après information préalable du Client.",
          ),
          h2("3. Souscription en ligne et paiement initial"),
          p(
            "La souscription s'effectue en ligne, via le ",
            link("tunnel d'inscription", "/inscription"),
            " du site. Le premier paiement est réglé par carte bancaire via la plateforme sécurisée Monetico Paiement (Crédit Industriel et Commercial — CIC / Euro-Information) ; les données de carte bancaire sont saisies exclusivement sur les pages de paiement de Monetico et ne transitent jamais par le site medicarepro.fr. Le compte du Client sur l'application app.medicarepro.fr est créé après confirmation du paiement par carte ; les informations de connexion lui sont communiquées par email.",
          ),
          h2("4. Renouvellement et prélèvement SEPA"),
          p(
            "Les échéances suivantes (renouvellement mensuel ou annuel selon la formule) sont réglées par prélèvement SEPA, au titre du mandat de prélèvement SEPA Core signé par le Client lors de la souscription. Chaque échéance fait l'objet d'une pré-notification adressée au Client au moins 14 jours avant la date du prélèvement.",
          ),
          h2("5. Défaut de paiement"),
          p(
            "En cas de rejet d'un prélèvement SEPA non régularisé dans un délai de 14 jours, l'accès du Client à l'application est suspendu jusqu'à régularisation complète. Les frais de rejet éventuellement supportés par l'Éditeur peuvent être refacturés au Client à leur coût réel.",
          ),
          h2("6. Résiliation"),
          ul(
            [
              bold("Formule mensuelle"),
              text(
                " : résiliable à tout moment, moyennant un préavis de 15 jours ; l'abonnement prend fin au terme de la période mensuelle en cours.",
              ),
            ],
            [
              bold("Formule annuelle"),
              text(
                " : engagement de 12 mois ; la résiliation prend effet au terme de la période de 12 mois en cours.",
              ),
            ],
          ),
          p(
            "Toute demande de résiliation s'effectue par email à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ". Les périodes déjà payées restent acquises à l'Éditeur.",
          ),
          h2("7. Révocation du mandat SEPA"),
          p(
            "Le Client peut révoquer son mandat de prélèvement SEPA à tout moment, sur demande adressée à ",
            link("contact@medicarepro.fr", "mailto:contact@medicarepro.fr"),
            ". La révocation du mandat sans mise en place d'un autre moyen de paiement vaut résiliation de l'abonnement au terme de la période déjà payée.",
          ),
          h2("8. Absence de droit de rétractation"),
          p(
            "Le contrat étant conclu entre professionnels, pour les besoins de l'activité du Client, le client professionnel ne bénéficie pas du droit de rétractation prévu par le Code de la consommation (les articles L221-3 et suivants n'étant pas applicables aux services souscrits entre professionnels et pleinement exécutés).",
          ),
          h2("9. Responsabilité"),
          p(
            "L'Éditeur est tenu à une obligation de moyens dans la fourniture du service, accessible 24 h/24 et 7 j/7 sous réserve des opérations de maintenance et des aléas techniques. La responsabilité de l'Éditeur est limitée aux dommages directs et prévisibles, et plafonnée au montant des sommes effectivement payées par le Client au titre des 12 derniers mois. Le Client demeure seul responsable des données qu'il traite dans l'application et du respect de ses obligations professionnelles.",
          ),
          h2("10. Droit applicable et juridiction"),
          p(
            "Les présentes CGV sont soumises au droit français. Tout litige relatif à leur formation, leur interprétation ou leur exécution relève, à défaut de résolution amiable, de la compétence exclusive du tribunal de commerce d'Aix-en-Provence.",
          ),
          p("Dernière mise à jour : 11 juillet 2026."),
        ),
      },
    },
  ],
} satisfies ManagedPageContent;
