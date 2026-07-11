/**
 * Contenu de la page /contact — extraction 1:1 de :
 * src/app/(site)/contact/page.tsx + ContactSection.tsx.
 * Les labels/placeholders des champs du formulaire restent dans le composant
 * (structure du formulaire) ; seule la microcopie éditoriale est extraite.
 * Conventions : `\n` = <br />, `**…**` = accent/gras, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_CONTACT = {
  slug: "/contact",
  title: "Contact",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Contact",
        title: "Parlons de votre cabinet de podologie",
        lead: "Une question, une démo, un abonnement ? Notre équipe vous répond sous 24 h ouvrées. Hébergement HDS en France, données conformes RGPD.",
        image: {
          mediaId: null,
          path: "/images/fonctionnalites/podologue-medicarepro-section-1.jpg",
          alt: "",
        },
      },
    },
    {
      key: "channels",
      type: "contact_channels",
      content: {
        type: "contact_channels",
        kicker: "Nous écrire",
        title: "Une équipe qui connaît vos journées",
        text: "Une question sur les tarifs, la migration de vos données ou la conformité HDS ? Choisissez le canal qui vous arrange — on vous répond vite, et sans jargon.",
        channels: [
          {
            icon: "Mail",
            title: "Par email",
            value: "contact@medicarepro.fr",
            note: "Réponse sous 24 h ouvrées",
            href: "mailto:contact@medicarepro.fr",
          },
          {
            icon: "Phone",
            title: "Par téléphone",
            value: "07 62 59 66 53",
            note: "Du lundi au vendredi, 9 h – 18 h",
            href: "tel:+33762596653",
          },
          {
            icon: "Headset",
            title: "Démo en visio",
            value: "30 minutes, sur vos cas concrets",
            note: "Gratuit et sans engagement",
          },
        ],
        hdsLine:
          "Vos données sont hébergées en France (HDS), chiffrées et conformes RGPD.",
        form: {
          title: "Demander une démo",
          sub: "Dites-nous en un mot où en est votre cabinet, on s'occupe du reste.",
          consent:
            "J'accepte que mes données soient traitées conformément à la politique de confidentialité.",
          submitLabel: "Envoyer ma demande",
          successTitle: "Message bien reçu !",
          successText:
            "Merci pour votre confiance. Un membre de l'équipe revient vers vous sous 24 h ouvrées pour organiser la suite.",
          footNote:
            "Données hébergées en France (HDS), chiffrées et conformes RGPD.",
        },
      },
    },
    {
      key: "steps",
      type: "contact_steps",
      content: {
        type: "contact_steps",
        kicker: "Et ensuite ?",
        title: "De votre message à un cabinet équipé",
        steps: [
          {
            title: "On vous répond",
            text: "Sous 24 h ouvrées, par email ou téléphone, selon votre préférence.",
          },
          {
            title: "On vous montre",
            text: "Une démo personnalisée de 30 minutes, sur les cas concrets de votre cabinet.",
          },
          {
            title: "Vous démarrez",
            text: "Import de vos données et cabinet opérationnel en une journée.",
          },
        ],
      },
    },
    {
      key: "cross_links",
      type: "cross_links",
      content: {
        type: "cross_links",
        links: [
          { label: "Voir les tarifs", href: "/tarifs" },
          { label: "Les fonctionnalités", href: "/fonctionnalites" },
          { label: "Sécurité des données", href: "/securite" },
        ],
      },
    },
  ],
} satisfies ManagedPageContent;
