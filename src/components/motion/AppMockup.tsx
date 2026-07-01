"use client";

import { motion } from "framer-motion";
import { EASE, useIsReduced } from "./motion";
import s from "./appMockup.module.css";

export type MockupKind =
  | "invoice"
  | "signature"
  | "accounting"
  | "agenda"
  | "bilan"
  | "bilanChute"
  | "bilanPosturo"
  | "pwa"
  | "vitale"
  | "ai"
  | "portal"
  | "stats";

/**
 * Écran d'application factice et stylisé (placeholder), animé en douceur.
 * Pur CSS/SVG + Framer Motion — aucune image. Le `kind` change le contenu
 * pour évoquer la fonctionnalité illustrée.
 */
export default function AppMockup({ kind }: { kind: MockupKind }) {
  const reduced = useIsReduced();

  return (
    <div className={s.frame} aria-hidden>
      <div className={s.bar}>
        <span className={s.dot} />
        <span className={s.dot} />
        <span className={s.dot} />
        {/* Pastille « live » qui pulse en continu. */}
        <motion.span
          className={s.live}
          animate={reduced ? undefined : { opacity: [1, 0.35, 1] }}
          transition={
            reduced
              ? undefined
              : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>
      <div className={s.screen}>{renderBody(kind)}</div>
    </div>
  );
}

function renderBody(kind: MockupKind) {
  switch (kind) {
    case "invoice":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Facture</span>
            <span className={s.amount}>248,00 €</span>
          </div>
          <div className={s.invList}>
            {[
              { l: "Consultation podologique", p: "48,00 €" },
              { l: "Orthèses plantaires", p: "180,00 €" },
              { l: "Soin d'ongle incarné", p: "20,00 €" },
            ].map((row, i) => (
              <motion.div
                key={row.l}
                className={s.invRow}
                initial={{ opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: i * 0.12 }}
              >
                <span>{row.l}</span>
                <strong>{row.p}</strong>
              </motion.div>
            ))}
          </div>
          <motion.div
            className={s.stamp}
            initial={{ scale: 0, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: -12, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.8, repeat: Infinity, repeatDelay: 2.6 }}
          >
            Envoyée
          </motion.div>
        </>
      );
    case "signature":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Consentement de soin</span>
          </div>
          <div className={s.report}>
            {[
              "Je consens aux soins podologiques proposés",
              "et à la conservation de mon dossier médical.",
            ].map((t, i) => (
              <motion.p
                key={t}
                className={s.reportLine}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: i * 0.2 }}
              >
                {t}
              </motion.p>
            ))}
          </div>
          <span className={s.signLabel}>Signature du patient</span>
          <svg className={s.sign} viewBox="0 0 180 48">
            <motion.path
              d="M6 34 C 26 6, 40 6, 52 28 S 86 50, 100 24 124 8 150 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: false }}
              transition={{ duration: 1.6, ease: EASE, repeat: Infinity, repeatDelay: 1.6 }}
            />
          </svg>
        </>
      );
    case "accounting":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Comptabilité</span>
            <span className={s.tag}>FEC</span>
          </div>
          <div className={s.graph}>
            {[0.4, 0.7, 0.5, 0.85, 0.62, 0.95].map((h, i) => (
              <motion.span
                key={i}
                className={s.bar2}
                initial={{ scaleY: 0.2 }}
                whileInView={{ scaleY: [h, h * 0.7, h] }}
                viewport={{ once: true }}
                transition={{
                  duration: 2.4,
                  ease: "easeInOut",
                  delay: i * 0.12,
                  repeat: Infinity,
                  repeatType: "mirror",
                }}
              />
            ))}
          </div>
        </>
      );
    case "agenda": {
      const appts = [
        { t: "09:00", name: "M. Dubois", act: "Soin podologique", c: 0 },
        { t: "10:30", name: "Mme Bernard", act: "Bilan diabétique", c: 1 },
        { t: "14:00", name: "M. Leroy", act: "Orthèses plantaires", c: 2 },
        { t: "15:15", name: "Mme Petit", act: "Contrôle", c: 0 },
      ];
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Agenda · Lundi 14</span>
          </div>
          <div className={s.slots}>
            {appts.map((a, i) => (
              <motion.div
                key={a.t}
                className={s.appt}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.1 }}
              >
                <span className={s.time}>{a.t}</span>
                <span className={`${s.apptPill} ${s[`apptPill${a.c}`]}`}>
                  <strong>{a.name}</strong>
                  <span>{a.act}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </>
      );
    }
    case "bilan":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Bilan diabétique</span>
          </div>
          <div className={s.fieldList}>
            {[
              { l: "Monofilament", v: "4/10", ok: false },
              { l: "IPS", v: "0,9", ok: true },
              { l: "Pouls pédieux", v: "Présent", ok: true },
            ].map((f, i) => (
              <motion.div
                key={f.l}
                className={s.field}
                initial={{ opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: i * 0.12 }}
              >
                <span className={s.fieldLabel}>{f.l}</span>
                <motion.span
                  className={`${s.fieldVal} ${f.ok ? s.fieldOk : s.fieldWarn}`}
                  animate={f.ok ? undefined : { scale: [1, 1.08, 1] }}
                  transition={
                    f.ok
                      ? undefined
                      : {
                          duration: 1.4,
                          ease: "easeInOut",
                          repeat: Infinity,
                          repeatDelay: 0.8,
                        }
                  }
                >
                  {f.v}
                </motion.span>
              </motion.div>
            ))}
          </div>
          <motion.div
            className={s.score}
            initial={{ scale: 0.85, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
          >
            <span className={s.scoreLabel}>Grade de risque</span>
            <motion.span
              className={s.scoreVal}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{
                duration: 2.2,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 1.2,
              }}
            >
              2
            </motion.span>
          </motion.div>
        </>
      );
    case "bilanChute":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Bilan chutes</span>
            <span className={s.tag}>TUG · unipodal</span>
          </div>
          <div className={s.gauge}>
            <motion.span
              className={s.gaugeFill}
              initial={{ scaleX: 0, originX: 0 }}
              whileInView={{ scaleX: [0.74, 0.58, 0.74] }}
              viewport={{ once: true }}
              transition={{
                duration: 3,
                ease: "easeInOut",
                delay: 0.3,
                repeat: Infinity,
                repeatType: "mirror",
              }}
            />
          </div>
          <motion.div
            className={s.riskRow}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.8 }}
          >
            <span className={s.scoreLabel}>Risque de chute</span>
            <span className={s.riskTag}>Élevé</span>
          </motion.div>
        </>
      );
    case "bilanPosturo":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Bilan posturologie</span>
          </div>
          <div className={s.slots}>
            {["Romberg", "Test unipodal", "Fukuda", "Convergence"].map(
              (t, i) => (
                <motion.div
                  key={t}
                  className={s.check}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.14 }}
                >
                  <motion.span
                    className={s.checkDot}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: [1, 1.25, 1] }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 1.2,
                      ease: "easeInOut",
                      delay: 0.2 + i * 0.3,
                      repeat: Infinity,
                      repeatDelay: 2.4,
                    }}
                  >
                    ✓
                  </motion.span>
                  <span className={s.time}>{t}</span>
                </motion.div>
              ),
            )}
          </div>
        </>
      );
    case "vitale":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Carte Vitale</span>
            <span className={s.tag}>SESAM</span>
          </div>
          <motion.div
            className={s.vitaleCard}
            initial={{ rotateY: -18, opacity: 0 }}
            whileInView={{ rotateY: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <span className={s.vitaleChip} />
            <span className={s.vitaleName}>ASSURÉ · MediCare</span>
          </motion.div>
          <div className={s.fieldList}>
            {[
              { l: "Bénéficiaire", v: "Marie Bernard" },
              { l: "N° sécu", v: "2 85 06 75…" },
              { l: "Droits", v: "À jour", ok: true },
            ].map((f, i) => (
              <motion.div
                key={f.l}
                className={s.field}
                initial={{ opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.5 + i * 0.12 }}
              >
                <span className={s.fieldLabel}>{f.l}</span>
                <span
                  className={`${s.fieldVal} ${f.ok ? s.fieldOk : ""}`}
                  style={f.ok ? undefined : { background: "transparent", color: "var(--color-navy)" }}
                >
                  {f.v}
                </span>
              </motion.div>
            ))}
          </div>
        </>
      );
    case "ai": {
      const report = [
        "Motif : douleur talon gauche, gêne à la marche.",
        "Examen : hyperkératose plantaire, voûte affaissée.",
        "Bilan : appui pronateur, IPS normal.",
        "Conclusion : orthèses plantaires recommandées.",
      ];
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Compte-rendu IA</span>
            <motion.span
              className={s.tag}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              ✦ génération…
            </motion.span>
          </div>
          <div className={s.report}>
            {report.map((text, i) => (
              <motion.p
                key={text}
                className={s.reportLine}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.4 + i * 0.6 }}
              >
                {text}
              </motion.p>
            ))}
            {/* Curseur clignotant en fin de génération. */}
            <motion.span
              className={s.caret}
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          </div>
        </>
      );
    }
    case "portal":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Espace patient</span>
            <span className={s.tag}>Mme Bernard</span>
          </div>
          {/* Carte « prochain rendez-vous » mise en avant */}
          <motion.div
            className={s.apptCard}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className={s.apptLabel}>Prochain rendez-vous</span>
            <div className={s.apptRow}>
              <span className={s.apptDate}>
                <b>14</b>
                <small>juin</small>
              </span>
              <span className={s.apptInfo}>
                <strong>10:30 · Bilan podologique</strong>
                <span>Cabinet MediCare · 30 min</span>
              </span>
            </div>
          </motion.div>
          {/* Accès rapides */}
          <div className={s.portalLinks}>
            {[
              { ic: "📄", t: "Mes documents", n: "3" },
              { ic: "💬", t: "Messagerie", n: "1" },
            ].map((l, i) => (
              <motion.div
                key={l.t}
                className={s.portalItem}
                initial={{ opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.12 }}
              >
                <span className={s.portalEmoji}>{l.ic}</span>
                <span className={s.portalItemLabel}>{l.t}</span>
                <span className={s.portalBadge}>{l.n}</span>
              </motion.div>
            ))}
          </div>
        </>
      );
    case "stats":
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Statistiques</span>
          </div>
          <div className={s.graph}>
            {[0.5, 0.62, 0.55, 0.78, 0.7, 0.9].map((h, i) => (
              <motion.span
                key={i}
                className={s.bar2}
                initial={{ scaleY: 0.15 }}
                whileInView={{ scaleY: [h, h * 0.72, h] }}
                viewport={{ once: true }}
                transition={{
                  duration: 2.6,
                  ease: "easeInOut",
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatType: "mirror",
                }}
              />
            ))}
          </div>
          <motion.div
            className={s.field}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.5 }}
          >
            <span className={s.fieldLabel}>Chiffre d&apos;affaires · juin</span>
            <span className={`${s.fieldVal} ${s.fieldOk}`}>+12 %</span>
          </motion.div>
        </>
      );
    case "pwa":
    default:
      return (
        <>
          <div className={s.head}>
            <span className={s.chip}>Mes patients</span>
            <motion.span
              className={s.tag}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              ● synchronisé
            </motion.span>
          </div>
          <div className={s.pwaList}>
            {[
              { n: "Camille Besson", d: "Dossier · 12 docs" },
              { n: "Antoine Rivière", d: "Dossier · 8 docs" },
              { n: "Sarah Lemoine", d: "Dossier · 5 docs" },
            ].map((p, i) => (
              <motion.div
                key={p.n}
                className={s.pwaItem}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: i * 0.12 }}
              >
                <span className={s.pwaAvatar}>{p.n.charAt(0)}</span>
                <span className={s.pwaInfo}>
                  <strong>{p.n}</strong>
                  <span>{p.d}</span>
                </span>
              </motion.div>
            ))}
          </div>
          {/* Bouton « scanner un document » qui pulse. */}
          <motion.div
            className={s.scanBtn}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
          >
            <motion.span
              className={s.scanIcon}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              ⛶
            </motion.span>
            Scanner un document
          </motion.div>
        </>
      );
  }
}
