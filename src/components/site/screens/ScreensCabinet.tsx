import { AppHead, AppIcon, AppSide, AppWin, FootSole, Row, u } from "./core";

/* ============================================================
   Écrans du quotidien du cabinet : agenda, bilan du pied
   diabétique, orthèses plantaires, facturation, compte-rendu
   assisté par IA, comptabilité.
   ============================================================ */

type Ev = { kind: "soin" | "bilan" | "orth" | "dom"; top: number; h: number; title: string; who?: string };

const WEEK: Ev[][] = [
  [
    { kind: "soin", top: 2, h: 37, title: "Soin de pédicurie", who: "Patient A." },
    { kind: "bilan", top: 54, h: 50, title: "Bilan postural", who: "M. B." },
    { kind: "soin", top: 117, h: 26, title: "Soin" },
    { kind: "orth", top: 158, h: 37, title: "Essayage orthèses", who: "M. R." },
  ],
  [{ kind: "dom", top: 28, h: 180, title: "Tournée à domicile", who: "4 patients · tablette" }],
  [
    { kind: "bilan", top: 54, h: 37, title: "Bilan diabétique", who: "Mme D." },
    { kind: "soin", top: 106, h: 24, title: "Soin" },
    { kind: "soin", top: 132, h: 24, title: "Soin" },
    { kind: "orth", top: 171, h: 37, title: "Moulage orthèses", who: "Patient C." },
  ],
  [
    { kind: "soin", top: 2, h: 24, title: "Soin" },
    { kind: "bilan", top: 41, h: 37, title: "Bilan sport", who: "M. L." },
    { kind: "bilan", top: 106, h: 50, title: "Bilan pédiatrie", who: "Enfant E." },
    { kind: "soin", top: 184, h: 24, title: "Soin" },
  ],
  [
    { kind: "soin", top: 28, h: 37, title: "Soin de pédicurie", who: "Patient F." },
    { kind: "orth", top: 80, h: 50, title: "Délivrance orthèses", who: "M. R." },
    { kind: "dom", top: 158, h: 50, title: "Soins à domicile", who: "2 patients" },
  ],
];

