import {
  formatDecimal,
  formatInt,
  formatSourceDate,
  RPPS_DATASET_URL,
  type CityLocalData,
} from "@/lib/cms/city-data";
import s from "./city.module.css";

/**
 * Chiffres réels de la ville (Annuaire Santé, INSEE), source citée.
 * Remplace la photo d'illustration de la page ville : c'est le contenu
 * propre à chaque ville, et le seul endroit où ces chiffres s'affichent
 * hors du texte.
 */
export default function CityFigures({
  data,
  nameLocative,
}: {
  data: CityLocalData;
  nameLocative: string;
}) {
  const { podologues, podologuesLiberaux, densite, departement, france } = data;
  const rows: { value: string; label: string; detail?: string }[] = [
    {
      value: formatInt(podologues),
      label:
        podologues === 0
          ? `pédicure-podologue recensé ${nameLocative}`
          : podologues === 1
            ? `pédicure-podologue exerce ${nameLocative}`
            : `pédicures-podologues exercent ${nameLocative}`,
      detail:
        podologues === 0
          ? undefined
          : podologuesLiberaux === podologues
            ? podologues === 1
              ? "en libéral"
              : "tous en libéral"
            : `dont ${formatInt(podologuesLiberaux)} en libéral`,
    },
  ];
  if (densite != null) {
    rows.push({
      value: formatDecimal(densite),
      label: "podologues pour 10 000 habitants",
      detail: `${departement.nom} : ${formatDecimal(departement.densite)} · France : ${formatDecimal(france.densite)}`,
    });
  }
  rows.push({ value: formatInt(data.population), label: "habitants" });

  return (
    <figure className={s.figures}>
      <figcaption className={s.figTitle}>La podologie {nameLocative} en chiffres</figcaption>
      <dl>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>
              {r.label}
              {r.detail && <small>{r.detail}</small>}
            </dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className={s.figSource}>
        Sources :{" "}
        <a href={RPPS_DATASET_URL} target="_blank" rel="noopener noreferrer">
          Annuaire Santé (RPPS)
        </a>
        , données du {formatSourceDate(data.sources.annuaireSante)} ; INSEE, population municipale.
      </p>
    </figure>
  );
}
