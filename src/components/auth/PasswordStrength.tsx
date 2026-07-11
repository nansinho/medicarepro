"use client";

import s from "./Auth.module.css";

/** Calcule le score de robustesse (0–4) selon 4 critères. */
function getStrength(password: string) {
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
  };
  const score = Object.values(criteria).filter(Boolean).length;
  const levels = [
    { label: "Trop faible", color: "#e5484d", bg: "#fdecec", fg: "#b4332f" },
    { label: "Trop faible", color: "#e5484d", bg: "#fdecec", fg: "#b4332f" },
    { label: "Faible", color: "#f5821f", bg: "#fdeede", fg: "#9a5410" },
    { label: "Moyen", color: "#e0a800", bg: "#fbf3d4", fg: "#856404" },
    { label: "Fort", color: "#15a36b", bg: "#dff4ea", fg: "#0f7a4f" },
  ];
  return { score, criteria, ...levels[score] };
}

const CRITERIA: { key: "length" | "uppercase" | "lowercase" | "digit"; label: string }[] = [
  { key: "length", label: "8+ caractères" },
  { key: "uppercase", label: "Une majuscule" },
  { key: "lowercase", label: "Une minuscule" },
  { key: "digit", label: "Un chiffre" },
];

export default function PasswordStrength({ password }: { password: string }) {
  const strength = getStrength(password);
  const pct = (strength.score / 4) * 100;

  return (
    <div className={s.pwStrength}>
      <div className={s.pwBarRow}>
        <div className={s.pwTrack}>
          <div
            className={s.pwFill}
            style={{ width: `${pct}%`, background: strength.color }}
          />
        </div>
        <span
          className={s.pwBadge}
          style={{ background: strength.bg, color: strength.fg }}
        >
          {strength.label}
        </span>
      </div>
      <ul className={s.pwCriteria}>
        {CRITERIA.map(({ key, label }) => {
          const met = strength.criteria[key];
          return (
            <li key={key} className={met ? s.pwMet : undefined}>
              {met ? "✓" : "○"} {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
