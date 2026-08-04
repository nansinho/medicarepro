-- ============================================================================
-- 0029 — portal_links : entrée du praticien dans son espace abonnement.
--
-- LE PROBLÈME QUE ÇA RÈGLE : la vitrine n'a aucune authentification client.
-- Le seul mécanisme existant, le lien de renouvellement, chiffre l'identifiant
-- de souscription SANS expiration, SANS usage unique et sans but déclaré : un
-- lien retrouvé dans une vieille boîte mail reste valable des années. On ne
-- généralise pas ce défaut à un espace qui permettra demain de changer de
-- carte, de formule, et de résilier.
--
-- MÉCANIQUE : l'application métier (dev B) appelle POST /api/portal/session
-- avec sa clé de provisioning, en transmettant le cabinet et son identité.
-- On crée ici une ligne, et le jeton remis n'est que son `jti` chiffré. Le
-- lien est valable quelques minutes et se consomme au premier usage ; la
-- session qui en découle vit dans un cookie chiffré, sans table.
--
-- Effet de bord précieux : l'app nous transmet son `cabinetId` et les
-- coordonnées du cabinet. La vitrine n'a donc PAS besoin d'une route de
-- recherche côté app (elle n'existe pas) pour savoir qui souscrit.
-- ============================================================================

create table if not exists public.portal_links (
  id             uuid primary key default gen_random_uuid(),
  -- Ce qui voyage (chiffré) dans l'URL. Jamais l'identifiant de la ligne.
  jti            uuid not null unique default gen_random_uuid(),

  -- Cible : le cabinet DANS l'application. C'est la clé de rattachement de
  -- tout ce que le portail permettra de faire.
  app_cabinet_id text not null,
  app_user_id    text,

  -- Identité transmise par l'app (nom, adresse, email admin…). Sert à
  -- pré-remplir la facturation d'une souscription : le cabinet existe depuis
  -- longtemps, il n'a aucune raison de resaisir ses coordonnées.
  -- ⚠️ Source NON faisant foi pour les MONTANTS : le prix reste calculé par la
  -- grille tarifaire de la vitrine, jamais par ce que l'app envoie.
  cabinet        jsonb not null default '{}'::jsonb,

  purpose        text not null default 'portal'
                   check (purpose in ('portal')),

  expires_at     timestamptz not null,
  consumed_at    timestamptz,
  -- Origine de la demande : 'app' (bouton du logiciel) ou 'admin' (lien émis
  -- depuis le back-office, seule voie tant que dev B n'a pas livré son bouton).
  created_via    text not null default 'app'
                   check (created_via in ('app', 'admin')),
  created_by     uuid,
  created_ip     text,
  created_at     timestamptz not null default now()
);

comment on table public.portal_links is
  'Liens d''entrée à usage unique vers l''espace abonnement du praticien (expirent en quelques minutes).';
comment on column public.portal_links.jti is
  'Identifiant public du lien : c''est lui, chiffré, qui voyage dans l''URL.';
comment on column public.portal_links.cabinet is
  'Identité transmise par l''application. Ne fait foi ni sur les prix ni sur la formule.';

-- File de purge des liens périmés.
create index if not exists portal_links_expiry_idx
  on public.portal_links (expires_at)
  where consumed_at is null;
create index if not exists portal_links_cabinet_idx
  on public.portal_links (app_cabinet_id, created_at desc);

-- Service-role uniquement (doctrine 0014) : un lien d'accès ne se lit pas
-- depuis un navigateur.
alter table public.portal_links enable row level security;
revoke all on table public.portal_links from anon, authenticated;
