import type { CSSProperties } from "react";
import { AppIcon } from "./core";

/* ============================================================
   Écran « Nouvelle consultation » de l'application praticien,
   redessiné d'après l'app réelle (menu bleu, en-tête patient,
   types de consultation, bilans, traçabilité du lot stérilisé).
   Cadré comme un zoom sur la page : la colonne de droite de l'app
   (antécédents, historique) resterait cachée par le téléphone.
   Données d'exemple, patiente anonymisée.
   ============================================================ */

const NAV: [string, string][] = [
  ["grid", "Tableau de bord"],
  ["users", "Patients"],
  ["cal", "Agenda"],
  ["trend", "Statistiques"],
  ["chart", "Comptabilité"],
  ["shield", "Traçabilité"],
  ["build", "Cabinet"],
];

const TYPES: [string, string][] = [
  ["Soins", "#5A5BF1"],
  ["Posturo", "#00B477"],
  ["Bilan + OP", "#F59C00"],
  ["Soins diabétique", "#FF3162"],
  ["Podopédiatrie", "#8D65FF"],
  ["Bilan personnalisé", "#00C6D1"],
];

const BILANS: [string, string][] = [
  ["clip", "Commun"],
  ["move", "Statique"],
  ["person", "Dynamique"],
  ["drop", "Trophique"],
  ["heart", "Vasculaire"],
  ["foot", "Morphologique"],
  ["wrench", "Articulaire"],
  ["bolt", "Neurologique"],
  ["shoe", "Chaussant"],
];

const SPECIFIQUES: [string, string][] = [
  ["target", "Posturologie"],
  ["trend", "Sport"],
  ["smile", "Pédiatrie"],
];

const dot = (c: string) => ({ "--d": c }) as CSSProperties;

function Field({ label, value, select }: { label: string; value: string; select?: boolean }) {
  return (
    <div className="cs-field">
      <small>{label}</small>
      <span className="cs-input">
        {value}
        {select && <AppIcon name="chev" />}
      </span>
    </div>
  );
}

export function ConsultationScreen() {
  return (
    <div className="win">
      <div className="win-bar">
        <i />
        <i />
        <i />
        <span className="win-url">
          <AppIcon name="lock" />
          app.medicarepro.fr/patients/mme-d/consultation
        </span>
      </div>
      <div className="cs-app">
        <nav className="cs-nav">
          <span className="cs-logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique */}
            <img src="/logo-icon.svg" alt="" />
          </span>
          {NAV.map(([icon, label]) => (
            <a key={label} className={label === "Patients" ? "on" : undefined}>
              <AppIcon name={icon} />
              {label}
            </a>
          ))}
          <span className="cs-sp" />
          <i className="cs-round">
            <AppIcon name="help" />
          </i>
          <i className="cs-round">
            <AppIcon name="msg" />
          </i>
        </nav>

        <div className="cs-page">
          <div className="cs-top">
            Patients
            <span className="cs-top-r">
              <i className="cs-ico cs-bell">
                <AppIcon name="bell" />
                <em>1</em>
              </i>
              <i className="cs-ico">
                <AppIcon name="sun" />
              </i>
              <i className="cs-av">DC</i>
            </span>
          </div>

          <div className="cs-body">
            <div className="cs-head">
              <AppIcon name="back" />
              <div>
                <h4>Nouvelle consultation</h4>
                <p>
                  <i className="cs-av cs-av-s">MD</i>
                  <b>Mme D.</b> née le 12/03/1959
                  <span className="cs-consent">
                    <AppIcon name="shield" />
                    Consentement signé le 14/08/2026
                  </span>
                </p>
              </div>
              <span className="cs-btn-w">
                <AppIcon name="link" />
                Modifier le patient
              </span>
            </div>

            <div className="cs-types">
              {TYPES.map(([label, c]) => (
                <span key={label} style={dot(c)}>
                  {label}
                </span>
              ))}
            </div>

            <div className="cs-grid">
              <div className="cs-col">
                <div className="cs-card cs-list">
                  <h6>
                    Bilans
                    <AppIcon name="chevUp" />
                  </h6>
                  {BILANS.map(([icon, label]) => (
                    <a key={label} className={label === "Commun" ? "on" : undefined}>
                      <AppIcon name={icon} />
                      {label}
                    </a>
                  ))}
                </div>
                <div className="cs-card cs-list">
                  <h6>
                    Bilans spécifiques
                    <AppIcon name="chevUp" />
                  </h6>
                  {SPECIFIQUES.map(([icon, label]) => (
                    <a key={label}>
                      <AppIcon name={icon} />
                      {label}
                    </a>
                  ))}
                </div>
                <div className="cs-card cs-list cs-fold">
                  <h6>
                    Tests cliniques
                    <AppIcon name="chev" />
                  </h6>
                </div>
              </div>

              <div className="cs-card cs-form">
                <h5>
                  <AppIcon name="cal" />
                  Motif de la consultation
                </h5>
                <div className="cs-trace">
                  <b>
                    <AppIcon name="shield" />
                    Traçabilité · lot stérilisé
                  </b>
                  <p>Scannez le QR du lot, la consultation sera enregistrée automatiquement.</p>
                  <span className="cs-qr">
                    <AppIcon name="qr" />
                    Scanner un QR code
                  </span>
                  <p className="cs-or">ou saisissez l&apos;étiquette du kit :</p>
                  <div className="cs-fields">
                    <Field label="Autoclave" value="Choisir…" select />
                    <Field label="N° de cycle" value="ex. 128" />
                    <Field label="Type de kit" value="Choisir…" select />
                    <Field label="N° de kit" value="" />
                    <span className="cs-link">
                      <AppIcon name="shield" />
                      Lier le kit
                    </span>
                  </div>
                </div>

                <div className="cs-row2">
                  <div className="cs-field">
                    <small>Date de la consultation *</small>
                    <span className="cs-input cs-strong">
                      26/09/2026
                      <AppIcon name="cal" />
                    </span>
                  </div>
                  <span className="cs-first">
                    <i />
                    Première consultation
                  </span>
                </div>

                <div className="cs-field">
                  <small>Motif de consultation *</small>
                  <span className="cs-area">
                    <i className="cs-ico">
                      <AppIcon name="spark" />
                    </i>
                    <i className="cs-ico">
                      <AppIcon name="mic" />
                    </i>
                  </span>
                </div>
                <div className="cs-quick">
                  Motifs rapides :
                  <span style={dot("#6663D6")}>Bilan/orthèses plantaires</span>
                  <span style={dot("#00B477")}>Soins pédicurie</span>
                  <span style={dot("#F59C00")}>Autres et appareillage</span>
                </div>
                <div className="cs-pain">
                  Évaluation de la douleur
                  <span className="cs-btn-w">
                    <AppIcon name="plus" />
                    Ajouter une douleur
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
