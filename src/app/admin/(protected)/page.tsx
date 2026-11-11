import { redirect } from "next/navigation";

/* ============================================================
   /admin : l'accueil du back-office est le cockpit du contenu.

   Cette adresse portait le tableau de bord de facturation. Depuis le
   10 novembre 2026 la vitrine ne gère plus que le site (contenu,
   référencement, actualités) : abonnements, accès offerts, incidents
   et factures se suivent dans la console du logiciel. On garde
   l'adresse, parce que la connexion et les favoris y mènent.
   ============================================================ */

export default function AdminIndex(): never {
  redirect("/admin/contenu");
}
