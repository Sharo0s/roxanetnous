
-- =============================================
-- REBUILD COMPLETE SCHEMA - roxanetnous
-- Part 1: ENUMs, Tables, Indexes, Triggers
-- =============================================

-- 1. ENUM TYPES
CREATE TYPE user_role AS ENUM ('auxiliaire', 'beneficiaire', 'admin');
CREATE TYPE validation_status AS ENUM ('en_attente', 'valide', 'refuse', 'a_completer');
CREATE TYPE annonce_status AS ENUM ('brouillon', 'publiee', 'archivee', 'suspendue');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE niveau_dependance AS ENUM ('forte', 'moderee', 'peu');
CREATE TYPE creneau_horaire AS ENUM ('matin', 'apres_midi', 'soir', 'nuit');
CREATE TYPE jour_semaine AS ENUM ('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche');

-- 2. TABLES

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  phone_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auxiliaires_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diplome TEXT,
  experience TEXT,
  specialites TEXT[],
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  rayon_km INTEGER,
  disponibilites JSONB,
  langues TEXT[],
  permis_conduire BOOLEAN DEFAULT false,
  vehicule BOOLEAN DEFAULT false,
  description TEXT,
  validation_status validation_status NOT NULL DEFAULT 'en_attente',
  validation_date TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id),
  refus_motif TEXT,
  justificatif_identite_url TEXT,
  justificatif_diplome_url TEXT,
  justificatifs_autres TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE beneficiaires_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status subscription_status NOT NULL DEFAULT 'trialing',
  plan_type TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  first_subscription_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE annonces_auxiliaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auxiliaire_id UUID NOT NULL REFERENCES auxiliaires_profiles(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  ville TEXT,
  code_postal TEXT,
  rayon_km INTEGER,
  disponibilites JSONB,
  status annonce_status NOT NULL DEFAULT 'brouillon',
  vues INTEGER NOT NULL DEFAULT 0,
  favoris_count INTEGER NOT NULL DEFAULT 0,
  contacts_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE annonces_beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiaire_id UUID NOT NULL REFERENCES beneficiaires_profiles(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  besoins_specifiques TEXT,
  specialites_recherchees TEXT[],
  ville TEXT,
  code_postal TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  diplome_requis TEXT,
  experience_min TEXT,
  niveau_dependance niveau_dependance,
  ouverture_aide TEXT,
  equipe_en_place TEXT,
  disponibilites JSONB,
  date_debut DATE,
  infos_complementaires TEXT,
  message_auxiliaires TEXT,
  status annonce_status NOT NULL DEFAULT 'brouillon',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE favoris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  annonce_auxiliaire_id UUID REFERENCES annonces_auxiliaires(id) ON DELETE CASCADE,
  annonce_beneficiaire_id UUID REFERENCES annonces_beneficiaires(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT favoris_one_fk CHECK (
    (annonce_auxiliaire_id IS NOT NULL AND annonce_beneficiaire_id IS NULL)
    OR (annonce_auxiliaire_id IS NULL AND annonce_beneficiaire_id IS NOT NULL)
  )
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auxiliaire_id UUID NOT NULL REFERENCES auxiliaires_profiles(id) ON DELETE CASCADE,
  beneficiaire_id UUID NOT NULL REFERENCES beneficiaires_profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  archived_by_auxiliaire BOOLEAN NOT NULL DEFAULT false,
  archived_by_beneficiaire BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auxiliaire_id, beneficiaire_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auteur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cible_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note INTEGER NOT NULL CHECK (note >= 1 AND note <= 5),
  commentaire TEXT,
  signale BOOLEAN NOT NULL DEFAULT false,
  masque BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auteur_id, cible_id)
);

CREATE TABLE signalements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auteur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cible_type TEXT NOT NULL CHECK (cible_type IN ('user', 'annonce_auxiliaire', 'annonce_beneficiaire', 'avis', 'message')),
  cible_id UUID NOT NULL,
  motif TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'traite', 'ignore')),
  traite_par UUID REFERENCES users(id),
  traite_at TIMESTAMPTZ,
  decision TEXT CHECK (decision IN ('suspendu', 'supprime', 'averti', 'ignore')),
  notes_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  type TEXT NOT NULL,
  subject TEXT,
  template TEXT,
  data JSONB,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE badges_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  annonce_active BOOLEAN NOT NULL DEFAULT false,
  anciennete TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auxiliaire_profile_id UUID NOT NULL REFERENCES auxiliaires_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('identite', 'diplome', 'autre')),
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  extracted_data JSONB,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  coherence_diplome BOOLEAN,
  coherence_identite BOOLEAN,
  alerts TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES

CREATE INDEX idx_auxiliaires_profiles_ville ON auxiliaires_profiles(ville);
CREATE INDEX idx_auxiliaires_profiles_code_postal ON auxiliaires_profiles(code_postal);
CREATE INDEX idx_auxiliaires_profiles_specialites ON auxiliaires_profiles USING GIN(specialites);
CREATE INDEX idx_auxiliaires_profiles_validation_status ON auxiliaires_profiles(validation_status);

CREATE INDEX idx_annonces_auxiliaires_status ON annonces_auxiliaires(status);
CREATE INDEX idx_annonces_auxiliaires_published_at ON annonces_auxiliaires(published_at DESC);

CREATE INDEX idx_annonces_beneficiaires_status ON annonces_beneficiaires(status);
CREATE INDEX idx_annonces_beneficiaires_ville ON annonces_beneficiaires(ville);
CREATE INDEX idx_annonces_beneficiaires_specialites ON annonces_beneficiaires USING GIN(specialites_recherchees);
CREATE INDEX idx_annonces_beneficiaires_published_at ON annonces_beneficiaires(published_at DESC);

CREATE INDEX idx_conversations_auxiliaire ON conversations(auxiliaire_id);
CREATE INDEX idx_conversations_beneficiaire ON conversations(beneficiaire_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_first_date ON subscriptions(first_subscription_date);
CREATE INDEX idx_badges_cache_user ON badges_cache(user_id);

CREATE INDEX idx_notifications_log_user ON notifications_log(user_id);
CREATE INDEX idx_notifications_log_created ON notifications_log(created_at DESC);

-- 4. HELPER FUNCTIONS (in public schema)

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_auxiliaire()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'auxiliaire'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_beneficiaire()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'beneficiaire'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid() AND status IN ('active', 'trialing')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_auxiliaire_id UUID,
  p_beneficiaire_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE auxiliaire_id = p_auxiliaire_id AND beneficiaire_id = p_beneficiaire_id;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (auxiliaire_id, beneficiaire_id)
    VALUES (p_auxiliaire_id, p_beneficiaire_id)
    ON CONFLICT (auxiliaire_id, beneficiaire_id) DO NOTHING
    RETURNING id INTO v_conversation_id;

    IF v_conversation_id IS NULL THEN
      SELECT id INTO v_conversation_id
      FROM conversations
      WHERE auxiliaire_id = p_auxiliaire_id AND beneficiaire_id = p_beneficiaire_id;
    END IF;
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGERS (updated_at)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON auxiliaires_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON beneficiaires_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON annonces_auxiliaires FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON annonces_beneficiaires FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON badges_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_conversation_last_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Trigger: create user profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'beneficiaire'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'beneficiaire') = 'auxiliaire' THEN
    INSERT INTO public.auxiliaires_profiles (user_id)
    VALUES (NEW.id);
  ELSE
    INSERT INTO public.beneficiaires_profiles (user_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
