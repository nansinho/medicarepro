import type { CSSProperties } from "react";
import { AppHead, AppIcon, AppSide, AppWin, Row, u } from "./core";

/* ============================================================
   Écrans du suivi : signature électronique, carte Vitale,
   portail patient, statistiques, bilans chutes et postural,
   tournée à domicile.
   ============================================================ */

export function SignatureScreen() {
  return (
    <AppWin
      url="app.medicarepro.fr/patients/mme-d/documents/consentement"
      side={<AppSide on="Patients" />}
    >
      <AppHead title="Consentement éclairé" sub="Mme D. · soins de pédicurie-podologie">
        <span className="chip ok">
          <AppIcon name="check" />
          Signé
        </span>
      </AppHead>
      <div className="bil-grid">
        <div className="card">
          <h5>
            Document <span className="chip grey">PDF · 2 pages</span>
          </h5>
          <div className="doc-t">Consentement aux soins de pédicurie-podologie</div>
          {[96, 88, 92, 64].map((w, i) => (
            <div key={i} className="doc-l" style={{ width: `${w}%` }} />
          ))}
          <ul className="doc-c">
            <li>
              <AppIcon name="check" />
              Information reçue sur les soins proposés
            </li>
            <li>
              <AppIcon name="check" />
              Information reçue sur les risques et alternatives
            </li>
            <li>
              <AppIcon name="check" />
              Conservation du dossier au cabinet
            </li>
          </ul>
          <div className="sig-box">
            <small>Signature du patient</small>
            <svg viewBox="0 0 220 60">
              <path
                d="M8 42c14-22 22-30 26-24 5 8-10 26-3 27 9 1 16-26 24-24 7 2-2 20 5 21 8 1 12-17 19-16 6 1 3 13 9 13 9 0 13-14 22-13 8 1 7 11 15 11 10 0 20-8 34-10 12-2 24 0 39 2"
                pathLength={1}
                fill="none"
                stroke="#1C55B4"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Mme D. · 28/09/2026</span>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h5>
              Signature électronique <span className="chip">eIDAS</span>
            </h5>
            <Row label="Signataire" value="Mme D." />
            <Row label="Méthode" value="à distance, code SMS" />
            <Row label="Horodatage" value="28/09 · 10:42:17" />
          </div>
          <div className="card">
            <h5>Archivage</h5>
            <Row label="Empreinte" value="SHA-256 · 9f3c…e21" />
            <Row label="Rangé dans" value="dossier de Mme D." />
          </div>
          <div className="card grade">
            <h5>
              Statut <span className="chip ok">Opposable</span>
            </h5>
            <div className="grade-v">
              <b>Signé</b>
              <span>horodaté et archivé</span>
            </div>
          </div>
        </div>
      </div>
    </AppWin>
  );
}

export function VitaleScreen() {
  return (
    <AppWin url="app.medicarepro.fr/facturation/carte-vitale" side={<AppSide on="Facturation" />}>
      <AppHead title="Carte Vitale" sub="Lecteur connecté · lecture du 28/09 à 09:02">
        <span className="chip ok">
          <AppIcon name="check" />
          Lecture réussie
        </span>
      </AppHead>
      <div className="bil-grid">
        <div className="stack">
          <div className="card">
            <h5>
              Carte lue <span className="chip grey">Carte Vitale</span>
            </h5>
            <div className="vcard">
              <span className="vcard-chip" />
              <span className="vcard-t">carte Vitale</span>
              <span className="vcard-n">Mme D.</span>
              <span className="vcard-id">2 58 •• •• ••• ••• 42</span>
            </div>
          </div>
          <div className="card">
            <h5>
              Application carte Vitale <span className="chip">ApCV</span>
            </h5>
            <Row label="Lecture par smartphone" value="acceptée" />
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h5>Identité du patient</h5>
            <Row label="Nom" value="Mme D." />
            <Row label="Naissance" value="••/••/1958" />
            <Row label="Régime" value="Général" />
            <Row label="Caisse" value="CPAM 13" />
          </div>
          <div className="card">
            <h5>Droits</h5>
            <Row label="Assurance maladie" value="ouverts" />
            <Row label="Complémentaire" value="renseignée" />
          </div>
          <div className="card grade">
            <h5>
              Dossier <span className="chip ok">Sécurisé</span>
            </h5>
            <div className="grade-v">
              <b style={{ fontSize: u(22) }}>Identité vérifiée</b>
            </div>
            <p style={{ margin: 0, fontSize: u(11.5) }}>Prête pour la télétransmission des actes.</p>
          </div>
        </div>
      </div>
    </AppWin>
  );
}

