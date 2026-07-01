# MIGRATION.md — Site vitrine medicarepro.fr + Back office CMS

> ⚠️ **RECADRAGE (périmètre redéfini)** : ce projet n'est PLUS « migrer toute l'app SaaS ».
> Il couvre **le site vitrine `medicarepro.fr` + son back office d'admin (CMS)**.
> L'app SaaS (`app.medicarepro.fr`, repo `podiatry-patient-profile` Lovable/Vite) est **HORS périmètre**
> (on n'y touche pas ; elle sert de référence + cible d'une future passerelle).
> Le bouton « Je m'abonne » de la vitrine **redirige vers `app.medicarepro.fr/register`**.
> Plan directeur : `C:\Users\Nans-\.claude\plans\ya-pas-d-essai-gratuit-hazy-dolphin.md`.
>
> **Légende statut** : ⬜ à faire · 🟧 en cours · ✅ fait · ⏸️ bloqué/en attente.
> Mettre ce fichier à jour **à chaque phase**.

---

## Décisions d'architecture

| Sujet | Décision | Statut |
|---|---|---|
| Archi backend | **Next.js + Supabase self-host** (Auth + Postgres + Storage + API + RLS). Dev sur Supabase Cloud, bascule self-host avant prod. | ✅ acté |
| Composants UI | Reco : **shadcn/ui re-thémé bleu** pour écrans d'app riches ; CSS Modules conservés pour la vitrine. | ⏸️ à confirmer |
| Hébergement HDS | **OVHcloud Public Cloud (instance) en région HDS**, piloté via **Coolify** (méthode habituelle du client). Supabase self-host (service ~1-clic Coolify) + Next.js derrière Traefik/TLS. | ✅ acté |
| Certification HDS propre | **Non requise** — décision du client : **l'hébergement HDS d'OVH suffit** pour son cas (pas de certif HDS propre à l'éditeur). | ✅ acté (décision client) |
| Push GitHub | Rester **en local** pour l'instant. | ✅ acté |
| Prix | Sans engagement **29,88 € TTC** · Offre 12 mois **24,84 € TTC** (−17 %) · collaborateur **+15,00 € TTC** · secrétariat gratuit. Prix d'appel vitrine = **24,84 €**. | ✅ appliqué sur la vitrine |

### Synthèse HDS (recherche multi-sources vérifiée — voir détail plus bas)

- **Technique** : Coolify déploie Supabase (service ~1-clic) + Next.js sur instance OVH Public Cloud HDS. Coolify n'a **pas** à être certifié (seul l'hébergement l'est). ✅
- **OVH Public Cloud = certifié HDS** sur les activités 1-2-3-4-6 ; **activité 5 (exploitation du SI)** reste à notre charge (= Coolify/Supabase/app/chiffrement/audit/backups). C'est notre responsabilité applicative normale.
- **À faire côté OVH (avant prod)** : souscrire offre éligible HDS, signer addendum Healthcare + DPA, récupérer l'attestation HDS **à jour** (référentiel v2.0 / ISO 27001:2022 obligatoire depuis le 16/05/2026).
- **Mesures app obligatoires** : TLS partout, chiffrement au repos (+ champ médical sensible), auth forte/2FA, **RLS Postgres**, audit log, backups chiffrés **restant en zone HDS**, durées de conservation, droits RGPD (export/effacement/anonymisation).
- 🔴 **Point de vigilance n°1** : ne JAMAIS envoyer de données de santé vers un service tiers non-HDS (IA/Mistral, OCR, PDF, email/SMS) → prestataire HDS **ou** anonymiser/pseudonymiser avant.
- 🔴 **Pièges Supabase self-host** : régénérer TOUS les secrets avant 1er démarrage ; rotation JWT = coupure (fenêtre de maintenance) ; migrations non auto au update ; ne pas exposer Studio publiquement.

---

## Phases

> Roadmap REDÉFINIE (périmètre vitrine + back office). L'ancienne roadmap « migration app complète »
> (cœur cabinet, compta, école, portail, intégrations) est **abandonnée** (hors périmètre).

| Phase | Contenu | Statut |
|---|---|---|
| A | Recentrage vitrine : « Je m'abonne »/« Connexion » → `app.medicarepro.fr` ; retirer le faux flux auth | ✅ fait |
| B | Fondations Supabase (Docker self-host) + clients `@supabase/ssr` + `proxy.ts` + schéma SQL + seed | ⬜ |
| C | Auth admin (`/admin/login`, `proxy.ts` protège `/admin/*`) + shell back office (sidebar, dashboard) | ⬜ |
| D | Blog complet : éditeur Tiptap + `/admin/blog` + public `/blog/[slug]` (rendu JSON→HTML serveur) | ⬜ |
| E | i18n FR/EN (next-intl, `app/[lang]`, `/fr` `/en`, hreflang) + SEO local JSON-LD | ⬜ |
| F | Back office : SEO, pages, médias, traductions, admins/rôles, audit log | ⬜ |
| G | Passerelle vitrine ↔ app (plus tard) | ⬜ |
| H | Déploiement HDS (Coolify + Supabase self-host + OVH) avant prod | ⬜ |

> ⚙️ Conventions Next 16 actées : **`proxy.ts`** (pas `middleware.ts`), i18n via **`app/[lang]/`**,
> JSON-LD `<script>` sanitizé, Supabase `getUser()` (pas `getSession()`), Tiptap `immediatelyRender:false`
> + stockage JSON.

**Déjà fait (Phase 1 de l'ancien plan, à recycler/retirer)** : écrans `/register` `/login`
`/pending-approval` créés au design bleu → appartiennent à l'app, **deviennent une redirection** (Phase A).

---

## Inventaire des routes (cible Next.js App Router)

> Source = chemins du repo de réf. Cible = route Next.js (file-based). Notre vitrine existante est marquée ✅.

### Espace public (vitrine + légal)
| Route cible | Source réf | Composant cible | Statut |
|---|---|---|---|
| `/` | `/` | `app/page.tsx` (Accueil) | ✅ existe |
| `/a-propos` | `/features/*` | `app/a-propos/page.tsx` | ✅ existe |
| `/fonctionnalites` | `/features/fonctionnalites` | `app/fonctionnalites/page.tsx` | ✅ existe |
| `/blog`, `/blog/:slug` | idem | `app/blog/` | ✅ liste / ⬜ article |
| `/tarifs` | `/features/tarifs` | `app/tarifs/page.tsx` | ✅ existe |
| `/contact` | `/contact` | `app/contact/page.tsx` | ✅ existe |
| `/cgu`, `/mentions-legales`, `/confidentialite`, `/cookies` | idem | `app/(legal)/...` | ⬜ |

### Auth cabinet (Phase 1)
| Route cible | Source réf | Statut |
|---|---|---|
| `/register` (3 étapes, `?plan=`) | `/register` (`src/pages/Register.tsx`) | ✅ design bleu, interface seule |
| `/login` | `/login` (`src/pages/Login.tsx`) | ✅ design bleu, interface seule (2FA à venir Phase 2) |
| `/pending-approval` | `/pending-approval` (`src/pages/PendingApproval.tsx`) | ✅ design bleu |
| `/verify-email`, `/resend-verification` | idem | ⬜ |
| `/forgot-password`, `/reset-password` | idem | ⬜ |
| `/onboarding` | `/onboarding` | ⬜ |

> **Note structure** : pages publiques déplacées sous `app/(site)/` (layout Header/Footer), écrans
> d'auth sous `app/(auth)/` (layout nu plein écran). Composants : `src/components/auth/`
> (`RegisterFlow`, `LoginForm`, `PendingApprovalCard`, `PasswordStrength`, `Captcha`, `Auth.module.css`).
> Captcha = placeholder client (le vrai est WebGL serveur → Phase 2). SIRET lookup = non recréé (Phase 2).
>
> ⚠️ **Liens 404 à créer** (ajoutés au Header/PricingPage par l'utilisateur) : `/bilans`, `/securite`,
> `/avantages` — routes inexistantes pour l'instant.

### Cabinet — cœur (Phase 3)
| Route cible | Source réf | Statut |
|---|---|---|
| `/dashboard` | `/dashboard` | ⬜ |
| `/patients`, `/patient/new`, `/patient/:id`, `/patient/:id/edit` | idem | ⬜ |
| `/patient/:id/consultations` + new/view/edit/recap | idem | ⬜ |
| Bilans : `diabetic-assessment`, `fall-risk-assessment`, `podopediatric-assessment`, `posturologic-assessment` (+ recaps) | idem | ⬜ |
| `/agenda`, `/statistics`, `/aide` | idem | ⬜ |
| `/cabinet` (paramètres : info, users, acts, archived, password) | `/cabinet`, `/settings/*` | ⬜ |
| `/vitale/cps-auth` | idem | ⬜ |
| `/traceability`, `/traceability/new`, `/traceability/:id` | idem | ⬜ |

### Comptabilité (Phase 4) — sous `/accounting/*`
`dashboard, income, invoices(/:id), expenses, assets(/:id), regime, balance-sheet, snir, bank-statements,
bank-reconciliation, bank-accounts, rules, deadlines, tax-2035, das2` — ⬜

### École (Phase 5) — `/school-login`, `/school/*`
`dashboard, sessions(/new /:id), patients(/new /:id /:id/edit), teachers` — ⬜

### Session étudiant (Phase 5) — `/session/*`
`join(/:token), :sessionId, patients + consultations (lazy)` — ⬜

### Admin (Phase 7) — `/admin/*`
`login, dashboard, cabinets, users, schools, teachers, prospects, email-campaigns, sms-campaigns,
tickets, collaborator-requests, database, system-settings` — ⬜

### Portail patient (Phase 6) — `/portal/*`
`login, register, forgot/reset-password, appointments(/new), messages, documents, profile` — ⬜

### Page publique cabinet (Phase 6)
`/cabinet/:slug` (prise de RDV publique) — ⬜

---

## Variables d'environnement (réf → cible)

> Préfixe front : Vite `VITE_*` → Next `NEXT_PUBLIC_*`. Les secrets back **sans** préfixe public.

### Front (exposées navigateur)
| Réf | Cible Next | Rôle | Statut |
|---|---|---|---|
| (nouveau) | `NEXT_PUBLIC_APP_URL` | URL de l'app SaaS (`https://app.medicarepro.fr`) pour rediriger inscription/connexion | ✅ en place (`.env.local` + `.env.example`, helper `src/lib/appLinks.ts`) |
| (à venir) | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` | Supabase (Phase B) | ⬜ |
| `VITE_APP_LOCALE` | `NEXT_PUBLIC_APP_LOCALE` | langue figée (fr) | ⬜ |
| `VITE_BLOG_API_URL` | `NEXT_PUBLIC_BLOG_API_URL` | API blog publique | ⬜ |
| `VITE_VITALE_ENABLED` / `VITE_APCV_ENABLED` | `NEXT_PUBLIC_VITALE_ENABLED` / `NEXT_PUBLIC_APCV_ENABLED` | feature flags SESAM-Vitale | ⬜ |
| (nouveau) | `NEXT_PUBLIC_API_URL` ou `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | endpoint back | ⬜ |

### Back / secrets (à définir selon option backend)
| Réf | Rôle | Où l'obtenir | Statut |
|---|---|---|---|
| `DATABASE_URL`, `DB_*` | Postgres | self-host / Supabase | ⬜ |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_*_EXPIRES_IN` | tokens (si Option A/B ; remplacé par Supabase Auth si C) | généré | ⬜ |
| `BCRYPT_ROUNDS` | hash mdp (12) | — | ⬜ |
| `ENCRYPTION_KEY` | chiffrement AES-256 (secrets + médical en « mieux qu'eux ») | généré ≥32 car | ⬜ |
| `RATE_LIMIT_*`, `CORS_ORIGIN`, `LOG_LEVEL` | sécurité/infra | — | ⬜ |
| `SMTP_*` | envoi emails (factures, vérif) | fournisseur SMTP | ⬜ |
| `SMSMODE_API_KEY`, `SMS_DEFAULT_COUNTRY_CODE` | SMS (smsmode) | compte smsmode | ⬜ |
| `MISTRAL_API_KEY`, `MISTRAL_MODEL`, `MISTRAL_SYSTEM_PROMPT`, `LLM_*` | IA comptes-rendus | console Mistral | ⬜ |
| `DOCUMENSO_API_KEY`, `DOCUMENSO_API_URL`, `DOCUMENSO_WEBHOOK_SECRET` | signature électronique | Documenso auto-hébergé | ⬜ |
| `OCR_SERVICE_URL`, `OCR_WEBHOOK_SECRET`, `OCR_MOCK` | OCR relevés bancaires | service Python | ⬜ |
| `APCV_*`, `VITALE_ENV`, `LPS_NOM`, `LPS_VERSION` | SESAM-Vitale/ApCV (agréé CNDA) | dossier CNDA | ⬜ |
| `BRIDGE_SIGNATURE_PRIVATE_KEY` | open banking (Bridge) | compte Bridge | ⬜ |
| `BACKEND_INTERNAL_SECRET`, `BACKEND_PUBLIC_URL`, `BACKEND_PORT` | infra back | — | ⬜ |
| `PGADMIN_*` | admin DB (dev) | — | ⬜ |

---

## Points de branchement (front → back)

> À remplir au fur et à mesure. Tant que le backend n'est pas choisi (Phase 2), le front tourne sur **données mockées / envoi simulé**.

| Écran/action | Endpoint réf | Cible | Statut |
|---|---|---|---|
| Inscription (POST) | `POST /api/auth/register` | à définir (Supabase Auth ou API route) | ⬜ (Phase 1 = simulé) |
| Lookup SIRET | `GET /api/insee/siret/{siret}` | proxy API route Next (INSEE) | ⬜ |
| Captcha | `GET /api/auth/captcha` (WebGL) | à recréer (ou solution standard) | ⬜ |
| Login | `POST /api/auth/login` (+2FA) | Supabase Auth / API route | ⬜ |

---

## Écarts & améliorations vs l'app de référence

- 🔐 **HDS** : eux stockent le médical en clair → nous : chiffrement champ médical + hébergeur HDS + RLS.
- 💾 **Backups** : eux manuels → nous : automatiques chiffrés + rétention.
- 📜 **RGPD** : ajouter endpoints export (DSAR) / anonymisation / retrait consentement (absents chez eux).
- 💶 **Prix** : la prod a encore les anciens (24,90/19,92/+9,90) ; nous appliquons les nouveaux (29,88/24,84/+15,00).
- 🎨 **Design** : leur violet/teal → notre bleu MediCare Pro partout.
