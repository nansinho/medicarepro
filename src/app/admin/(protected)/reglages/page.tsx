import type { Metadata } from "next";
import { SETTINGS } from "@/data/content/site";
import { serviceClient } from "@/lib/supabase/service";
import {
  EDITABLE_SETTING_KEYS,
  LEGAL_ENTITY_DEFAULT,
  type EditableSettingKey,
} from "@/lib/admin/settings-forms";
import SettingsManager from "@/components/admin/settings/SettingsManager";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Réglages du site" };

/* Valeurs par défaut (fallback embarqué) de chaque clé éditable. */
function defaults(): Record<EditableSettingKey, unknown> {
  return {
    ...((SETTINGS as unknown) as Record<string, unknown>),
    legal_entity: LEGAL_ENTITY_DEFAULT,
  } as Record<EditableSettingKey, unknown>;
}

export default async function AdminReglagesPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Réglages du site</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : les réglages sont indisponibles sur cet
          environnement.
        </p>
      </>
    );
  }

  /* Valeurs actuelles : DB par-dessus fallback, clé par clé (même logique
     que le rendu public, mais via le service client, hors cache). */
  const base = defaults();
  const { data } = await service
    .from("site_settings")
    .select("key, value")
    .in("key", EDITABLE_SETTING_KEYS);
  const values = { ...base };
  for (const row of data ?? []) {
    if ((EDITABLE_SETTING_KEYS as string[]).includes(row.key)) {
      values[row.key as EditableSettingKey] = row.value;
    }
  }

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Réglages du site</h1>
        <p className={s.pageDesc}>Coordonnées, bandeau promo, pied de page, entité légale.</p>
      </header>
      <SettingsManager initialValues={values} />
    </>
  );
}
