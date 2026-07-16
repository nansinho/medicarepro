-- 0020 — Mandat SEPA optionnel dans le tunnel (flag CHECKOUT_SEPA_ENABLED).
-- Quand l'étape SEPA est coupée, aucun mandat n'est créé : les colonnes de
-- preuve du mandat sur pending_signups doivent accepter NULL (elles n'ont de
-- sens que lorsqu'un mandat existe). Sans ça, l'INSERT du dossier viole la
-- contrainte NOT NULL et l'inscription échoue (502).
-- Idempotent : DROP NOT NULL ne fait rien si la colonne est déjà nullable.

alter table public.pending_signups
  alter column mandate_text_version drop not null,
  alter column mandate_text_sha256  drop not null,
  alter column mandate_accepted_at  drop not null;
