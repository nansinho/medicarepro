-- ============================================================
-- 0035 — Une facture peut vivre chez Stripe.
--
-- CE QUI S'EST PASSÉ. Le 05/08/2026, la première souscription Stripe a produit
-- DEUX factures pour un seul paiement : celle de Stripe, et la nôtre
-- (MP-F-2026-0008). Deux numérotations, deux pièces, un seul encaissement.
--
-- Le client a choisi que Stripe facture. Notre table reste néanmoins le registre
-- que lisent l'espace du praticien et le back-office : on y garde donc une ligne
-- par facture, mais elle pointe vers le document hébergé au lieu d'un PDF
-- archivé dans notre bucket.
--
-- POURQUOI RELÂCHER `pdf_path` PLUTÔT QUE D'Y METTRE L'URL. Ranger une adresse
-- HTTP dans une colonne qui a toujours désigné un chemin de bucket ferait mentir
-- la colonne, et le premier code qui tenterait d'en signer l'accès échouerait
-- sans qu'on comprenne pourquoi. Une facture a désormais SOIT un PDF chez nous,
-- SOIT une adresse chez Stripe, et la contrainte l'exige.
--
-- Ré-exécutable.
-- ============================================================

alter table public.invoices alter column pdf_path drop not null;
alter table public.invoices alter column pdf_sha256 drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_document_present_check'
  ) then
    alter table public.invoices add constraint invoices_document_present_check
      check (
        (pdf_path is not null and pdf_sha256 is not null)
        or hosted_invoice_url is not null
      );
  end if;
end;
$$;

comment on column public.invoices.pdf_path is
  'Chemin dans le bucket privé billing. NULL quand la facture est hébergée par le prestataire (voir hosted_invoice_url).';
comment on column public.invoices.hosted_invoice_url is
  'Adresse de la facture hébergée par Stripe. NULL quand le PDF est archivé chez nous.';

-- Le type de pièce doit couvrir la reconduction, écrite par le miroir Stripe.
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint where conname = 'invoices_kind_check';
  if def is null or def not like '%card_renewal%' then
    alter table public.invoices drop constraint if exists invoices_kind_check;
    alter table public.invoices add constraint invoices_kind_check
      check (kind in ('card_first', 'card_renewal', 'sdd_renewal', 'credit_note'));
  end if;
end;
$$;
