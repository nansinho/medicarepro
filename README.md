# MediCare Pro — Site vitrine + Back office

Site vitrine de **MediCare Pro** (logiciel de gestion de cabinet pour podologues) et son **back office
d'administration** (CMS), construits en **Next.js 16** + **Supabase**.

> Ce dépôt = **site vitrine `medicarepro.fr`** uniquement (+ son admin).
> Le logiciel SaaS lui-même vit sur `app.medicarepro.fr` (dépôt séparé). Le bouton « Je m'abonne » de la
> vitrine redirige vers l'app.

## Stack

- **Next.js 16.2.9** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** + CSS Modules · **Framer Motion** + **Lenis** (animations / smooth scroll)
- **Supabase** (Postgres + Auth + Storage) — back office CMS *(en cours d'intégration)*
- Déploiement : **Coolify** sur **OVHcloud** (hébergement certifié **HDS**)

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

Voir [`.env.example`](.env.example). Principales :

- `NEXT_PUBLIC_APP_URL` — URL du logiciel SaaS (`https://app.medicarepro.fr`) vers lequel la vitrine
  redirige l'inscription / la connexion.
- *(à venir)* `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run lint` | ESLint |

## Structure

```
src/
├── app/
│   ├── (site)/        # Pages vitrine (accueil, tarifs, blog, contact…)
│   ├── layout.tsx     # Layout racine (fonts, metadata)
│   ├── robots.ts / sitemap.ts
│   └── globals.css    # Design system (thème bleu MediCare Pro)
├── components/        # Composants UI + sections
├── data/              # Données de contenu (features, bilans)
└── lib/               # Utilitaires (appLinks…)
```

## Roadmap

Le suivi détaillé (phases, back office, i18n, SEO, HDS) est dans [`MIGRATION.md`](MIGRATION.md).
