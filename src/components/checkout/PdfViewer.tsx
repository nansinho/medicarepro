"use client";

import { useEffect, useRef } from "react";
import s from "./PdfViewer.module.css";

/* ============================================================
   Lecture d'un document contractuel sans quitter le tunnel.

   POURQUOI PAS UN SIMPLE LIEN. Ouvrir le PDF dans un onglet fait sortir le
   praticien de son inscription : il revient — ou pas — sur un formulaire dont
   il a perdu le fil. Or on lui demande d'accepter ces documents, donc de les
   lire : autant qu'il puisse le faire sans rien perdre.

   PLEINE PAGE, PAS UN PETIT MODAL CENTRÉ. Un document contractuel se lit ; le
   réduire à une vignette au milieu de l'écran obligerait à le rouvrir ailleurs,
   ce qui annule tout l'intérêt. Le lecteur natif du navigateur fait le reste
   (zoom, recherche, impression, téléchargement).

   Le téléchargement reste offert au même endroit : certains navigateurs
   n'affichent pas les PDF en cadre, et la case à cocher engage juridiquement —
   il ne doit jamais y avoir de cul-de-sac.
   ============================================================ */

export type PdfDoc = { title: string; version?: string; href: string };

export default function PdfViewer({
  doc,
  onClose,
}: {
  doc: PdfDoc;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    /* Échap ferme : c'est le geste attendu, et il évite de chercher la croix
       quand le cadre du PDF a pris le focus. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    /* Le fond ne défile pas derrière la lecture. On restaure la valeur
       PRÉCÉDENTE plutôt que de forcer "", pour ne pas écraser un verrou posé
       par autre chose. */
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = precedent;
    };
  }, [onClose]);

  return (
    <div
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`${doc.title}${doc.version ? ` — version ${doc.version}` : ""}`}
      /* Le clic sur le fond ferme, mais JAMAIS un clic né dans la fenêtre :
         sans ce test, une sélection de texte qui se termine sur le fond
         refermait le document en pleine lecture. */
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={s.panel}>
        <div className={s.bar}>
          <div className={s.ident}>
            <IconPdf />
            <div className={s.names}>
              <span className={s.title}>{doc.title}</span>
              {doc.version && (
                <span className={s.version}>Version {doc.version}</span>
              )}
            </div>
          </div>
          <div className={s.actions}>
            <a
              href={doc.href}
              download
              className={s.download}
              /* Filet indispensable : Firefox et plusieurs navigateurs mobiles
                 refusent d'afficher un PDF en cadre et laisseraient un écran
                 vide sous une case à cocher qui engage. */
            >
              Télécharger
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className={s.close}
              aria-label="Fermer le document"
            >
              ✕
            </button>
          </div>
        </div>
        <iframe
          src={doc.href}
          className={s.frame}
          title={doc.title}
        />
      </div>
    </div>
  );
}

/** Feuille cornée avec la mention PDF — reconnaissable sans texte à côté. */
export function IconPdf() {
  return (
    <span className={s.badge} aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H14a1 1 0 0 1-1-1V3.5z" />
      </svg>
      PDF
    </span>
  );
}
