# Supabase — MediCare Pro

Base de données du CMS (migrations `migrations/0001…0012`). Le seed (`seed.sql`)
sera généré par `scripts/generate-seed.ts` (phase suivante).

## Option A — Supabase Cloud (dev)

1. Créer un projet sur [supabase.com](https://supabase.com) (région UE : Francfort ou Paris).
2. **Settings → API** : copier les clés dans `.env.local` :

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
   SUPABASE_SERVICE_ROLE_KEY=eyJ…   # server-only, JAMAIS exposée au navigateur
   ```

3. Appliquer les migrations (la CLI n'est pas installée globalement → `npx`) :

   ```bash
   npx supabase init          # crée supabase/config.toml (ne touche pas migrations/)
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push       # applique migrations/ dans l'ordre
   ```

   Alternative sans CLI : coller le contenu des fichiers `migrations/0001…0012`
   **dans l'ordre** dans l'éditeur SQL du Studio.

## Option B — Local (Docker)

Prérequis : Docker Desktop en marche.

```bash
npx supabase init            # une seule fois (config.toml)
npx supabase start           # démarre Postgres + Auth + Storage + Studio locaux
npx supabase db reset        # rejoue TOUTES les migrations + seed.sql (idempotent)
```

`npx supabase start` affiche les URL/clés locales (API url, anon key, service_role key)
à recopier dans `.env.local`. Studio local : http://127.0.0.1:54323.

> `db reset` est la commande de référence : elle détruit la base locale, rejoue
> la chaîne `0001 → 0012` puis `seed.sql` s'il existe. À relancer après tout
> ajout de migration.

## Créer le premier admin

1. Créer l'utilisateur : Studio → **Authentication → Add user** (email + mot de passe),
   ou invitation par email.
2. Lui donner le rôle `admin` (le rôle autoritaire vit dans `app_metadata` du JWT ;
   `profiles.role` n'est qu'un miroir pour l'UI) :

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                           || '{"role": "admin"}'::jsonb
   where email = 'vous@exemple.fr';

   update public.profiles
   set role = 'admin'
   where email = 'vous@exemple.fr';
   ```

3. **Se déconnecter / reconnecter** : le rôle n'est pris en compte qu'à la
   régénération du JWT.

## Storage

Créer le bucket **`media`** (public read) : Studio → Storage → New bucket →
`media`, cocher « Public bucket ». Les policies d'upload (staff only) seront
ajoutées avec le module Médias.

## Notes RLS

- `anon` ne lit que le contenu publié ; les tables sensibles (contacts,
  newsletter, IA, GSC, audit, jobs) lui sont totalement fermées.
- La colonne `page_sections.draft` est invisible pour `anon` (privilèges de
  colonnes) : les fetchers publics doivent **lister leurs colonnes** (pas de
  `select('*')` sur `page_sections` côté vitrine).
- Les écritures publiques (formulaire contact, newsletter, log 404, compteurs
  de redirections) passent exclusivement par le **service-role** côté serveur.

## ⚠️ Self-host (Coolify / OVHcloud HDS) — rappels MIGRATION.md

- **Régénérer TOUS les secrets avant le premier démarrage** : JWT secret,
  clés `anon`/`service_role`, mots de passe Postgres et dashboard. Ne jamais
  garder les valeurs d'exemple du dépôt Supabase.
- **Rotation du JWT secret = coupure de service** (toutes les clés émises
  deviennent invalides) → planifier une fenêtre de maintenance.
- **Les migrations ne sont PAS rejouées automatiquement** lors des mises à jour
  de l'image Supabase : les appliquer explicitement à chaque déploiement.
- **Ne JAMAIS exposer Studio publiquement** (ni le port Postgres) : accès via
  tunnel/VPN uniquement, derrière Traefik rien ne doit router vers Studio.
