-- ============================================================================
-- 0026 — Re-paiement self-service de l'offre annuelle.
--
-- L'offre 12 mois est un paiement UNIQUE : pour renouveler, le client re-paie.
-- Ce n'est PAS une nouvelle inscription (le compte existe déjà) : on encaisse
-- un nouveau paiement (TPE immédiat) puis on PROLONGE la souscription
-- existante de 12 mois, sans repasser par le provisioning.
--
-- Cette table isole les paiements de renouvellement du flux d'inscription :
-- l'IPN les reconnaît par leur référence et les route vers finalizeAnnualRenewal,
-- sans toucher record_monetico_ipn. Tant qu'aucun renouvellement n'est lancé,
-- la table reste vide et n'a AUCUN effet sur l'existant.
-- ============================================================================

create table if not exists public.subscription_renewals (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid not null references public.subscriptions (id) on delete cascade,
  monetico_reference  text not null unique
                        check (monetico_reference ~ '^[A-Z0-9]{12}$'),
  -- Date de commande (JJ/MM/AAAA) figée à l'ouverture — comme pour un achat.
  monetico_order_date text,
  amount_cents        int not null check (amount_cents > 0),
  currency            text not null default 'EUR',
  status              text not null default 'pending'
                        check (status in (
                          'pending',        -- formulaire ouvert, en attente du paiement
                          'paid',           -- IPN accepté
                          'extended',        -- souscription prolongée (terminal, idempotent)
                          'amount_mismatch' -- montant encaissé ≠ attendu → manuel
                        )),
  paid_at             timestamptz,
  -- Nouvelle fin de période appliquée à la souscription (trace).
  new_period_end      timestamptz,
  client_ip           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.subscription_renewals is
  'Paiements de renouvellement de l''offre annuelle (prolongent une souscription existante).';

create index subscription_renewals_sub_idx
  on public.subscription_renewals (subscription_id, created_at desc);

-- Service-role uniquement (comme le reste du billing) : RLS active, sans
-- policy, donc anon/authenticated n'y accèdent pas ; service_role la contourne.
alter table public.subscription_renewals enable row level security;

create trigger trg_subscription_renewals_updated_at
  before update on public.subscription_renewals
  for each row execute function public.set_updated_at();