const PORTAL_SIDE: [string, string][] = [
  ["home", "Accueil"],
  ["cal", "Rendez-vous"],
  ["file", "Documents"],
  ["insole", "Mes semelles"],
  ["msg", "Messagerie"],
];

export function PortalScreen() {
  return (
    <AppWin
      url="app.medicarepro.fr/espace-patient"
      side={<AppSide on="Accueil" items={PORTAL_SIDE} footer="Espace de Mme D." initials="MD" />}
    >
      <AppHead title="Bonjour Mme D." sub="Votre espace patient · cabinet de podologie">
        <span className="mbtn">
          <AppIcon name="plus" />
          Prendre rendez-vous
        </span>
      </AppHead>
      <div className="g2" style={{ marginBottom: u(10) }}>
        <div className="card">
          <h5>Prochain rendez-vous</h5>
          <div className="big-v">Mer. 30 sept · 09:00</div>
          <p className="muted-l">Bilan de suivi · durée 45 min</p>
          <div style={{ display: "flex", gap: u(6), marginTop: u(10) }}>
            <span className="mbtn alt">Déplacer</span>
            <span className="mbtn alt">Ajouter au calendrier</span>
          </div>
        </div>
        <div className="card">
          <h5>
            Mes semelles <span className="chip">Paire n° 2</span>
          </h5>
          <div className="steps">
            <div className="d">Empreinte</div>
            <div className="d">Fabrication</div>
            <div className="d">Délivrance</div>
            <div className="c">Contrôle</div>
          </div>
          <p className="muted-l" style={{ marginTop: u(10) }}>
            Contrôle prévu le 14/10 au cabinet.
          </p>
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <h5>Mes documents</h5>
          <Row label="Compte-rendu du 28/09" value="PDF" />
          <Row label="Facture F-2026-0412" value={<span className="chip ok">Payée</span>} />
          <Row label="Consentement signé" value="PDF" />
        </div>
        <div className="card">
          <h5>
            Messagerie <span className="chip">1 nouveau</span>
          </h5>
          <div className="msg-b">
            <b>Cabinet</b>
            Pensez à apporter vos chaussures habituelles pour le contrôle des semelles.
          </div>
        </div>
      </div>
    </AppWin>
  );
}

const CONSULT = [248, 262, 281, 270, 290, 276, 214, 188, 312];

