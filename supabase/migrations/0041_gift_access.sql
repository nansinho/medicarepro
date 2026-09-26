-- ============================================================
-- ACCÈS OFFERTS : une invitation personnelle, N mois sans rien payer.
--
-- Demandé par le dirigeant le 23/09/2026 (gagnants du quiz de l'été), et voulu
-- comme une vraie fonction plutôt qu'une manipulation à la main dans le
-- back-office de l'application : à la main, rien ne s'arrête à l'échéance,
-- personne n'est prévenu, et la conversion en abonné est laissée au hasard.
--
-- LE MONTAGE. Le back-office émet une invitation (email, durée, motif). Le lien
-- ouvre le tunnel d'inscription habituel ; la caisse Stripe ouvre alors un
-- abonnement en PÉRIODE D'ESSAI jusqu'au terme offert. C'est Stripe qui tient
-- l'horloge, et le logiciel la lit déjà par son propre webhook (`trialing` =
-- accès complet). À l'échéance :
--   - carte enregistrée : l'abonnement démarre, comme n'importe quelle échéance ;
--   - pas de carte      : Stripe résilie, le logiciel passe en lecture seule
--                         (jamais de coupure), et l'espace abonnement propose
--                         de souscrire.
--
-- CE QUI NE PEUT PAS SE PRODUIRE. Un dossier à 0 € sans invitation reste
-- interdit par la contrainte ci-dessous, et le webhook refuse toute session
-- non payée qui ne porte pas d'invitation. Le jeton du lien n'est jamais stocké
-- en clair : seule son empreinte l'est, comme un mot de passe.
-- ============================================================

create table if not exists public.gift_invitations (
  id                uuid primary key default gen_random_uuid(),
  -- Adresse du bénéficiaire, en minuscules : elle devient son identifiant de
  -- connexion, imposé dans le tunnel.
  email             text not null
                      check (email = lower(email) and position('@' in email) > 1),
  months            smallint not null check (months between 1 and 12),
  -- Pourquoi on offre (« Quiz de l'été 2026 ») : c'est ce qu'on relit six mois
  -- plus tard en se demandant d'où vient ce compte.
  reason            text not null check (char_length(btrim(reason)) between 1 and 200),
  -- Choisi à chaque invitation, jamais par défaut : c'est ce qui décide si
  -- l'accès se transforme seul en abonnement payant à l'échéance.
  require_card      boolean not null,
  token_hash        text not null unique,
  expires_at        timestamptz not null,
  status            text not null default 'pending'
                      check (status in (
                        'pending',  -- envoyée, pas encore utilisée
                        'claimed',  -- période offerte ouverte chez Stripe
                        'revoked'   -- retirée depuis le back-office
                      )),
  pending_signup_id uuid,
  subscription_id   uuid,
  app_cabinet_id    text,
  claimed_at        timestamptz,
  revoked_at        timestamptz,
  sent_count        smallint not null default 0,
  last_sent_at      timestamptz,
  created_by        uuid,
  created_by_email  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.gift_invitations is
  'Accès offerts : une invitation personnelle ouvre N mois sans paiement (période d''essai Stripe).';
comment on column public.gift_invitations.token_hash is
  'SHA-256 du jeton du lien. Le jeton lui-même n''est jamais conservé.';

create index if not exists gift_invitations_created_idx
  on public.gift_invitations (created_at desc);
create index if not exists gift_invitations_email_idx
  on public.gift_invitations (email);

drop trigger if exists trg_gift_invitations_updated_at on public.gift_invitations;
create trigger trg_gift_invitations_updated_at
  before update on public.gift_invitations
  for each row execute function public.set_updated_at();

-- Même posture que les autres tables de facturation (0014) : personne n'y lit
-- ni n'y écrit hors du rôle de service, back-office compris (il passe par le
-- serveur, après contrôle du rôle administrateur).
alter table public.gift_invitations enable row level security;
revoke all on table public.gift_invitations from anon, authenticated;

-- ------------------------------------------------------------
-- Le dossier d'inscription porte l'invitation jusqu'au contrat.
-- ------------------------------------------------------------
alter table public.pending_signups
  add column if not exists gift_invitation_id uuid references public.gift_invitations (id),
  add column if not exists gift_months        smallint check (gift_months between 1 and 12),
  -- Fin de la période offerte telle que présentée à la caisse. Conservée pour
  -- qu'une reprise de la caisse envoie EXACTEMENT les mêmes paramètres :
  -- Stripe refuse une requête idempotente dont un paramètre a changé.
  add column if not exists gift_ends_at       timestamptz;

-- Zéro euro n'est permis QUE sur un dossier porté par une invitation.
alter table public.pending_signups
  drop constraint if exists pending_signups_amount_cents_check;
alter table public.pending_signups
  add constraint pending_signups_amount_cents_check
  check (amount_cents > 0 or (amount_cents = 0 and gift_invitation_id is not null));

-- ------------------------------------------------------------
-- Le contrat sait qu'il a commencé par une période offerte, et jusqu'à quand.
-- C'est ce qui distingue « période offerte terminée sans suite » d'une
-- résiliation ordinaire, et ce que le cron de rappels balaie.
-- ------------------------------------------------------------
alter table public.subscriptions
  add column if not exists gift_invitation_id uuid references public.gift_invitations (id),
  add column if not exists gift_ends_at       timestamptz;

comment on column public.subscriptions.gift_ends_at is
  'Fin de la période offerte (trial_end Stripe). NULL pour un contrat payé dès le départ.';

create index if not exists subscriptions_gift_ends_idx
  on public.subscriptions (gift_ends_at)
  where gift_ends_at is not null;
