"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "@/components/icons";
import k from "./kit.module.css";
import s from "./city.module.css";

type City = { slug: string; name: string; region: string };

const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s'-]+/g, " ")
    .trim();

/**
 * Recherche d'une ville parmi les pages publiées. Une ville sans page
 * reçoit une réponse honnête : le logiciel fonctionne partout, en ligne.
 */
export default function CitySearch({ cities }: { cities: City[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = norm(String(new FormData(e.currentTarget).get("ville") ?? ""));
    if (!q) {
      setMsg("Saisissez le nom de votre ville.");
      return;
    }
    const hit = cities.find((c) => norm(c.name) === q) ?? cities.find((c) => norm(c.name).startsWith(q));
    if (hit) {
      router.push(`/logiciel-podologue/${hit.slug}`);
      return;
    }
    setMsg(
      "Pas encore de page pour cette ville. MediCare Pro fonctionne partout en France, 100 % en ligne : la mise en route se fait à distance.",
    );
  };

  return (
    <>
      <form className={s.search} role="search" onSubmit={onSubmit} autoComplete="off">
        <Search aria-hidden="true" />
        <label className={k.sr} htmlFor="ville-q">
          Votre ville
        </label>
        <input
          id="ville-q"
          name="ville"
          list="villes-publiees"
          placeholder="Votre ville, par exemple Lyon"
          onChange={() => setMsg("")}
        />
        <datalist id="villes-publiees">
          {cities.map((c) => (
            <option key={c.slug} value={c.name} />
          ))}
        </datalist>
        <button className={`${k.btn} ${k.primary}`} type="submit">
          Rechercher
        </button>
      </form>
      <p className={s.msg} aria-live="polite">
        {msg}
      </p>
    </>
  );
}