export function AgendaScreen() {
  return (
    <AppWin url="app.medicarepro.fr/agenda" side={<AppSide on="Agenda" />}>
      <AppHead title="Agenda" sub="Semaine du 28 septembre · 2 praticiens">
        <span className="mbtn alt">Semaine</span>
        <span className="mbtn">
          <AppIcon name="plus" />
          Rendez-vous
        </span>
      </AppHead>
      <div className="cal">
        <div className="cal-h" />
        {[
          ["Lun", "28"],
          ["Mar", "29"],
          ["Mer", "30"],
          ["Jeu", "1"],
          ["Ven", "2"],
        ].map(([d, n]) => (
          <div key={d} className="cal-h">
            {d}
            <b>{n}</b>
          </div>
        ))}
        <div className="cal-t">
          {["08:00", "09:00", "10:00", "11:00", "12:00"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {WEEK.map((day, i) => (
          <div key={i} className="cal-d">
            {day.map((ev) => (
              <div
                key={ev.top + ev.title}
                className={`ev ${ev.kind}`}
                style={{ top: u(ev.top), height: u(ev.h) }}
              >
                <b>{ev.title}</b>
                {ev.who}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="cal-legend">
        <span>
          <i style={{ background: "#EDF4FE", border: "1px solid #8DB6F5" }} />
          Soins
        </span>
        <span>
          <i style={{ background: "#DDEAFD", border: "1px solid #2B6FD6" }} />
          Bilans
        </span>
        <span>
          <i style={{ background: "#133F86" }} />
          Orthèses
        </span>
        <span>
          <i style={{ background: "#E9EEF5", border: "1px solid #8593A8" }} />
          Domicile
        </span>
        <span style={{ marginLeft: "auto" }}>
          <AppIcon name="check" style={{ width: u(13), height: u(13), color: "#1F8A5B" }} />
          Rappels J-2 envoyés
        </span>
      </div>
    </AppWin>
  );
}

function Site({ x, y, state }: { x: number; y: number; state?: "ko" }) {
  return (
    <g className={`site${state ? ` ${state}` : ""}`}>
      <circle className="halo" cx={x} cy={y} r="12" />
      <circle className="dot" cx={x} cy={y} r="6.5" />
    </g>
  );
}

export function BilanScreen() {
  return (
    <AppWin
      url="app.medicarepro.fr/patients/mme-d/bilans/diabetique"
      side={<AppSide on="Bilans" />}
    >
      <AppHead title="Bilan pied diabétique" sub="Mme D. · 67 ans · diabète de type 2 · bilan de suivi">
        <span className="chip ok">
          <AppIcon name="check" />
          Enregistré
        </span>
        <span className="mbtn alt">Comparer</span>
      </AppHead>
      <div className="bil-grid">
        <div className="card">
          <h5>
            Monofilament 10 g <span className="chip grey">3 sites par pied</span>
          </h5>
          <svg className="feet" viewBox="0 0 300 312">
            <g transform="translate(24,4)">
              <FootSole />
              <Site x={88} y={30} />
              <Site x={93} y={88} />
              <Site x={27} y={94} />
            </g>
            <g transform="translate(276,4) scale(-1,1)">
              <FootSole />
              <Site x={88} y={30} />
              <Site x={93} y={88} />
              <Site x={27} y={94} state="ko" />
            </g>
            <text className="lbl" x="86" y="309" textAnchor="middle">
              GAUCHE 3/3
            </text>
            <text className="lbl" x="214" y="309" textAnchor="middle">
              DROIT 2/3
            </text>
          </svg>
          <div className="legend">
            <span>
              <i />
              Perçu
            </span>
            <span>
              <i className="k" />
              Non perçu
            </span>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h5>Vasculaire</h5>
            <Row label="IPS gauche" value="1,02" />
            <Row label="IPS droit" value="0,97" />
            <Row label="Pouls pédieux" value="perçus" />
          </div>
          <div className="card">
            <h5>Examen du pied</h5>
            <Row label="Déformation" value="non" />
            <Row label="Antécédent d'ulcération" value="non" />
          </div>
          <div className="card grade">
            <h5>
              Gradation du risque <span className="chip">Auto</span>
            </h5>
            <div className="grade-v">
              <b>Grade 1</b>
              <span>Neuropathie sensitive isolée</span>
            </div>
            <div className="scale4">
              <i />
              <i className="on" />
              <i />
              <i />
            </div>
            <div className="scale4-l">
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
            </div>
          </div>
        </div>
      </div>
    </AppWin>
  );
}

export function OrthoScreen() {
  return (
    <AppWin url="app.medicarepro.fr/patients/m-r/ortheses/2" side={<AppSide on="Orthèses" />}>
      <AppHead title="Orthèses plantaires" sub="M. R. · paire n° 2 · prescrite le 14/09">
        <span className="chip">Délivrance le 02/10</span>
      </AppHead>
      <div className="bil-grid">
        <div className="card">
          <h5>
            Éléments posés <span className="chip grey">Pied gauche</span>
          </h5>
          <svg className="insole" viewBox="0 0 280 300" style={{ width: "100%", height: "auto", display: "block" }}>
            <g transform="translate(80,4)">
              <path
                className="sole"
                d="M62 282C37 282 29 257 31 232C33 202 27 176 21 146C15 118 12 90 16 64C20 36 40 14 64 12C90 10 106 32 107 70C108 100 97 124 89 146C83 164 85 188 89 210C93 238 91 282 62 282Z"
              />
              <ellipse className="el" cx="61" cy="250" rx="21" ry="24" />
              <path className="el" d="M24 102C45 95 82 95 104 102L103 114C82 107 45 107 25 114Z" />
              <path className="el2" d="M72 222C84 223 89 238 89 252C88 266 80 273 72 274Z" />
            </g>
            <path className="ln" d="M184 107H206" />
            <text x="210" y="104">BRC</text>
            <text x="210" y="116">3 mm</text>
            <path className="ln" d="M169 246H206" />
            <text x="210" y="243">Coin sup.</text>
            <text x="210" y="255">4 mm</text>
            <path className="ln" d="M120 262H70" />
            <text x="66" y="259" textAnchor="end">
              Talonnette
            </text>
            <text x="66" y="271" textAnchor="end">
              EVA 25 Sh
            </text>
          </svg>
        </div>
        <div className="stack">
          <div className="card">
            <h5>Traçabilité</h5>
            <Row label="Base" value="EVA 45 Shore" />
            <Row label="Recouvrement" value="microfibre" />
            <Row label="Lot" value="L-2609-114" />
          </div>
          <div className="card">
            <h5>Suivi de l&apos;appareillage</h5>
            <div className="steps">
              <div className="d">Empreinte</div>
              <div className="d">Fabrication</div>
              <div className="c">Délivrance</div>
              <div>Contrôle</div>
            </div>
          </div>
          <div className="card">
            <h5>Portail patient</h5>
            <Row label="Visible par M. R." value="oui" />
          </div>
        </div>
      </div>
    </AppWin>
  );
}

const INVOICES: [string, string, string, string, [string, string]][] = [
  ["F-2026-0412", "Mme D.", "Bilan pied diabétique", "45,00 €", ["", "Envoyée"]],
  ["F-2026-0411", "M. R.", "Orthèses plantaires (paire)", "180,00 €", ["ok", "Payée"]],
  ["F-2026-0410", "Patient A.", "Soin de pédicurie", "38,00 €", ["ok", "Payée"]],
  ["F-2026-0409", "Patient F.", "Soin à domicile", "45,00 €", ["warn", "Relance J+7"]],
  ["F-2026-0408", "M. B.", "Bilan postural", "60,00 €", ["ok", "Payée"]],
];

export function InvoiceScreen() {
  return (
    <AppWin url="app.medicarepro.fr/facturation" side={<AppSide on="Facturation" />}>
      <AppHead title="Facturation" sub="Septembre 2026">
        <span className="mbtn alt">Export comptable</span>
      </AppHead>
      <div className="toast">
        <AppIcon name="check" />
        <span>
          Facture <b>F-2026-0412</b> générée à la clôture du bilan et envoyée à Mme D.
        </span>
      </div>
      <div className="g3" style={{ marginBottom: u(12) }}>
        <div className="kpi">
          <small>Encaissé ce mois</small>
          <b>4 812 €</b>
        </div>
        <div className="kpi">
          <small>En attente</small>
          <b>186 €</b>
        </div>
        <div className="kpi">
          <small>Factures émises</small>
          <b>138</b>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>N°</th>
            <th>Patient</th>
            <th>Acte</th>
            <th>Montant</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {INVOICES.map(([n, who, act, amount, [tone, status]], i) => (
            <tr key={n} className={i === 0 ? "new" : undefined}>
              <td className="n">{n}</td>
              <td>{who}</td>
              <td>{act}</td>
              <td className="n">{amount}</td>
              <td>
                <span className={`chip${tone ? ` ${tone}` : ""}`}>{status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppWin>
  );
}

export function AiScreen() {
  return (
    <AppWin url="app.medicarepro.fr/patients/patient-a/compte-rendu" side={<AppSide on="Patients" />}>
      <AppHead title="Compte-rendu de consultation" sub="Patient A. · consultation du 28/09">
        <span className="chip warn">
          <AppIcon name="spark" />
          Brouillon IA à valider
        </span>
      </AppHead>
      <div className="bil-grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)" }}>
        <div className="dict">
          <div className="dict-h">
            <span className="rec" />
            Observations dictées
          </div>
          Douleur talon droit au premier lever depuis trois mois. Palpation douloureuse à
          l&apos;insertion de l&apos;aponévrose. Hyperkératose sous M2 M3 à droite. Pied pronateur à
          la marche, FPI plus 8. Proposer orthèses sur moulage, étirements, revoir dans six
          semaines.
        </div>
        <div className="card cr">
          <h6>Motif</h6>
          <p>Talalgie droite matinale évoluant depuis trois mois.</p>
          <h6>Examen clinique</h6>
          <p>
            Douleur à la palpation de l&apos;insertion calcanéenne de l&apos;aponévrose plantaire.
            Hyperkératose en regard des têtes métatarsiennes 2 et 3 droites. Pied pronateur à la
            marche (FPI-6 : +8).
          </p>
          <h6>Conduite à tenir</h6>
          <p>
            Orthèses plantaires sur moulage, étirements du triceps sural, conseils de chaussage.
            Contrôle à six semaines.
            <span className="caret" />
          </p>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: u(6), marginTop: u(12) }}>
        <span className="mbtn alt">Modifier</span>
        <span className="mbtn">
          <AppIcon name="check" />
          Valider et joindre au dossier
        </span>
      </div>
    </AppWin>
  );
}

/* Histogramme recettes / dépenses (milliers d'euros), janvier à septembre. */
const REC = [4.4, 4.7, 5.1, 4.8, 5.0, 4.6, 3.8, 3.3, 5.58];
const DEP = [1.5, 1.3, 1.4, 1.6, 1.4, 1.3, 1.5, 1.2, 1.74];

function MonthChart() {
  const x0 = 36;
  const x1 = 412;
  const y0 = 140;
  const top = 14;
  const sy = (y0 - top) / 6;
  const gw = (x1 - x0) / 9;
  return (
    <svg className="chart" viewBox="0 0 420 166" style={{ width: "100%", height: "auto", display: "block" }}>
      {[0, 2, 4, 6].map((val) => {
        const y = y0 - val * sy;
        return (
          <g key={val}>
            <line className="gl" x1={x0} x2={x1} y1={y} y2={y} />
            <text x={x0 - 6} y={y + 3.5} textAnchor="end">
              {val ? `${val} k` : "0"}
            </text>
          </g>
        );
      })}
      {REC.map((r, i) => {
        const gx = x0 + i * gw + gw / 2;
        return (
          <g key={i}>
            <rect className="b1" x={gx - 14} y={y0 - r * sy} width="13" height={r * sy} rx="2.5" />
            <rect className="b2" x={gx + 1} y={y0 - DEP[i] * sy} width="13" height={DEP[i] * sy} rx="2.5" />
            <text x={gx} y={y0 + 16} textAnchor="middle">
              {"JFMAMJJAS"[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function AccountingScreen() {
  const legend = (color: string) => ({
    display: "inline-block",
    width: u(9),
    height: u(9),
    borderRadius: u(2),
    background: color,
    marginRight: u(5),
  });
  return (
    <AppWin url="app.medicarepro.fr/comptabilite" side={<AppSide on="Comptabilité" />}>
      <AppHead title="Comptabilité" sub="Exercice 2026 · au 26 septembre">
        <span className="mbtn alt">Grand livre</span>
        <span className="mbtn">Export FEC</span>
      </AppHead>
      <div className="g3" style={{ marginBottom: u(12) }}>
        <div className="kpi">
          <small>Recettes</small>
          <b>41 280 €</b>
        </div>
        <div className="kpi">
          <small>Dépenses</small>
          <b>12 940 €</b>
        </div>
        <div className="kpi">
          <small>Résultat</small>
          <b>28 340 €</b>
        </div>
      </div>
      <div className="card">
        <h5>
          Recettes et dépenses par mois
          <span style={{ display: "flex", gap: u(10), textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
            <span>
              <i style={legend("#2B6FD6")} />
              Recettes
            </span>
            <span>
              <i style={legend("#BCD3F5")} />
              Dépenses
            </span>
          </span>
        </h5>
        <MonthChart />
      </div>
      <div className="card" style={{ marginTop: u(10) }}>
        <h5>
          Dernières écritures <span className="chip">Mapping PCG auto</span>
        </h5>
        <Row label="706 · Prestations de services" value="5 580,00 €" />
        <Row label="6061 · Fournitures non stockables" value="312,40 €" />
      </div>
    </AppWin>
  );
}