export function StatsScreen() {
  const x0 = 30;
  const x1 = 412;
  const y0 = 128;
  const top = 12;
  const max = 320;
  const gw = (x1 - x0) / CONSULT.length;
  return (
    <AppWin url="app.medicarepro.fr/statistiques" side={<AppSide on="Tableau de bord" />}>
      <AppHead title="Statistiques" sub="Septembre 2026 · 2 cabinets">
        <span className="mbtn alt">Tous les cabinets</span>
      </AppHead>
      <div className="g4" style={{ marginBottom: u(12) }}>
        <div className="kpi">
          <small>Consultations</small>
          <b>312</b>
        </div>
        <div className="kpi">
          <small>Paires d&apos;orthèses</small>
          <b>24</b>
        </div>
        <div className="kpi">
          <small>Chiffre d&apos;affaires</small>
          <b>14 280 €</b>
        </div>
        <div className="kpi">
          <small>Nouveaux patients</small>
          <b>38</b>
        </div>
      </div>
      <div className="bil-grid" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)" }}>
        <div className="card">
          <h5>Consultations par mois</h5>
          <svg className="chart" viewBox="0 0 420 150" style={{ width: "100%", height: "auto", display: "block" }}>
            {[0, 100, 200, 300].map((val) => {
              const y = y0 - (val / max) * (y0 - top);
              return (
                <g key={val}>
                  <line className="gl" x1={x0} x2={x1} y1={y} y2={y} />
                  <text x={x0 - 6} y={y + 3.5} textAnchor="end">
                    {val}
                  </text>
                </g>
              );
            })}
            {CONSULT.map((c, i) => {
              const h = (c / max) * (y0 - top);
              const gx = x0 + i * gw + gw / 2;
              return (
                <g key={i} style={{ "--i": i } as CSSProperties}>
                  <rect className={i === CONSULT.length - 1 ? "b1" : "b2"} x={gx - 11} y={y0 - h} width="22" height={h} rx="3" />
                  <text x={gx} y={y0 + 16} textAnchor="middle">
                    {"JFMAMJJAS"[i]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="card">
          <h5>
            Traçabilité des orthèses <span className="chip grey">Matériovigilance</span>
          </h5>
          <Row label="L-2609-114 · M. R." value={<span className="chip">Délivrée</span>} />
          <Row label="L-2609-108 · Patient C." value={<span className="chip grey">Fabrication</span>} />
          <Row label="L-2608-097 · Mme T." value={<span className="chip ok">Contrôlée</span>} />
          <Row label="L-2608-091 · M. B." value={<span className="chip ok">Contrôlée</span>} />
        </div>
      </div>
    </AppWin>
  );
}

const RISKS: [string, boolean][] = [
  ["Chute dans l'année", true],
  ["Peur de tomber", true],
  ["Troubles de la marche", true],
  ["Plus de quatre médicaments", true],
  ["Chaussage inadapté", true],
  ["Troubles visuels", false],
  ["Hypotension orthostatique", false],
  ["Vit seul", false],
];

export function ChuteScreen() {
  return (
    <AppWin url="app.medicarepro.fr/patients/m-l/bilans/chutes" side={<AppSide on="Bilans" />}>
      <AppHead title="Bilan de risque de chute" sub="M. L. · 81 ans · suivi à domicile">
        <span className="chip warn">
          <AppIcon name="alert" />
          Risque élevé
        </span>
      </AppHead>
      <div className="bil-grid">
        <div className="stack">
          <div className="card">
            <h5>Tests fonctionnels</h5>
            <Row label="Timed Up and Go" value="16,2 s" />
            <Row label="Appui unipodal" value="3 s" />
            <Row label="Chair stand test (5 levers)" value="17,8 s" />
            <Row label="Vitesse de marche" value="0,7 m/s" />
          </div>
          <div className="card">
            <h5>
              Facteurs de risque <span className="chip">5 sur 8</span>
            </h5>
            <ul className="chk-l">
              {RISKS.map(([label, on]) => (
                <li key={label} className={on ? "on" : undefined}>
                  <i>{on && <AppIcon name="check" />}</i>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="stack">
          <div className="card grade">
            <h5>
              Classification du risque <span className="chip">Auto</span>
            </h5>
            <div className="grade-v">
              <b>Élevé</b>
              <span>suivi rapproché</span>
            </div>
            <div className="scale4">
              <i className="on" />
              <i className="on" />
              <i className="on" />
              <i />
            </div>
            <div className="scale4-l">
              <span>Faible</span>
              <span>Modéré</span>
              <span>Élevé</span>
              <span>Très élevé</span>
            </div>
          </div>
          <div className="card">
            <h5>Recommandations</h5>
            <Row label="Chaussage et orthèses" value="à adapter" />
            <Row label="Exercices d'équilibre" value="remis" />
            <Row label="Réévaluation" value="dans 3 mois" />
          </div>
        </div>
      </div>
    </AppWin>
  );
}

const SENSORS: [string, string, string, string][] = [
  ["foot", "Pied", "warn", "À corriger"],
  ["eye", "Œil", "warn", "À explorer"],
  ["users", "Mandibule (ATM)", "ok", "Normal"],
  ["shield", "Peau, cicatrices", "ok", "Normal"],
];

export function PosturoScreen() {
  return (
    <AppWin url="app.medicarepro.fr/patients/m-b/bilans/posturologie" side={<AppSide on="Bilans" />}>
      <AppHead title="Bilan postural" sub="M. B. · 34 ans · lombalgies récurrentes">
        <span className="chip ok">
          <AppIcon name="check" />
          Enregistré
        </span>
      </AppHead>
      <div className="bil-grid" style={{ gridTemplateColumns: "minmax(0,0.8fr) minmax(0,1.2fr)" }}>
        <div className="card">
          <h5>
            Vue de face <span className="chip grey">Fil à plomb</span>
          </h5>
          <svg className="posture" viewBox="0 0 160 250">
            <line className="plumb" x1="80" y1="6" x2="80" y2="244" />
            <circle className="body" cx="84" cy="30" r="15" />
            <path className="body" d="M84 45v16M52 70l32-9 32 5M84 61l-3 72M81 133l-22 5M81 133l24 3M59 138l-4 50-2 48M105 136l3 50 2 48" />
            <line className="tilt" x1="42" y1="71" x2="126" y2="62" pathLength={1} />
            <line className="tilt" x1="48" y1="140" x2="114" y2="134" pathLength={1} />
            <text x="130" y="60">
              3°
            </text>
            <text x="118" y="133">
              2°
            </text>
          </svg>
        </div>
        <div className="stack">
          <div className="sensors">
            {SENSORS.map(([icon, label, tone, status]) => (
              <div key={label} className="sensor">
                <AppIcon name={icon} />
                <b>{label}</b>
                <span className={`chip ${tone}`}>{status}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h5>Tests posturaux</h5>
            <Row label="Romberg" value="oscillations yeux fermés" />
            <Row label="Fukuda" value="rotation 40° à droite" />
            <Row label="Convergence oculaire" value="insuffisance gauche" />
            <Row label="Appui unipodal" value="12 s · 7 s" />
          </div>
        </div>
      </div>
    </AppWin>
  );
}

const VISITS: [string, string, string, string, string][] = [
  ["09:00", "Mme G.", "Soin de pédicurie", "ok", "Fait"],
  ["09:45", "M. P.", "Soin et bilan du pied", "ok", "Fait"],
  ["10:40", "Mme V.", "Soin de pédicurie", "", "En cours"],
  ["11:30", "M. H.", "Contrôle des semelles", "grey", "À venir"],
];

export function PwaScreen() {
  return (
    <AppWin url="app.medicarepro.fr/tournee" side={<AppSide on="Agenda" />}>
      <AppHead title="Tournée à domicile" sub="Jeudi 1er octobre · 4 patients">
        <span className="chip ok">
          <AppIcon name="refresh" />
          Synchronisé il y a 2 s
        </span>
      </AppHead>
      <div className="card" style={{ marginBottom: u(10) }}>
        <h5>Visites du jour</h5>
        {VISITS.map(([time, who, act, tone, status]) => (
          <div key={time} className="visit">
            <b>{time}</b>
            <span>
              <strong>{who}</strong> · {act}
            </span>
            <span className={`chip${tone ? ` ${tone}` : ""}`}>{status}</span>
          </div>
        ))}
      </div>
      <div className="g2">
        <div className="card">
          <h5>
            Documents scannés <span className="chip">Caméra</span>
          </h5>
          <Row label="Ordonnance · Mme G." value="09:12" />
          <Row label="Ordonnance · M. P." value="09:51" />
        </div>
        <div className="card">
          <h5>Application web (PWA)</h5>
          <Row label="Installée sur" value="tablette" />
          <Row label="Sauvegarde" value="en temps réel" />
        </div>
      </div>
    </AppWin>
  );
}
