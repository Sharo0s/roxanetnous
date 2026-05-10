-- Empeche les profils accompagnantes incomplets d'apparaitre dans la file de
-- validation admin.
--
-- Contexte : le trigger handle_new_user (auth.users INSERT) cree une ligne
-- vide dans accompagnantes_profiles des l'inscription. Avant cette migration,
-- le default de validation_status etait 'en_attente', donc le profil vide
-- atterrissait immediatement dans la file admin (/admin -> requete filtrant
-- ['en_attente', 'visio_a_planifier', 'visio_realisee']) et crashait la page
-- detail /admin/validation/[id] quand specialites IS NULL (TypeError sur
-- .map). Un profil orphelin existant (584418ac-d132-4500-8b7e-80bcbf3d36ef,
-- cree 2026-05-06) en a temoigne en prod.
--
-- Mecanisme :
-- 1. Default a 'a_completer' : tout profil cree par le trigger demarre
--    naturellement hors de la file admin. submitOnboarding (action
--    accompagnante.ts) ecrit explicitement 'en_attente' a la soumission,
--    donc le comportement applicatif ne change pas pour les nouveaux
--    inscrits qui completent leur profil.
-- 2. CHECK : tout profil hors 'a_completer' DOIT avoir les champs requis
--    par la file de validation (ville, code_postal, experience, specialites
--    non vide, diplomes non vide). Verrou BDD aligne avec les validations
--    deja presentes dans submitOnboarding mais qui peuvent etre contournees
--    via service role, scripts, ou edits manuels. Le statut 'a_completer'
--    reste libre pour la phase pre-onboarding.
-- 3. Backfill : le profil orphelin existant est repasse a 'a_completer'
--    (decision : ne pas le supprimer, l'utilisateur pourra completer plus
--    tard via /accompagnante/onboarding).

-- 1. Backfill avant CHECK pour eviter le rejet sur les lignes existantes
UPDATE public.accompagnantes_profiles
SET validation_status = 'a_completer'
WHERE validation_status <> 'a_completer'
  AND (
    ville IS NULL
    OR code_postal IS NULL
    OR experience IS NULL
    OR specialites IS NULL
    OR array_length(specialites, 1) IS NULL
    OR diplomes IS NULL
    OR array_length(diplomes, 1) IS NULL
  );

-- 2. Changer le default
ALTER TABLE public.accompagnantes_profiles
  ALTER COLUMN validation_status SET DEFAULT 'a_completer'::validation_status;

-- 3. Contrainte d'integrite : seul 'a_completer' tolere les champs vides.
-- 'valide' et 'refuse' inclus volontairement : un profil valide ne peut pas
-- avoir perdu ses donnees ; un profil refuse a forcement ete soumis avant.
ALTER TABLE public.accompagnantes_profiles
  ADD CONSTRAINT accompagnantes_profiles_completion_check CHECK (
    validation_status = 'a_completer'
    OR (
      ville IS NOT NULL
      AND code_postal IS NOT NULL
      AND experience IS NOT NULL
      AND specialites IS NOT NULL
      AND array_length(specialites, 1) > 0
      AND diplomes IS NOT NULL
      AND array_length(diplomes, 1) > 0
    )
  );

COMMENT ON CONSTRAINT accompagnantes_profiles_completion_check
  ON public.accompagnantes_profiles IS
  'Garantit qu''un profil hors a_completer a tous les champs requis pour la file de validation admin et l''affichage detail. Voir page.tsx /admin/validation/[id].';
