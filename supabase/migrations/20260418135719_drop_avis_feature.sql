-- Suppression de la fonctionnalité Avis
-- Motif : retrait pour raisons juridiques (diffamation, cadre AFNOR avis en ligne,
-- charge de modération non tenable). 7 lignes de test uniquement, aucune donnée
-- utilisateur réelle. Voir _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18.md

BEGIN;

-- 1. Retirer 'avis' de la contrainte CHECK sur signalements.cible_type
ALTER TABLE public.signalements DROP CONSTRAINT IF EXISTS signalements_cible_type_check;

-- 2. Supprimer les signalements qui ciblent des avis (sécurité, même si 0 ligne attendue)
DELETE FROM public.signalements WHERE cible_type = 'avis';

-- 3. Recréer la contrainte sans 'avis'
ALTER TABLE public.signalements
  ADD CONSTRAINT signalements_cible_type_check
  CHECK (cible_type IN ('user', 'annonce_accompagnante', 'annonce_accompagne', 'message'));

-- 4. Supprimer la table avis (CASCADE retire FK et policies associées)
DROP TABLE IF EXISTS public.avis CASCADE;

COMMIT;
