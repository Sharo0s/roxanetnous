-- Bug UX 2026-04-29 : la filleule ne pouvait pas lire sa propre row dans
-- parrainages via le client RLS. Resultat : le bandeau "Verification
-- supplementaire en cours" ne s'affichait jamais sur son dashboard quand
-- son parrainage etait bloque par la detection anti-fraude.
--
-- On autorise la filleule a lire UNIQUEMENT ses propres rows. La marraine
-- garde aussi son acces via parrainages_marraine_read.

BEGIN;

DROP POLICY IF EXISTS "parrainages_filleule_read_own" ON public.parrainages;
CREATE POLICY "parrainages_filleule_read_own" ON public.parrainages
  FOR SELECT USING (auth.uid() = filleule_id);

COMMIT;
