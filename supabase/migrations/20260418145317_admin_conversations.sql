-- Extension : conversations admin <-> accompagnante
-- Contexte : FR11quater (validation par visio) - la convocation et les echanges
-- admin se font desormais dans la messagerie interne, plus par email.

BEGIN;

-- 1. Rendre accompagne_id nullable (une conversation admin n'a pas d'accompagne)
ALTER TABLE public.conversations
  ALTER COLUMN accompagne_id DROP NOT NULL;

-- 2. Ajouter admin_id (utilisateur admin participant)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS admin_id UUID NULL REFERENCES public.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.conversations.admin_id IS
  'Admin participant - null sauf pour les conversations admin <-> accompagnante (FR11quater)';

-- 3. Contrainte XOR : soit accompagne_id, soit admin_id, jamais les deux, jamais aucun
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_participant_xor;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_participant_xor CHECK (
    (accompagne_id IS NOT NULL AND admin_id IS NULL)
    OR (accompagne_id IS NULL AND admin_id IS NOT NULL)
  );

-- 4. Remplacer l'ancienne contrainte UNIQUE par deux index partiels
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_auxiliaire_id_beneficiaire_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_aux_acc
  ON public.conversations (accompagnante_id, accompagne_id)
  WHERE accompagne_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_aux_admin
  ON public.conversations (accompagnante_id, admin_id)
  WHERE admin_id IS NOT NULL;

-- 5. Policies INSERT : autoriser l'admin a creer une conversation
DROP POLICY IF EXISTS conv_insert_own ON public.conversations;
CREATE POLICY conv_insert_own ON public.conversations
  FOR INSERT
  WITH CHECK (
    (accompagnante_id IN (
      SELECT id FROM public.accompagnantes_profiles WHERE user_id = auth.uid()
    ))
    OR (accompagne_id IN (
      SELECT id FROM public.accompagnes_profiles WHERE user_id = auth.uid()
    ))
    OR (admin_id = auth.uid() AND is_admin())
  );

-- 6. Policy INSERT messages : autoriser l'admin a envoyer un message dans SES conversations
DROP POLICY IF EXISTS msg_insert_own ON public.messages;
CREATE POLICY msg_insert_own ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT c.id FROM public.conversations c
      WHERE
        c.accompagnante_id IN (
          SELECT id FROM public.accompagnantes_profiles WHERE user_id = auth.uid()
        )
        OR c.accompagne_id IN (
          SELECT id FROM public.accompagnes_profiles WHERE user_id = auth.uid()
        )
        OR (c.admin_id = auth.uid() AND is_admin())
    )
  );

-- Note : les policies SELECT et UPDATE sur conversations et messages contiennent
-- deja "is_admin() OR ..." - donc l'admin voit et peut mettre a jour toutes les
-- conversations, y compris celles ou il n'est pas admin_id. C'est acceptable
-- puisque is_admin() est une autorisation de supervision totale.

COMMIT;
