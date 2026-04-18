---
title: "Architecture Technique - roxanetnous"
date: 2026-02-09
author: Sylvain
version: 1.0
status: Reviewed (15 findings corrigés — review adversariale 2026-02-10)
source: product-brief-roxanetnous-2026-02-09.md
---

# Architecture Technique : roxanetnous

**Plateforme de mise en relation auxiliaires de vie vérifiés ↔ bénéficiaires**

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Stack Technique](#stack-technique)
3. [Schéma Base de Données](#schéma-base-de-données)
4. [Row Level Security (RLS)](#row-level-security-rls)
5. [Architecture API](#architecture-api)
6. [Flow de Données](#flow-de-données)
7. [Système de Badges](#système-de-badges)
8. [Matching Intelligent](#matching-intelligent)
9. [Notifications Email](#notifications-email)
10. [Stockage Fichiers](#stockage-fichiers)
11. [Jobs & Automatisations](#jobs--automatisations)
12. [Sécurité & RGPD](#sécurité--rgpd)

---

## Vue d'Ensemble

### Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│                                                             │
│  Next.js 15 (App Router) + React + TypeScript + Tailwind  │
│  - Pages (routing)                                         │
│  - Components (UI)                                         │
│  - Server Actions (mutations)                              │
│  - API Routes (webhooks, cron jobs)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       VERCEL EDGE                           │
│  - Déploiement automatique (CI/CD)                         │
│  - Edge Functions                                          │
│  - Variables d'environnement                               │
└─────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│       SUPABASE            │  │        STRIPE             │
│                           │  │                           │
│ - Postgres (DB)           │  │ - Checkout                │
│ - Auth (roles)            │  │ - Customer Portal         │
│ - Storage (justificatifs) │  │ - Webhooks                │
│ - Realtime (chat)         │  │ - Abonnements             │
│ - RLS (sécurité)          │  └───────────────────────────┘
└───────────────────────────┘
                 │
                 ▼
┌───────────────────────────┐
│   SERVICES EXTERNES       │
│                           │
│ - OCR (validation docs)   │
│ - Email (Resend/SendGrid) │
│ - PDF (jsPDF/Puppeteer)   │
└───────────────────────────┘
```

---

## Stack Technique

### Frontend
- **Framework :** Next.js 15 (App Router)
- **UI Library :** React 18+
- **Language :** TypeScript
- **Styling :** TailwindCSS
- **Icons :** lucide-react
- **Forms :** React Hook Form + Zod (validation)
- **State :** Zustand (global) + React Query (server state)

### Backend
- **Database :** Supabase Postgres
- **Auth :** Supabase Auth (multi-rôles)
- **Storage :** Supabase Storage (justificatifs, contrats)
- **Realtime :** Supabase Realtime (chat WebSocket)
- **API :** Next.js API Routes + Server Actions

### Paiements
- **Provider :** Stripe
- **Features :** Checkout, Customer Portal, Webhooks, Subscriptions

### Déploiement
- **Hosting :** Vercel
- **CI/CD :** Automatique (push → deploy)
- **Edge :** Edge Functions pour performance

### Services Tiers
- **OCR :** Tesseract.js ou Google Vision API
- **Email :** Resend ou SendGrid
- **PDF :** jsPDF ou Puppeteer
- **Analytics :** Vercel Analytics

---

## Schéma Base de Données

### Tables Principales

```sql
-- ENUM Types
CREATE TYPE user_role AS ENUM ('auxiliaire', 'beneficiaire', 'admin');
CREATE TYPE validation_status AS ENUM ('en_attente', 'visio_a_planifier', 'visio_realisee', 'valide', 'refuse', 'a_completer');
CREATE TYPE annonce_status AS ENUM ('brouillon', 'publiee', 'archivee', 'suspendue');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE aide_sociale_type AS ENUM ('aucune', 'pch', 'apa');
CREATE TYPE niveau_dependance AS ENUM ('forte', 'moderee', 'peu');
CREATE TYPE creneau_horaire AS ENUM ('matin', 'apres_midi', 'soir', 'nuit');
CREATE TYPE jour_semaine AS ENUM ('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche');

-- Table: users (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,              -- chiffré AES-256 (réversible pour affichage)
  phone_hash TEXT,         -- hash SHA-256 salé (pour recherche/détection doublons)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: auxiliaires_profiles
CREATE TABLE public.auxiliaires_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Profil structuré
  diplome TEXT NOT NULL, -- valeurs : 'auxiliaire_gerontologie', 'de_auxiliaire_vie', etc.
  experience TEXT NOT NULL, -- 'moins_3_ans', '3_10_ans', 'plus_10_ans'
  specialites TEXT[] NOT NULL, -- array des 14 spécialités

  -- Tarification
  tarif_horaire DECIMAL(5,2) NOT NULL,
  modulation_pch BOOLEAN DEFAULT FALSE,
  modulation_apa BOOLEAN DEFAULT FALSE,

  -- Localisation
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  rayon_km INTEGER DEFAULT 10,

  -- Disponibilités horaires (pour matching)
  disponibilites JSONB, -- format: {jour: [créneaux]} ou {flexible: true}

  -- Informations complémentaires
  langues TEXT[],
  permis_conduire BOOLEAN DEFAULT FALSE,
  vehicule BOOLEAN DEFAULT FALSE,
  description TEXT,

  -- Validation
  validation_status validation_status DEFAULT 'en_attente',
  validation_date TIMESTAMPTZ,
  validated_by UUID REFERENCES public.users(id),
  refus_motif TEXT,
  visio_date TIMESTAMPTZ NULL,         -- FR11bis : date de la visio de validation
  visio_notes TEXT NULL,               -- FR11bis : notes libres après la visio

  -- Justificatifs (URLs Supabase Storage)
  justificatif_identite_url TEXT,
  justificatif_diplome_url TEXT,
  justificatifs_autres TEXT[], -- array d'URLs

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: beneficiaires_profiles
CREATE TABLE public.beneficiaires_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Informations de base
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: subscriptions (abonnements Stripe)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,

  -- Stripe
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Détails abonnement
  status subscription_status NOT NULL DEFAULT 'trialing',
  plan_type TEXT NOT NULL, -- 'monthly' ou 'annual'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Période de lancement (mois offerts)
  trial_end TIMESTAMPTZ,

  -- Dates
  first_subscription_date TIMESTAMPTZ DEFAULT NOW(), -- pour calcul badges ancienneté
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: annonces_auxiliaires
CREATE TABLE public.annonces_auxiliaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auxiliaire_id UUID REFERENCES public.auxiliaires_profiles(id) ON DELETE CASCADE,

  -- Contenu
  titre TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Localisation (héritée du profil mais peut être affinée)
  ville TEXT,
  code_postal TEXT,
  rayon_km INTEGER DEFAULT 10,

  -- Tarifs et disponibilités
  tarif_min DECIMAL(5,2),
  tarif_max DECIMAL(5,2),
  disponibilites JSONB, -- format: {jour: [créneaux]}

  -- Statut
  status annonce_status DEFAULT 'brouillon',

  -- Statistiques
  vues INTEGER DEFAULT 0,
  favoris_count INTEGER DEFAULT 0,
  contacts_count INTEGER DEFAULT 0,

  -- Dates
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: annonces_beneficiaires
CREATE TABLE public.annonces_beneficiaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beneficiaire_id UUID REFERENCES public.beneficiaires_profiles(id) ON DELETE CASCADE,

  -- Contenu de base
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  besoins_specifiques TEXT,

  -- Spécialités recherchées
  specialites_recherchees TEXT[] NOT NULL,

  -- Localisation
  ville TEXT NOT NULL,
  code_postal TEXT,
  latitude DECIMAL(10,8),  -- géocodé à la publication via API Nominatim
  longitude DECIMAL(11,8), -- géocodé à la publication via API Nominatim

  -- Budget
  tarif_max DECIMAL(5,2) NOT NULL,
  aide_sociale aide_sociale_type DEFAULT 'aucune',

  -- Profil auxiliaire souhaité (optionnel)
  diplome_requis TEXT,
  experience_min TEXT,

  -- Qualification du besoin
  niveau_dependance niveau_dependance NOT NULL,
  ouverture_aide TEXT NOT NULL, -- valeurs prédéfinies
  equipe_en_place TEXT NOT NULL, -- valeurs prédéfinies

  -- Disponibilités horaires (format structuré)
  disponibilites JSONB NOT NULL, -- {jour: [créneaux]} ou {flexible: true}

  -- Dates
  date_debut DATE NOT NULL,

  -- Messages
  infos_complementaires TEXT,
  message_auxiliaires TEXT,

  -- Statut
  status annonce_status DEFAULT 'brouillon',

  -- Dates
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: favoris
CREATE TABLE public.favoris (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,

  -- Polymorphique: peut être une annonce auxiliaire ou bénéficiaire
  annonce_auxiliaire_id UUID REFERENCES public.annonces_auxiliaires(id) ON DELETE CASCADE,
  annonce_beneficiaire_id UUID REFERENCES public.annonces_beneficiaires(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: un seul type d'annonce
  CONSTRAINT favoris_check CHECK (
    (annonce_auxiliaire_id IS NOT NULL AND annonce_beneficiaire_id IS NULL) OR
    (annonce_auxiliaire_id IS NULL AND annonce_beneficiaire_id IS NOT NULL)
  ),

  -- Unique: un user ne peut pas favoriser 2 fois la même annonce
  UNIQUE(user_id, annonce_auxiliaire_id),
  UNIQUE(user_id, annonce_beneficiaire_id)
);

-- Table: conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auxiliaire_id UUID REFERENCES public.auxiliaires_profiles(id) ON DELETE CASCADE,
  beneficiaire_id UUID REFERENCES public.beneficiaires_profiles(id) ON DELETE CASCADE,

  -- Dernière activité (pour tri)
  last_message_at TIMESTAMPTZ DEFAULT NOW(),

  -- Statut
  archived_by_auxiliaire BOOLEAN DEFAULT FALSE,
  archived_by_beneficiaire BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique: une seule conversation entre un auxiliaire et un bénéficiaire
  UNIQUE(auxiliaire_id, beneficiaire_id)
);

-- Fonction helper: Créer ou récupérer une conversation existante (gère la concurrence)
-- Utilise ON CONFLICT pour éviter les erreurs de doublons en cas de requêtes simultanées.
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_auxiliaire_id UUID,
  p_beneficiaire_id UUID
) RETURNS UUID AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Tenter de trouver la conversation existante
  SELECT id INTO conv_id
  FROM conversations
  WHERE auxiliaire_id = p_auxiliaire_id AND beneficiaire_id = p_beneficiaire_id;

  -- Si elle n'existe pas, la créer (avec ON CONFLICT pour la concurrence)
  IF conv_id IS NULL THEN
    INSERT INTO conversations (auxiliaire_id, beneficiaire_id)
    VALUES (p_auxiliaire_id, p_beneficiaire_id)
    ON CONFLICT (auxiliaire_id, beneficiaire_id) DO NOTHING
    RETURNING id INTO conv_id;

    -- Si ON CONFLICT a été déclenché, récupérer l'ID existant
    IF conv_id IS NULL THEN
      SELECT id INTO conv_id
      FROM conversations
      WHERE auxiliaire_id = p_auxiliaire_id AND beneficiaire_id = p_beneficiaire_id;
    END IF;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table: messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Contenu
  content TEXT NOT NULL,

  -- Metadata
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: contrats
CREATE TABLE public.contrats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parties
  auxiliaire_id UUID REFERENCES public.auxiliaires_profiles(id) ON DELETE CASCADE,
  beneficiaire_id UUID REFERENCES public.beneficiaires_profiles(id) ON DELETE CASCADE,

  -- Détails
  prestations TEXT[] NOT NULL,
  tarif DECIMAL(5,2) NOT NULL,
  horaires JSONB NOT NULL,
  date_debut DATE NOT NULL,
  duree TEXT,

  -- Fichier PDF généré (chemin Storage, PAS une URL signée — l'URL est générée à la demande)
  pdf_storage_path TEXT,

  -- Signatures (optionnel)
  signe_auxiliaire BOOLEAN DEFAULT FALSE,
  signe_beneficiaire BOOLEAN DEFAULT FALSE,
  signe_auxiliaire_at TIMESTAMPTZ,
  signe_beneficiaire_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: signalements
-- NOTE ARCHITECTURE : cible_id est polymorphique (pas de FK possible).
-- L'intégrité est vérifiée côté application via une fonction de validation
-- qui vérifie que (cible_type, cible_id) pointe vers un enregistrement existant
-- AVANT l'insertion. Un job CRON hebdomadaire nettoie les signalements orphelins.
CREATE TABLE public.signalements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Auteur
  auteur_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Cible (polymorphique — pas de FK, validé côté application)
  cible_type TEXT NOT NULL CHECK (cible_type IN ('user', 'annonce_auxiliaire', 'annonce_beneficiaire', 'message')),
  cible_id UUID NOT NULL,

  -- Détails
  motif TEXT NOT NULL,
  description TEXT,

  -- Traitement
  status TEXT DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'traite', 'ignore')),
  traite_par UUID REFERENCES public.users(id),
  traite_at TIMESTAMPTZ,
  decision TEXT CHECK (decision IS NULL OR decision IN ('suspendu', 'supprime', 'averti', 'ignore')),
  notes_admin TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: notifications_log (historique des notifications email envoyées)
CREATE TABLE public.notifications_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Destinataire
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,

  -- Type de notification
  type TEXT NOT NULL, -- 'matching_pch', 'matching_apa', 'nouveau_message', 'validation', etc.

  -- Contenu
  subject TEXT NOT NULL,
  template TEXT,
  data JSONB,

  -- Statut envoi
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: badges_cache (cache des badges calculés pour performance)
CREATE TABLE public.badges_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Badges
  annonce_active BOOLEAN DEFAULT FALSE,
  anciennete TEXT, -- '1_an', '3_ans', '5_ans', null
  tarif_modulable_pch BOOLEAN DEFAULT FALSE,
  tarif_modulable_apa BOOLEAN DEFAULT FALSE,

  -- Dernière mise à jour
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: admin_actions_log (traçabilité actions admin)
CREATE TABLE public.admin_actions_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Action
  action_type TEXT NOT NULL, -- 'validation', 'refus', 'suspension', 'consultation_justificatif', 'visio_planifiee', 'visio_realisee', etc.
  target_type TEXT NOT NULL, -- 'auxiliaire', 'annonce', 'user', etc.
  target_id UUID NOT NULL,

  -- Détails
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes pour Performance

```sql
-- Indexes pour recherche et matching
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

-- Indexes pour conversations et messages
CREATE INDEX idx_conversations_auxiliaire ON conversations(auxiliaire_id);
CREATE INDEX idx_conversations_beneficiaire ON conversations(beneficiaire_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Indexes pour abonnements et badges
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_first_date ON subscriptions(first_subscription_date);

CREATE INDEX idx_badges_cache_user ON badges_cache(user_id);

-- Indexes pour notifications
CREATE INDEX idx_notifications_log_user ON notifications_log(user_id);
CREATE INDEX idx_notifications_log_created ON notifications_log(created_at DESC);
```

---

## Row Level Security (RLS)

### Philosophie de Sécurité

**Principe :** Chaque utilisateur ne peut accéder qu'à SES données ou aux données publiques autorisées.

**Stratégie RLS :**
1. **Enable RLS** sur toutes les tables publiques
2. **Policies spécifiques** par rôle (auxiliaire, bénéficiaire, admin)
3. **Fonctions helper** pour simplifier les policies
4. **Audit trail** pour actions sensibles

### Fonctions Helper

```sql
-- Fonction: récupérer le user_id connecté
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID AS $$
  SELECT auth.uid()
$$ LANGUAGE SQL STABLE;

-- Fonction: récupérer le rôle de l'user connecté
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Fonction: vérifier si user est admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE SQL STABLE;

-- Fonction: vérifier si user est auxiliaire
CREATE OR REPLACE FUNCTION auth.is_auxiliaire()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'auxiliaire'
  )
$$ LANGUAGE SQL STABLE;

-- Fonction: vérifier si user est bénéficiaire
CREATE OR REPLACE FUNCTION auth.is_beneficiaire()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'beneficiaire'
  )
$$ LANGUAGE SQL STABLE;

-- Fonction: vérifier si user a abonnement actif (inclut trialing pour périodes d'essai/lancement)
CREATE OR REPLACE FUNCTION auth.has_active_subscription()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid() AND status IN ('active', 'trialing')
  )
$$ LANGUAGE SQL STABLE;
```

### RLS Policies par Table

```sql
-- ======================
-- TABLE: users
-- ======================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: users peuvent lire leur propre profil
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (id = auth.uid());

-- Policy: users peuvent mettre à jour leur propre profil
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- Policy: admins peuvent lire tous les users
CREATE POLICY "users_read_admin" ON public.users
  FOR SELECT USING (auth.is_admin());

-- ======================
-- TABLE: auxiliaires_profiles
-- ======================
ALTER TABLE public.auxiliaires_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: auxiliaires peuvent lire leur propre profil
CREATE POLICY "auxiliaires_read_own" ON public.auxiliaires_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Policy: auxiliaires peuvent mettre à jour leur profil (sauf champs validation)
CREATE POLICY "auxiliaires_update_own" ON public.auxiliaires_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: auxiliaires peuvent créer leur profil
CREATE POLICY "auxiliaires_insert_own" ON public.auxiliaires_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid() AND auth.is_auxiliaire());

-- Policy: bénéficiaires avec abonnement actif peuvent voir profils validés
CREATE POLICY "auxiliaires_read_validated_by_beneficiaires" ON public.auxiliaires_profiles
  FOR SELECT USING (
    validation_status = 'valide'
    AND auth.is_beneficiaire()
    AND auth.has_active_subscription()
  );

-- Policy: admins peuvent tout lire et modifier
CREATE POLICY "auxiliaires_admin_full" ON public.auxiliaires_profiles
  FOR ALL USING (auth.is_admin());

-- ======================
-- TABLE: beneficiaires_profiles
-- ======================
ALTER TABLE public.beneficiaires_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: bénéficiaires peuvent lire leur propre profil
CREATE POLICY "beneficiaires_read_own" ON public.beneficiaires_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Policy: bénéficiaires peuvent mettre à jour leur profil
CREATE POLICY "beneficiaires_update_own" ON public.beneficiaires_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: bénéficiaires peuvent créer leur profil
CREATE POLICY "beneficiaires_insert_own" ON public.beneficiaires_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid() AND auth.is_beneficiaire());

-- Policy: admins peuvent tout lire
CREATE POLICY "beneficiaires_admin_read" ON public.beneficiaires_profiles
  FOR SELECT USING (auth.is_admin());

-- ======================
-- TABLE: subscriptions
-- ======================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: users peuvent lire leur propre abonnement (champs non sensibles uniquement)
-- NOTE : côté application, ne jamais exposer stripe_customer_id ni stripe_subscription_id
-- au frontend. Utiliser un Server Action qui filtre les colonnes retournées.
CREATE POLICY "subscriptions_read_own" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Policy: admins peuvent tout lire
CREATE POLICY "subscriptions_admin_read" ON public.subscriptions
  FOR SELECT USING (auth.is_admin());

-- IMPORTANT : Les webhooks Stripe DOIVENT utiliser createClient({ serviceRole: true })
-- Le service_role bypass le RLS. Toujours vérifier la signature Stripe AVANT
-- d'effectuer toute opération en service_role pour éviter les injections.
-- Pas de policy INSERT/UPDATE pour les utilisateurs normaux sur cette table.

-- ======================
-- TABLE: annonces_auxiliaires
-- ======================
ALTER TABLE public.annonces_auxiliaires ENABLE ROW LEVEL SECURITY;

-- Policy: auxiliaires peuvent gérer leurs propres annonces
CREATE POLICY "annonces_aux_manage_own" ON public.annonces_auxiliaires
  FOR ALL USING (
    auxiliaire_id IN (
      SELECT id FROM public.auxiliaires_profiles WHERE user_id = auth.uid()
    )
  );

-- Policy: bénéficiaires avec abonnement peuvent voir annonces publiées
CREATE POLICY "annonces_aux_read_published" ON public.annonces_auxiliaires
  FOR SELECT USING (
    status = 'publiee'
    AND auth.is_beneficiaire()
    AND auth.has_active_subscription()
  );

-- Policy: admins peuvent tout voir
CREATE POLICY "annonces_aux_admin_read" ON public.annonces_auxiliaires
  FOR SELECT USING (auth.is_admin());

-- ======================
-- TABLE: annonces_beneficiaires
-- ======================
ALTER TABLE public.annonces_beneficiaires ENABLE ROW LEVEL SECURITY;

-- Policy: bénéficiaires peuvent gérer leurs propres annonces
CREATE POLICY "annonces_ben_manage_own" ON public.annonces_beneficiaires
  FOR ALL USING (
    beneficiaire_id IN (
      SELECT id FROM public.beneficiaires_profiles WHERE user_id = auth.uid()
    )
  );

-- Policy: auxiliaires validés avec abonnement peuvent voir annonces publiées
CREATE POLICY "annonces_ben_read_published" ON public.annonces_beneficiaires
  FOR SELECT USING (
    status = 'publiee'
    AND auth.is_auxiliaire()
    AND auth.has_active_subscription()
    AND EXISTS (
      SELECT 1 FROM public.auxiliaires_profiles
      WHERE user_id = auth.uid() AND validation_status = 'valide'
    )
  );

-- Policy: admins peuvent tout voir
CREATE POLICY "annonces_ben_admin_read" ON public.annonces_beneficiaires
  FOR SELECT USING (auth.is_admin());

-- ======================
-- TABLE: favoris
-- ======================
ALTER TABLE public.favoris ENABLE ROW LEVEL SECURITY;

-- Policy: users peuvent gérer leurs propres favoris
CREATE POLICY "favoris_manage_own" ON public.favoris
  FOR ALL USING (user_id = auth.uid());

-- ======================
-- TABLE: conversations
-- ======================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policy: auxiliaires peuvent voir conversations où ils sont participants
CREATE POLICY "conversations_auxiliaire" ON public.conversations
  FOR SELECT USING (
    auxiliaire_id IN (
      SELECT id FROM public.auxiliaires_profiles WHERE user_id = auth.uid()
    )
  );

-- Policy: bénéficiaires peuvent voir conversations où ils sont participants
CREATE POLICY "conversations_beneficiaire" ON public.conversations
  FOR SELECT USING (
    beneficiaire_id IN (
      SELECT id FROM public.beneficiaires_profiles WHERE user_id = auth.uid()
    )
  );

-- Policy: création de conversation (auxiliaire ou bénéficiaire)
CREATE POLICY "conversations_create" ON public.conversations
  FOR INSERT WITH CHECK (
    (
      auth.is_auxiliaire() AND
      auxiliaire_id IN (SELECT id FROM public.auxiliaires_profiles WHERE user_id = auth.uid())
    ) OR (
      auth.is_beneficiaire() AND
      beneficiaire_id IN (SELECT id FROM public.beneficiaires_profiles WHERE user_id = auth.uid())
    )
  );

-- ======================
-- TABLE: messages
-- ======================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: lecture messages si participant à la conversation
CREATE POLICY "messages_read_participant" ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE
        auxiliaire_id IN (SELECT id FROM public.auxiliaires_profiles WHERE user_id = auth.uid())
        OR beneficiaire_id IN (SELECT id FROM public.beneficiaires_profiles WHERE user_id = auth.uid())
    )
  );

-- Policy: envoi message si participant + auteur
CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE
        auxiliaire_id IN (SELECT id FROM public.auxiliaires_profiles WHERE user_id = auth.uid())
        OR beneficiaire_id IN (SELECT id FROM public.beneficiaires_profiles WHERE user_id = auth.uid())
    )
  );

-- ======================
-- TABLE: contrats
-- ======================
ALTER TABLE public.contrats ENABLE ROW LEVEL SECURITY;

-- Policy: auxiliaires peuvent voir leurs contrats
CREATE POLICY "contrats_read_auxiliaire" ON public.contrats
  FOR SELECT USING (
    auxiliaire_id IN (SELECT id FROM public.auxiliaires_profiles WHERE user_id = auth.uid())
  );

-- Policy: bénéficiaires peuvent voir leurs contrats
CREATE POLICY "contrats_read_beneficiaire" ON public.contrats
  FOR SELECT USING (
    beneficiaire_id IN (SELECT id FROM public.beneficiaires_profiles WHERE user_id = auth.uid())
  );

-- Policy: création contrat (automatique via backend)
-- Note: Utilisera service_role pour créer

-- ======================
-- TABLE: signalements
-- ======================
ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

-- Policy: users peuvent créer des signalements
CREATE POLICY "signalements_insert" ON public.signalements
  FOR INSERT WITH CHECK (auteur_id = auth.uid());

-- Policy: users peuvent voir leurs propres signalements
CREATE POLICY "signalements_read_own" ON public.signalements
  FOR SELECT USING (auteur_id = auth.uid());

-- Policy: admins peuvent tout voir et traiter
CREATE POLICY "signalements_admin_full" ON public.signalements
  FOR ALL USING (auth.is_admin());

-- ======================
-- TABLE: badges_cache
-- ======================
ALTER TABLE public.badges_cache ENABLE ROW LEVEL SECURITY;

-- Policy: lecture badges pour tous users connectés (public info)
CREATE POLICY "badges_read_all" ON public.badges_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Note: Mise à jour des badges via job CRON (service_role)

-- ======================
-- TABLE: admin_actions_log
-- ======================
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Policy: admins peuvent lire le log
CREATE POLICY "admin_log_read" ON public.admin_actions_log
  FOR SELECT USING (auth.is_admin());

-- Note: Insertion via triggers automatiques
```

---

## Architecture API

### Endpoints Next.js

#### Structure des Routes

```
app/
├── api/
│   ├── auth/
│   │   ├── callback/route.ts          # Callback Supabase Auth
│   │   └── signout/route.ts           # Déconnexion
│   │
│   ├── webhooks/
│   │   └── stripe/route.ts            # Webhooks Stripe
│   │
│   ├── cron/
│   │   ├── update-badges/route.ts     # Job quotidien badges
│   │   └── send-notifications/route.ts # Job notifications email
│   │
│   └── admin/
│       ├── validation/route.ts        # Actions validation auxiliaires
│       └── moderation/route.ts        # Actions modération
│
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
│
├── (dashboard)/
│   ├── auxiliaire/
│   │   ├── profil/page.tsx
│   │   ├── annonces/page.tsx
│   │   ├── messages/page.tsx
│   │   └── stats/page.tsx
│   │
│   ├── beneficiaire/
│   │   ├── profil/page.tsx
│   │   ├── recherche/page.tsx
│   │   ├── annonces/page.tsx
│   │   └── messages/page.tsx
│   │
│   └── admin/
│       ├── validation/page.tsx
│       ├── moderation/page.tsx
│       ├── users/page.tsx
│       └── metriques/page.tsx
│
└── (public)/
    ├── page.tsx                       # Landing page
    ├── annonces/[id]/page.tsx         # Détail annonce (paywall)
    └── mentions-legales/page.tsx
```

#### API Routes Détaillées

**1. Webhooks Stripe**

```typescript
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    return Response.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const supabase = createClient({ serviceRole: true })

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription

      await supabase
        .from('subscriptions')
        .upsert({
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          status: subscription.status as subscription_status,
          plan_type: subscription.items.data[0].price.recurring?.interval === 'month' ? 'monthly' : 'annual',
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
          updated_at: new Date()
        })
      break

    case 'customer.subscription.deleted':
      const deletedSub = event.data.object as Stripe.Subscription

      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date(),
          updated_at: new Date()
        })
        .eq('stripe_subscription_id', deletedSub.id)
      break

    case 'invoice.payment_failed':
      const invoice = event.data.object as Stripe.Invoice

      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date()
        })
        .eq('stripe_subscription_id', invoice.subscription as string)
      break
  }

  return Response.json({ received: true })
}
```

**2. CRON Job - Mise à jour badges**

```typescript
// app/api/cron/update-badges/route.ts
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  // Vérifier authorization (Vercel Cron secret)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient({ serviceRole: true })

  // Calculer badges d'ancienneté
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('user_id, first_subscription_date')
    .eq('status', 'active')

  for (const sub of subscriptions || []) {
    const now = new Date()
    const firstSubDate = new Date(sub.first_subscription_date)
    const diffYears = (now.getTime() - firstSubDate.getTime()) / (1000 * 60 * 60 * 24 * 365)

    let anciennete: string | null = null
    if (diffYears >= 5) anciennete = '5_ans'
    else if (diffYears >= 3) anciennete = '3_ans'
    else if (diffYears >= 1) anciennete = '1_an'

    await supabase
      .from('badges_cache')
      .upsert({
        user_id: sub.user_id,
        anciennete,
        updated_at: new Date()
      })
  }

  // Mettre à jour badges "annonce_active" + modulation tarifaire en UNE SEULE requête SQL
  // Évite le problème N+1 (3000+ requêtes avec 1000 auxiliaires)
  await supabase.rpc('update_all_auxiliaire_badges')

  // La fonction RPC côté Postgres :
  // CREATE OR REPLACE FUNCTION update_all_auxiliaire_badges()
  // RETURNS void AS $$
  // BEGIN
  //   INSERT INTO badges_cache (user_id, annonce_active, tarif_modulable_pch, tarif_modulable_apa, updated_at)
  //   SELECT
  //     ap.user_id,
  //     COALESCE((
  //       SELECT COUNT(*) > 0
  //       FROM annonces_auxiliaires aa
  //       WHERE aa.auxiliaire_id = ap.id AND aa.status = 'publiee'
  //     ), false) AS annonce_active,
  //     ap.modulation_pch,
  //     ap.modulation_apa,
  //     NOW()
  //   FROM auxiliaires_profiles ap
  //   ON CONFLICT (user_id)
  //   DO UPDATE SET
  //     annonce_active = EXCLUDED.annonce_active,
  //     tarif_modulable_pch = EXCLUDED.tarif_modulable_pch,
  //     tarif_modulable_apa = EXCLUDED.tarif_modulable_apa,
  //     updated_at = NOW();
  // END;
  // $$ LANGUAGE plpgsql SECURITY DEFINER;

  return Response.json({ success: true, updated: subscriptions?.length })
}
```

**3. Server Actions (Mutations)**

```typescript
// app/actions/annonces.ts
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Schéma de validation Zod (OBLIGATOIRE côté serveur, jamais faire confiance au client)
const AnnonceAuxiliaireSchema = z.object({
  titre: z.string().min(5).max(200).trim(),
  description: z.string().min(20).max(5000).trim(),
  ville: z.string().min(1).max(100).trim(),
  code_postal: z.string().regex(/^\d{5}$/),
  rayon_km: z.number().int().min(1).max(100).default(10),
  tarif_min: z.number().positive().max(999.99).optional(),
  tarif_max: z.number().positive().max(999.99).optional(),
  disponibilites: z.record(z.array(z.enum(['matin', 'apres_midi', 'soir', 'nuit']))).or(
    z.object({ flexible: z.literal(true) })
  ),
})

export async function createAnnonceAuxiliaire(rawData: unknown) {
  // Validation serveur obligatoire — sanitise et valide toutes les entrées
  const data = AnnonceAuxiliaireSchema.parse(rawData)

  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // Vérifier que user est auxiliaire validé + abonné
  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('id, validation_status')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.validation_status !== 'valide') {
    throw new Error('Profil non validé')
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (!subscription || subscription.status !== 'active') {
    throw new Error('Abonnement requis')
  }

  // Créer l'annonce
  const { data: annonce, error } = await supabase
    .from('annonces_auxiliaires')
    .insert({
      auxiliaire_id: profile.id,
      ...data,
      status: 'brouillon'
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/auxiliaire/annonces')
  return annonce
}

export async function publishAnnonceAuxiliaire(annonceId: string) {
  const supabase = createClient()

  const { data: annonce, error } = await supabase
    .from('annonces_auxiliaires')
    .update({
      status: 'publiee',
      published_at: new Date().toISOString()
    })
    .eq('id', annonceId)
    .select()
    .single()

  if (error) throw error

  // Déclencher matching pour notifications
  await triggerMatching(annonceId, 'auxiliaire')

  revalidatePath('/auxiliaire/annonces')
  return annonce
}
```

---

## Flow de Données

### 1. Flux d'Inscription & Validation Auxiliaire

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INSCRIPTION AUXILIAIRE                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Formulaire multi-étapes :                                    │
│ - Email/Password (Supabase Auth)                            │
│ - Informations personnelles                                 │
│ - Diplôme (sélection unique)                                │
│ - Expérience (sélection unique)                             │
│ - Spécialités (sélection multiple)                          │
│ - Tarification (€/h + badges PCH/APA)                       │
│ - Upload justificatifs (Supabase Storage)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CRÉATION PROFIL                                          │
│ - Insert dans users (role='auxiliaire')                     │
│ - Insert dans auxiliaires_profiles                          │
│   (validation_status='en_attente')                          │
│ - Upload fichiers → Supabase Storage                        │
│ - OCR pré-validation documents (optionnel)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. NOTIFICATION ADMIN                                       │
│ - Email admin : "Nouvelle demande validation auxiliaire"    │
│ - Dashboard admin : badge "1 en attente"                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. VALIDATION ADMIN — FLUX À 3 STATUTS (FR11bis / ter / quater)│
│                                                             │
│ Étape 4a : REVUE DOCUMENTAIRE (statut en_attente)           │
│ Admin consulte profil + justificatifs + OCR.                │
│ Décision intermédiaire :                                    │
│ ┌──────────────────────┬─────────────┬────────────┐         │
│ │ Passer en attente    │ REFUSE      │ A COMPLETER│         │
│ │ de visio             │             │            │         │
│ └──────────────────────┴─────────────┴────────────┘         │
│                                                             │
│   │ (passer en attente de visio)                            │
│   ▼                                                         │
│ Statut : visio_a_planifier                                  │
│   → Email convocation visio envoyé (FR11quater)             │
│   → Log admin : action_type = 'visio_planifiee'             │
│                                                             │
│ Étape 4b : TENUE DE LA VISIO (canal externe)                │
│ Admin rencontre l'auxiliaire en visio, puis saisit :        │
│ - visio_date (TIMESTAMPTZ)                                  │
│ - visio_notes (TEXT, optionnel)                             │
│                                                             │
│   │ (marquer visio réalisée)                                │
│   ▼                                                         │
│ Statut : visio_realisee                                     │
│   → Log admin : action_type = 'visio_realisee'              │
│                                                             │
│ Étape 4c : VALIDATION FINALE (statut visio_realisee)        │
│ Bouton « Valider » actif UNIQUEMENT à ce stade (FR11ter).   │
│ ┌──────────┬──────────────┬────────────┐                    │
│ │ VALIDE   │ REFUSE       │ A COMPLETER│                    │
│ └──────────┴──────────────┴────────────┘                    │
│                                                             │
│ Branches latérales (accessibles depuis tout statut) :       │
│ REFUSE et A COMPLETER.                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ VALIDE   │  │ REFUSE   │  │ COMPLETER│
         └──────────┘  └──────────┘  └──────────┘
                │             │             │
                ▼             ▼             ▼
┌──────────────────┐ ┌─────────────┐ ┌────────────┐
│ Email: Validé    │ │Email:Refusé │ │Email:      │
│ → Checkout Stripe│ │+ motif      │ │À compléter │
│                  │ │             │ │+ motif     │
└──────────────────┘ └─────────────┘ └────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. ABONNEMENT STRIPE                                        │
│ - Redirect vers Stripe Checkout                             │
│ - Choix : Mensuel (4,99€) ou Annuel (49,99€)               │
│ - Période lancement : 2 mois offerts / 15 mois             │
│ - Webhook → Update subscriptions table                      │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. ACCÈS PLATEFORME                                         │
│ - Statut: validé + abonnement actif                         │
│ - Peut créer/publier annonces                               │
│ - Accès recherche bénéficiaires                             │
│ - Messagerie active                                         │
└─────────────────────────────────────────────────────────────┘
```

### 2. Flux de Matching Intelligent

```
┌─────────────────────────────────────────────────────────────┐
│ TRIGGER: Nouvelle annonce publiée                           │
│ (auxiliaire ou bénéficiaire)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ ALGORITHME DE MATCHING                                      │
│                                                             │
│ Si annonce auxiliaire publiée :                             │
│   → Rechercher annonces bénéficiaires correspondantes      │
│                                                             │
│ Si annonce bénéficiaire publiée :                          │
│   → Rechercher auxiliaires correspondants                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ CRITÈRES DE MATCHING                                        │
│                                                             │
│ 1. ✅ SPÉCIALITÉS                                           │
│    - Au moins 1 spécialité en commun                        │
│                                                             │
│ 2. ✅ ZONE GÉOGRAPHIQUE                                     │
│    - Ville + rayon km (calcul distance)                     │
│                                                             │
│ 3. ✅ DISPONIBILITÉS HORAIRES                               │
│    - Croisement jour/créneaux                               │
│    - OU "Horaires flexibles"                                │
│                                                             │
│ 4. ✅ DIPLÔME (si spécifié)                                 │
│    - Correspond au diplôme requis                           │
│                                                             │
│ 5. ✅ EXPÉRIENCE (si spécifiée)                             │
│    - Correspond à l'expérience minimale                     │
│                                                             │
│ 6. ✅ BUDGET / TARIF (avec logique badges)                  │
│    ┌──────────────────────────────────────────┐            │
│    │ Bénéficiaire sans aide :                 │            │
│    │   → Tarif auxiliaire ≤ Budget            │            │
│    ├──────────────────────────────────────────┤            │
│    │ Bénéficiaire PCH :                       │            │
│    │   → Tarif ≤ Budget                       │            │
│    │   → OU Badge PCH auxiliaire              │            │
│    ├──────────────────────────────────────────┤            │
│    │ Bénéficiaire APA :                       │            │
│    │   → Tarif ≤ Budget                       │            │
│    │   → OU Badge APA auxiliaire              │            │
│    └──────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ RÉSULTAT MATCHING                                           │
│                                                             │
│ - Liste des matches trouvés                                 │
│ - Score de pertinence (nombre de critères matchés)          │
│ - Tri par pertinence                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ DÉCLENCHEMENT NOTIFICATIONS EMAIL                           │
│                                                             │
│ Pour chaque match :                                         │
│   - Créer entrée dans notifications_log                     │
│   - Envoyer email personnalisé                              │
│   - Template selon type (PCH/APA/standard)                  │
└─────────────────────────────────────────────────────────────┘
```

### 3. Algorithme de Matching (Pseudo-code)

```typescript
async function matchAnnonceWithUsers(
  annonceId: string,
  annonceType: 'auxiliaire' | 'beneficiaire'
) {
  const supabase = createClient({ serviceRole: true })

  if (annonceType === 'beneficiaire') {
    // Bénéficiaire a publié une annonce → chercher auxiliaires
    const { data: annonce } = await supabase
      .from('annonces_beneficiaires')
      .select('*')
      .eq('id', annonceId)
      .single()

    // Critère 1: Spécialités (au moins 1 en commun — utiliser overlaps, PAS contains)
    const { data: auxiliaires } = await supabase
      .from('auxiliaires_profiles')
      .select('*, users!inner(id, email), badges_cache(*)')
      .overlaps('specialites', annonce.specialites_recherchees) // overlaps = au moins 1 en commun
      .eq('validation_status', 'valide')

    // Filtrer sur zone géographique
    const auxInZone = auxiliaires.filter(aux =>
      isInZone(aux.ville, annonce.ville, aux.rayon_km)
    )

    // Filtrer sur disponibilités horaires
    const auxWithDisponibilites = auxInZone.filter(aux =>
      hasMatchingDisponibilites(aux, annonce.disponibilites)
    )

    // Filtrer sur diplôme (si spécifié)
    let auxWithDiplome = auxWithDisponibilites
    if (annonce.diplome_requis) {
      auxWithDiplome = auxWithDisponibilites.filter(aux =>
        aux.diplome === annonce.diplome_requis
      )
    }

    // Filtrer sur expérience (si spécifiée)
    let auxWithExperience = auxWithDiplome
    if (annonce.experience_min) {
      auxWithExperience = auxWithDiplome.filter(aux =>
        meetsExperienceRequirement(aux.experience, annonce.experience_min)
      )
    }

    // Filtrer sur budget/tarif (avec logique badges PCH/APA)
    const finalMatches = auxWithExperience.filter(aux => {
      // Budget strict
      if (aux.tarif_horaire <= annonce.tarif_max) return true

      // Élargissement PCH
      if (annonce.aide_sociale === 'pch' && aux.badges_cache?.tarif_modulable_pch) {
        return true
      }

      // Élargissement APA
      if (annonce.aide_sociale === 'apa' && aux.badges_cache?.tarif_modulable_apa) {
        return true
      }

      return false
    })

    // Envoyer notifications aux auxiliaires matchés
    for (const aux of finalMatches) {
      await sendMatchingNotification(aux.users.email, {
        type: annonce.aide_sociale === 'pch' ? 'matching_pch' :
              annonce.aide_sociale === 'apa' ? 'matching_apa' :
              'matching_standard',
        annonceId: annonce.id,
        beneficiaire: annonce,
        auxiliaire: aux
      })
    }

    return finalMatches
  }

  // Logique inverse si annonce auxiliaire publiée...
}
```

---

## Système de Badges

### Architecture des Badges

```
┌─────────────────────────────────────────────────────────────┐
│ TABLE: badges_cache                                         │
│                                                             │
│ - user_id (FK users)                                        │
│ - annonce_active (BOOLEAN)                                  │
│ - anciennete ('1_an' | '3_ans' | '5_ans' | null)           │
│ - tarif_modulable_pch (BOOLEAN)                             │
│ - tarif_modulable_apa (BOOLEAN)                             │
│ - updated_at (TIMESTAMPTZ)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Calcul des Badges

**1. Badge "Annonce Active" 📢**

```typescript
// Trigger: Quand une annonce auxiliaire passe en statut "publiee" ou "archivee"

CREATE OR REPLACE FUNCTION update_badge_annonce_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Compter annonces publiées de l'auxiliaire
  DECLARE
    aux_user_id UUID;
    annonces_count INTEGER;
  BEGIN
    -- Récupérer user_id de l'auxiliaire
    SELECT user_id INTO aux_user_id
    FROM auxiliaires_profiles
    WHERE id = NEW.auxiliaire_id;

    -- Compter annonces publiées
    SELECT COUNT(*) INTO annonces_count
    FROM annonces_auxiliaires
    WHERE auxiliaire_id = NEW.auxiliaire_id
      AND status = 'publiee';

    -- Mettre à jour badge_cache
    INSERT INTO badges_cache (user_id, annonce_active, updated_at)
    VALUES (aux_user_id, annonces_count > 0, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      annonce_active = annonces_count > 0,
      updated_at = NOW();

    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_badge_annonce_active
AFTER INSERT OR UPDATE OF status ON annonces_auxiliaires
FOR EACH ROW
EXECUTE FUNCTION update_badge_annonce_active();
```

**2. Badge "Ancienneté" 🥉🥈🥇**

```typescript
// Job CRON quotidien (Vercel Cron + API Route)

// vercel.json
{
  "crons": [{
    "path": "/api/cron/update-badges",
    "schedule": "0 2 * * *" // Tous les jours à 2h du matin
  }]
}

// Calcul ancienneté (voir section Architecture API ci-dessus)
// Basé sur subscriptions.first_subscription_date
```

**3. Badges "Tarif Modulable PCH/APA" 💚💙**

```typescript
// Trigger: Quand auxiliaire_profile modulation_pch/apa change

CREATE OR REPLACE FUNCTION update_badge_modulation_tarifaire()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO badges_cache (
    user_id,
    tarif_modulable_pch,
    tarif_modulable_apa,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.modulation_pch,
    NEW.modulation_apa,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    tarif_modulable_pch = NEW.modulation_pch,
    tarif_modulable_apa = NEW.modulation_apa,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_badge_modulation
AFTER INSERT OR UPDATE OF modulation_pch, modulation_apa
ON auxiliaires_profiles
FOR EACH ROW
EXECUTE FUNCTION update_badge_modulation_tarifaire();
```

### Affichage des Badges (Frontend)

```typescript
// components/UserBadges.tsx
import { Badge } from '@/components/ui/badge'

interface UserBadgesProps {
  badges: {
    annonce_active?: boolean
    anciennete?: '1_an' | '3_ans' | '5_ans' | null
    tarif_modulable_pch?: boolean
    tarif_modulable_apa?: boolean
  }
  userRole: 'auxiliaire' | 'beneficiaire'
}

export function UserBadges({ badges, userRole }: UserBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Badge Annonce Active (auxiliaires uniquement) */}
      {userRole === 'auxiliaire' && badges.annonce_active && (
        <Badge variant="success">
          📢 Annonce active
        </Badge>
      )}

      {/* Badge Ancienneté */}
      {badges.anciennete === '5_ans' && (
        <Badge variant="gold">
          🥇 Membre 5 ans
        </Badge>
      )}
      {badges.anciennete === '3_ans' && (
        <Badge variant="silver">
          🥈 Membre 3 ans
        </Badge>
      )}
      {badges.anciennete === '1_an' && (
        <Badge variant="bronze">
          🥉 Membre 1 an
        </Badge>
      )}

      {/* Badges Modulation Tarifaire (auxiliaires uniquement) */}
      {userRole === 'auxiliaire' && badges.tarif_modulable_pch && (
        <Badge variant="pch">
          💚 Tarif modulable PCH
        </Badge>
      )}
      {userRole === 'auxiliaire' && badges.tarif_modulable_apa && (
        <Badge variant="apa">
          💙 Tarif modulable APA
        </Badge>
      )}
    </div>
  )
}
```

---

## Matching Intelligent

### Vue d'Ensemble

Le système de matching intelligent analyse automatiquement chaque nouvelle annonce publiée et trouve les profils correspondants selon 6 critères précis. Le matching est **bidirectionnel** : il fonctionne aussi bien quand un auxiliaire publie une annonce que quand un bénéficiaire publie la sienne.

### Critères de Matching (par ordre de filtrage)

```typescript
// Ordre de traitement des critères
1. ✅ SPÉCIALITÉS (obligatoire, au moins 1 en commun)
2. ✅ ZONE GÉOGRAPHIQUE (ville + rayon km)
3. ✅ DISPONIBILITÉS HORAIRES (croisement jour/créneaux)
4. ✅ DIPLÔME (si spécifié par le bénéficiaire)
5. ✅ EXPÉRIENCE (si spécifiée par le bénéficiaire)
6. ✅ BUDGET/TARIF (avec logique badges PCH/APA)
```

### Logique Spéciale PCH/APA

**Tableau de Décision Matching Budget**

| Type d'aide | Matching standard | Matching élargi | Badge actif |
|-------------|-------------------|-----------------|-------------|
| **Aucune** | `tarif_horaire ≤ tarif_max` | ❌ Non | ❌ Aucun |
| **PCH** 💚 | `tarif_horaire ≤ tarif_max` | ✅ Auxiliaires avec badge PCH (même si tarif > budget) | ✅ Badge PCH |
| **APA** 💙 | `tarif_horaire ≤ tarif_max` | ✅ Auxiliaires avec badge APA (même si tarif > budget) | ✅ Badge APA |

**Exemple concret :**

```typescript
// Bénéficiaire avec PCH, budget 18€/h
const annonce = {
  tarif_max: 18,
  aide_sociale: 'pch'
}

// Auxiliaire A: 16€/h, pas de badge PCH
// ✅ MATCH (tarif strict ≤ budget)

// Auxiliaire B: 22€/h, badge PCH actif
// ✅ MATCH (tarif > budget MAIS badge PCH)

// Auxiliaire C: 22€/h, pas de badge PCH
// ❌ NO MATCH (tarif > budget et pas de badge)
```

### Implémentation Complète du Matching

```typescript
// lib/matching/engine.ts
import { createClient } from '@/lib/supabase/server'

interface MatchResult {
  userId: string
  email: string
  score: number
  matchedCriteria: string[]
  profile: any
  badges: any
}

/**
 * Trouve les auxiliaires correspondant à une annonce bénéficiaire
 */
export async function findMatchingAuxiliaires(
  annonceId: string
): Promise<MatchResult[]> {
  const supabase = createClient({ serviceRole: true })

  // 1. Charger l'annonce bénéficiaire
  const { data: annonce, error } = await supabase
    .from('annonces_beneficiaires')
    .select(`
      *,
      beneficiaires_profiles!inner(
        user_id,
        users!inner(email, first_name, last_name)
      )
    `)
    .eq('id', annonceId)
    .single()

  if (error || !annonce) {
    throw new Error('Annonce not found')
  }

  // 2. Filtre initial : auxiliaires validés avec abonnement actif
  const { data: auxiliaires } = await supabase
    .from('auxiliaires_profiles')
    .select(`
      *,
      users!inner(id, email, first_name, last_name, role),
      badges_cache(*),
      subscriptions!inner(status)
    `)
    .eq('validation_status', 'valide')
    .in('subscriptions.status', ['active', 'trialing']) // inclure trialing (période lancement)

  if (!auxiliaires || auxiliaires.length === 0) {
    return []
  }

  // 3. Appliquer les 6 critères de matching
  let matches: MatchResult[] = []

  for (const aux of auxiliaires) {
    const matchedCriteria: string[] = []
    let score = 0

    // CRITÈRE 1: Spécialités (au moins 1 en commun)
    const hasCommonSpeciality = aux.specialites.some((spec: string) =>
      annonce.specialites_recherchees.includes(spec)
    )

    if (!hasCommonSpeciality) continue // Éliminé

    matchedCriteria.push('specialites')
    score += 20

    // CRITÈRE 2: Zone géographique (Haversine sur lat/lng)
    if (!aux.latitude || !aux.longitude || !annonce.latitude || !annonce.longitude) {
      continue // Pas de coordonnées GPS, impossible de matcher
    }
    const distance = calculateDistance(
      { latitude: aux.latitude, longitude: aux.longitude },
      { latitude: annonce.latitude, longitude: annonce.longitude }
    )

    if (distance > aux.rayon_km) continue // Éliminé

    matchedCriteria.push('zone_geographique')
    score += 20

    // CRITÈRE 3: Disponibilités horaires
    const hasMatchingAvailability = checkAvailabilityMatch(
      aux.disponibilites,
      annonce.disponibilites
    )

    if (!hasMatchingAvailability) continue // Éliminé

    matchedCriteria.push('disponibilites')
    score += 20

    // CRITÈRE 4: Diplôme (si spécifié)
    if (annonce.diplome_requis) {
      if (aux.diplome !== annonce.diplome_requis) continue // Éliminé
      matchedCriteria.push('diplome')
      score += 15
    }

    // CRITÈRE 5: Expérience (si spécifiée)
    if (annonce.experience_min) {
      if (!meetsExperienceRequirement(aux.experience, annonce.experience_min)) {
        continue // Éliminé
      }
      matchedCriteria.push('experience')
      score += 15
    }

    // CRITÈRE 6: Budget/Tarif (avec logique PCH/APA)
    const budgetMatch = checkBudgetMatch(
      aux.tarif_horaire,
      annonce.tarif_max,
      annonce.aide_sociale,
      aux.badges_cache
    )

    if (!budgetMatch) continue // Éliminé

    matchedCriteria.push('budget')
    score += 10

    // ✅ Tous les critères passés : c'est un match !
    matches.push({
      userId: aux.users.id,
      email: aux.users.email,
      score,
      matchedCriteria,
      profile: aux,
      badges: aux.badges_cache
    })
  }

  // 4. Trier par score décroissant
  matches.sort((a, b) => b.score - a.score)

  return matches
}

/**
 * Logique de matching budget avec badges PCH/APA
 */
function checkBudgetMatch(
  tarifHoraire: number,
  tarifMax: number,
  aideSociale: 'aucune' | 'pch' | 'apa',
  badges: {
    tarif_modulable_pch?: boolean
    tarif_modulable_apa?: boolean
  } | null
): boolean {
  // Cas 1: Budget strict (toujours applicable)
  if (tarifHoraire <= tarifMax) {
    return true
  }

  // Cas 2: Élargissement PCH
  if (aideSociale === 'pch' && badges?.tarif_modulable_pch === true) {
    return true
  }

  // Cas 3: Élargissement APA
  if (aideSociale === 'apa' && badges?.tarif_modulable_apa === true) {
    return true
  }

  // Sinon : pas de match
  return false
}

/**
 * Calcule la distance entre deux points GPS (formule Haversine)
 * Les coordonnées lat/lng sont stockées dans auxiliaires_profiles.
 * Pour les annonces bénéficiaires, le géocodage est fait à la publication
 * via une API (OpenStreetMap Nominatim ou Google Geocoding).
 */
function calculateDistance(
  locationA: { latitude: number; longitude: number },
  locationB: { latitude: number; longitude: number }
): number {
  const R = 6371 // Rayon de la Terre en km
  const dLat = toRad(locationB.latitude - locationA.latitude)
  const dLon = toRad(locationB.longitude - locationA.longitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(locationA.latitude)) *
      Math.cos(toRad(locationB.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance en km
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * NOTE : Les annonces bénéficiaires doivent aussi stocker lat/lng.
 * Au moment de la publication, géocoder l'adresse via API Nominatim (gratuit)
 * ou Google Geocoding et stocker les coordonnées.
 */

/**
 * Vérifie si les disponibilités horaires correspondent
 */
function checkAvailabilityMatch(
  auxDisponibilites: any,
  annonceDisponibilites: any
): boolean {
  // Si annonce flexible : toujours match
  if (annonceDisponibilites.flexible === true) {
    return true
  }

  // Si auxiliaire flexible : toujours match
  if (auxDisponibilites.flexible === true) {
    return true
  }

  // Sinon : vérifier croisement jour/créneaux
  // Format attendu: { lundi: ['matin', 'apres_midi'], mardi: ['soir'], ... }

  const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

  for (const jour of jours) {
    const auxCreneaux = auxDisponibilites[jour] || []
    const annonceCreneaux = annonceDisponibilites[jour] || []

    // Au moins 1 créneau en commun sur au moins 1 jour
    const hasCommonSlot = auxCreneaux.some((creneau: string) =>
      annonceCreneaux.includes(creneau)
    )

    if (hasCommonSlot) {
      return true
    }
  }

  return false
}

/**
 * Vérifie si l'expérience répond au minimum requis
 */
function meetsExperienceRequirement(
  auxExperience: 'moins_3_ans' | '3_10_ans' | 'plus_10_ans',
  requiredExperience: 'moins_3_ans' | '3_10_ans' | 'plus_10_ans'
): boolean {
  const experienceLevels = {
    'moins_3_ans': 1,
    '3_10_ans': 2,
    'plus_10_ans': 3
  }

  return experienceLevels[auxExperience] >= experienceLevels[requiredExperience]
}
```

### Déclenchement du Matching

```typescript
// app/actions/annonces.ts
'use server'

import { findMatchingAuxiliaires } from '@/lib/matching/engine'
import { sendMatchingNotifications } from '@/lib/notifications/email'

export async function publishAnnonceBeneficiaire(annonceId: string) {
  const supabase = createClient()

  // 1. Publier l'annonce
  const { data: annonce, error } = await supabase
    .from('annonces_beneficiaires')
    .update({
      status: 'publiee',
      published_at: new Date().toISOString()
    })
    .eq('id', annonceId)
    .select()
    .single()

  if (error) throw error

  // 2. Lancer le matching en arrière-plan
  const matches = await findMatchingAuxiliaires(annonceId)

  // 3. Envoyer notifications aux auxiliaires matchés
  if (matches.length > 0) {
    await sendMatchingNotifications(matches, annonce)
  }

  revalidatePath('/beneficiaire/annonces')

  return {
    annonce,
    matchCount: matches.length
  }
}
```

---

## Notifications Email

### Vue d'Ensemble

Le système de notifications email envoie des emails personnalisés selon le contexte (matching standard, PCH, APA, validation, nouveaux messages, etc.). Tous les emails sont tracés dans la table `notifications_log`.

### Templates Email

**Structure des Templates**

```
lib/emails/
├── templates/
│   ├── matching-standard.tsx      # Nouvelle annonce correspondante
│   ├── matching-pch.tsx           # Match avec bénéficiaire PCH
│   ├── matching-apa.tsx           # Match avec bénéficiaire APA
│   ├── validation-accepted.tsx    # Auxiliaire validé
│   ├── validation-refused.tsx     # Auxiliaire refusé
│   ├── validation-to-complete.tsx # Documents à compléter
│   ├── new-message.tsx            # Nouveau message reçu
│   ├── subscription-expiring.tsx  # Abonnement expire bientôt
│   └── weekly-digest.tsx          # Résumé hebdomadaire
│
├── send.ts                        # Fonction d'envoi email
└── types.ts                       # Types TypeScript
```

### Template 1 : Matching Standard

```typescript
// lib/emails/templates/matching-standard.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface MatchingStandardEmailProps {
  auxiliaireFirstName: string
  annonceTitle: string
  annonceVille: string
  specialitesEnCommun: string[]
  annonceUrl: string
}

export function MatchingStandardEmail({
  auxiliaireFirstName,
  annonceTitle,
  annonceVille,
  specialitesEnCommun,
  annonceUrl,
}: MatchingStandardEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Nouvelle annonce correspondant à votre profil près de {annonceVille}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nouvelle opportunité ! 🎯</Heading>

          <Text style={text}>
            Bonjour {auxiliaireFirstName},
          </Text>

          <Text style={text}>
            Une nouvelle annonce correspond à vos spécialités et votre zone d'intervention :
          </Text>

          <Section style={annonceCard}>
            <Heading as="h2" style={h2}>
              {annonceTitle}
            </Heading>
            <Text style={location}>
              📍 {annonceVille}
            </Text>
            <Text style={specialites}>
              🏷️ Spécialités correspondantes : {specialitesEnCommun.join(', ')}
            </Text>
          </Section>

          <Button style={button} href={annonceUrl}>
            Voir l'annonce complète
          </Button>

          <Text style={footer}>
            Répondez rapidement pour maximiser vos chances !
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
}

const h2 = {
  color: '#333',
  fontSize: '20px',
  fontWeight: '600',
  margin: '0 0 10px',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  padding: '0 20px',
}

const annonceCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '20px',
}

const location = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '8px 0',
}

const specialites = {
  color: '#059669',
  fontSize: '14px',
  fontWeight: '500',
  margin: '8px 0',
}

const button = {
  backgroundColor: '#059669',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px 0',
  margin: '24px 20px',
}

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '24px 0',
  padding: '0 20px',
  textAlign: 'center' as const,
}

export default MatchingStandardEmail
```

### Template 2 : Matching PCH (avec badge)

```typescript
// lib/emails/templates/matching-pch.tsx
import { MatchingStandardEmail } from './matching-standard'

interface MatchingPCHEmailProps {
  auxiliaireFirstName: string
  annonceTitle: string
  annonceVille: string
  specialitesEnCommun: string[]
  annonceUrl: string
  tarifBeneficiaire: number
  tarifAuxiliaire: number
}

export function MatchingPCHEmail(props: MatchingPCHEmailProps) {
  const { tarifBeneficiaire, tarifAuxiliaire } = props

  // Message spécial si tarif > budget (grâce au badge PCH)
  const isTarifOver = tarifAuxiliaire > tarifBeneficiaire
  const specialMessage = isTarifOver
    ? `💚 Cette opportunité vous est proposée grâce à votre badge "Tarif modulable PCH". Le bénéficiaire a indiqué un budget de ${tarifBeneficiaire}€/h. Votre tarif habituel est de ${tarifAuxiliaire}€/h, mais vous avez accepté de moduler votre tarif pour les bénéficiaires PCH.`
    : `💚 Ce bénéficiaire est éligible à la PCH (Prestation de Compensation du Handicap).`

  return (
    <Html>
      <Head />
      <Preview>
        Nouvelle annonce PCH correspondant à votre profil 💚
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nouvelle opportunité PCH ! 💚</Heading>

          <Text style={text}>
            Bonjour {props.auxiliaireFirstName},
          </Text>

          <Section style={pchBanner}>
            <Text style={pchText}>
              {specialMessage}
            </Text>
          </Section>

          {/* Reste du template identique à matching-standard */}

          <Section style={annonceCard}>
            <Heading as="h2" style={h2}>
              {props.annonceTitle}
            </Heading>
            <Text style={location}>
              📍 {props.annonceVille}
            </Text>
            <Text style={specialites}>
              🏷️ Spécialités correspondantes : {props.specialitesEnCommun.join(', ')}
            </Text>
          </Section>

          <Button style={button} href={props.annonceUrl}>
            Voir l'annonce complète
          </Button>

          <Text style={footer}>
            Votre engagement solidaire fait la différence ! 💚
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const pchBanner = {
  backgroundColor: '#d1fae5',
  border: '2px solid #059669',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '16px',
}

const pchText = {
  color: '#065f46',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0',
  fontWeight: '500',
}

// Autres styles identiques à matching-standard...
```

### Template 3 : Validation Acceptée

```typescript
// lib/emails/templates/validation-accepted.tsx

interface ValidationAcceptedEmailProps {
  auxiliaireFirstName: string
  checkoutUrl: string
}

export function ValidationAcceptedEmail({
  auxiliaireFirstName,
  checkoutUrl,
}: ValidationAcceptedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Votre profil a été validé ! Bienvenue sur roxanetnous ✅
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Félicitations ! ✅</Heading>

          <Text style={text}>
            Bonjour {auxiliaireFirstName},
          </Text>

          <Text style={text}>
            Excellente nouvelle : votre profil auxiliaire de vie a été <strong>validé</strong> par notre équipe !
          </Text>

          <Section style={successCard}>
            <Text style={successText}>
              ✅ Identité vérifiée<br />
              ✅ Diplôme validé<br />
              ✅ Profil approuvé
            </Text>
          </Section>

          <Text style={text}>
            Pour accéder à la plateforme et commencer à recevoir des opportunités, il ne vous reste plus qu'à souscrire à un abonnement :
          </Text>

          <Section style={pricingCard}>
            <Text style={pricingOption}>
              💳 <strong>Mensuel :</strong> 4,99€/mois
            </Text>
            <Text style={pricingOption}>
              💳 <strong>Annuel :</strong> 49,99€/an (2 mois offerts !)
            </Text>
            <Text style={launchOffer}>
              🎉 <strong>Offre de lancement :</strong> 2 mois offerts (mensuel) ou 3 mois offerts (annuel)
            </Text>
          </Section>

          <Button style={button} href={checkoutUrl}>
            Choisir mon abonnement
          </Button>

          <Text style={footer}>
            À très bientôt sur roxanetnous !
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const successCard = {
  backgroundColor: '#d1fae5',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '20px',
  textAlign: 'center' as const,
}

const successText = {
  color: '#065f46',
  fontSize: '16px',
  lineHeight: '28px',
  margin: '0',
  fontWeight: '500',
}

const pricingCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '20px',
}

const pricingOption = {
  color: '#333',
  fontSize: '15px',
  margin: '8px 0',
}

const launchOffer = {
  color: '#dc2626',
  fontSize: '15px',
  fontWeight: '600',
  margin: '16px 0 0',
}

// Autres styles identiques...
```

### Fonction d'Envoi Email

```typescript
// lib/emails/send.ts
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendEmailParams {
  to: string
  subject: string
  react: React.ReactElement
  type: string
  userId?: string
  data?: any
}

export async function sendEmail({
  to,
  subject,
  react,
  type,
  userId,
  data,
}: SendEmailParams) {
  const supabase = createClient({ serviceRole: true })

  try {
    // 1. Envoyer l'email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'roxanetnous <notifications@roxanetnous.fr>',
      to,
      subject,
      react,
    })

    if (emailError) {
      throw emailError
    }

    // 2. Logger dans notifications_log
    await supabase.from('notifications_log').insert({
      user_id: userId,
      email: to,
      type,
      subject,
      template: react.type.name,
      data,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })

    return { success: true, emailId: emailData.id }
  } catch (error) {
    // Logger l'erreur
    await supabase.from('notifications_log').insert({
      user_id: userId,
      email: to,
      type,
      subject,
      template: react.type.name,
      data,
      status: 'failed',
      error: error.message,
    })

    console.error('Failed to send email:', error)
    return { success: false, error }
  }
}
```

### Envoi de Notifications de Matching

```typescript
// lib/notifications/email.ts
import { sendEmail } from '@/lib/emails/send'
import { MatchingStandardEmail } from '@/lib/emails/templates/matching-standard'
import { MatchingPCHEmail } from '@/lib/emails/templates/matching-pch'
import { MatchingAPAEmail } from '@/lib/emails/templates/matching-apa'

export async function sendMatchingNotifications(
  matches: MatchResult[],
  annonce: AnnonceBeneficiaire
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  for (const match of matches) {
    const annonceUrl = `${baseUrl}/annonces/beneficiaires/${annonce.id}`

    // Spécialités en commun
    const specialitesEnCommun = match.profile.specialites.filter((spec: string) =>
      annonce.specialites_recherchees.includes(spec)
    )

    // Template selon type d'aide sociale
    let emailComponent: React.ReactElement
    let subject: string
    let type: string

    if (annonce.aide_sociale === 'pch') {
      emailComponent = MatchingPCHEmail({
        auxiliaireFirstName: match.profile.users.first_name,
        annonceTitle: annonce.titre,
        annonceVille: annonce.ville,
        specialitesEnCommun,
        annonceUrl,
        tarifBeneficiaire: annonce.tarif_max,
        tarifAuxiliaire: match.profile.tarif_horaire,
      })
      subject = `💚 Nouvelle opportunité PCH près de ${annonce.ville}`
      type = 'matching_pch'
    } else if (annonce.aide_sociale === 'apa') {
      emailComponent = MatchingAPAEmail({
        auxiliaireFirstName: match.profile.users.first_name,
        annonceTitle: annonce.titre,
        annonceVille: annonce.ville,
        specialitesEnCommun,
        annonceUrl,
        tarifBeneficiaire: annonce.tarif_max,
        tarifAuxiliaire: match.profile.tarif_horaire,
      })
      subject = `💙 Nouvelle opportunité APA près de ${annonce.ville}`
      type = 'matching_apa'
    } else {
      emailComponent = MatchingStandardEmail({
        auxiliaireFirstName: match.profile.users.first_name,
        annonceTitle: annonce.titre,
        annonceVille: annonce.ville,
        specialitesEnCommun,
        annonceUrl,
      })
      subject = `🎯 Nouvelle opportunité près de ${annonce.ville}`
      type = 'matching_standard'
    }

    // Envoyer l'email
    await sendEmail({
      to: match.email,
      subject,
      react: emailComponent,
      type,
      userId: match.userId,
      data: {
        annonce_id: annonce.id,
        match_score: match.score,
        specialites_en_commun: specialitesEnCommun,
      },
    })
  }
}
```

### Déclencheurs de Notifications

| Événement | Template | Déclencheur | Destinataire |
|-----------|----------|-------------|--------------|
| Nouvelle annonce match standard | `matching-standard` | Publication annonce (Server Action) | Auxiliaires matchés |
| Nouvelle annonce match PCH | `matching-pch` | Publication annonce (Server Action) | Auxiliaires avec badge PCH |
| Nouvelle annonce match APA | `matching-apa` | Publication annonce (Server Action) | Auxiliaires avec badge APA |
| Validation acceptée | `validation-accepted` | Admin valide profil (API Route) | Auxiliaire validé |
| Validation refusée | `validation-refused` | Admin refuse profil (API Route) | Auxiliaire refusé |
| À compléter | `validation-to-complete` | Admin demande complément (API Route) | Auxiliaire |
| Nouveau message | `new-message` | Réception message (Trigger Supabase) | Destinataire |
| Abonnement expire bientôt | `subscription-expiring` | Job CRON (7 jours avant) | User |
| Résumé hebdomadaire | `weekly-digest` | Job CRON (tous les lundis 9h) | Tous users actifs |

---

## Chat Temps Réel (Supabase Realtime)

### Architecture

Le chat utilise **Supabase Realtime** (WebSocket) pour une communication instantanée.
L'implémentation repose sur les channels Postgres de Supabase, avec écoute des
insertions dans la table `messages`.

### Subscription côté client

```typescript
// hooks/useRealtimeMessages.ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

export function useRealtimeMessages(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Charger l'historique des messages
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data)
    }

    loadMessages()

    // Écouter les nouveaux messages en temps réel
    const channel: RealtimeChannel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => [...prev, newMessage])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Mise à jour du read_at
          const updated = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    // Cleanup : se désabonner à la destruction du composant
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  // Envoyer un message
  const sendMessage = useCallback(
    async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim(),
      })

      if (error) throw error

      // Mettre à jour last_message_at sur la conversation
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
    },
    [conversationId, supabase]
  )

  // Marquer les messages comme lus
  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', messageIds)
        .is('read_at', null)
    },
    [supabase]
  )

  return { messages, isConnected, sendMessage, markAsRead }
}
```

### Gestion de la reconnexion

Supabase Realtime gère automatiquement la reconnexion WebSocket.
En cas de déconnexion prolongée, les messages reçus pendant la coupure
sont récupérés grâce au rechargement de l'historique lors de la
reconnexion (le callback `subscribe` passe à `SUBSCRIBED`).

### Publication Realtime (configuration Supabase)

```sql
-- Activer Realtime sur la table messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### Considérations de performance

- **Filtre par conversation** : chaque client ne reçoit que les messages
  de la conversation active (filtre `conversation_id=eq.X`)
- **RLS appliqué** : Supabase Realtime respecte les policies RLS,
  donc un utilisateur ne peut pas espionner une conversation dont il
  n'est pas participant
- **Pas de présence/typing indicator** dans le MVP : ajouté en V2

---

## Stockage Fichiers

### Architecture Supabase Storage

```
Supabase Storage
├── Bucket: justificatifs (privé)
│   ├── {user_id}/
│   │   ├── identite/
│   │   │   └── carte-identite.pdf
│   │   ├── diplomes/
│   │   │   └── diplome-auxiliaire.pdf
│   │   └── autres/
│   │       └── attestation-experience.pdf
│
└── Bucket: contrats (privé)
    ├── {auxiliaire_id}_{beneficiaire_id}/
    │   └── contrat-{id}.pdf
```

### Configuration des Buckets

```sql
-- Création du bucket justificatifs
INSERT INTO storage.buckets (id, name, public)
VALUES ('justificatifs', 'justificatifs', false);

-- Création du bucket contrats
INSERT INTO storage.buckets (id, name, public)
VALUES ('contrats', 'contrats', false);
```

### RLS sur Storage (Supabase)

```sql
-- ======================
-- BUCKET: justificatifs
-- ======================

-- Policy: Users peuvent uploader leurs propres justificatifs
CREATE POLICY "users_upload_own_justificatifs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'justificatifs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users peuvent lire leurs propres justificatifs
CREATE POLICY "users_read_own_justificatifs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'justificatifs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins peuvent lire tous les justificatifs (pour validation)
CREATE POLICY "admins_read_all_justificatifs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'justificatifs'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ======================
-- BUCKET: contrats
-- ======================

-- Policy: Users peuvent lire leurs propres contrats
CREATE POLICY "users_read_own_contrats"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contrats'
  AND (
    -- Auxiliaire peut lire si son ID est dans le nom du dossier
    name LIKE (
      (SELECT id::text FROM auxiliaires_profiles WHERE user_id = auth.uid()) || '_%'
    )
    -- OU Bénéficiaire peut lire si son ID est dans le nom du dossier
    OR name LIKE (
      '%_' || (SELECT id::text FROM beneficiaires_profiles WHERE user_id = auth.uid())
    )
  )
);

-- Policy: Système peut créer contrats (service_role uniquement)
-- Note: Pas de policy INSERT pour users, uniquement via backend
```

### Upload de Justificatifs (Frontend)

```typescript
// components/forms/UploadJustificatifs.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function UploadJustificatifs() {
  const [uploading, setUploading] = useState(false)
  const [identiteFile, setIdentiteFile] = useState<File | null>(null)
  const [diplomeFile, setDiplomeFile] = useState<File | null>(null)

  const supabase = createClient()

  async function handleUpload() {
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      // Upload identité
      let identiteUrl = null
      if (identiteFile) {
        const identitePath = `${user.id}/identite/${identiteFile.name}`
        const { data: identiteData, error: identiteError } = await supabase.storage
          .from('justificatifs')
          .upload(identitePath, identiteFile, {
            cacheControl: '3600',
            upsert: true,
          })

        if (identiteError) throw identiteError

        identiteUrl = identiteData.path
      }

      // Upload diplôme
      let diplomeUrl = null
      if (diplomeFile) {
        const diplomePath = `${user.id}/diplomes/${diplomeFile.name}`
        const { data: diplomeData, error: diplomeError } = await supabase.storage
          .from('justificatifs')
          .upload(diplomePath, diplomeFile, {
            cacheControl: '3600',
            upsert: true,
          })

        if (diplomeError) throw diplomeError

        diplomeUrl = diplomeData.path
      }

      // Mettre à jour le profil auxiliaire avec les URLs
      const { error: updateError } = await supabase
        .from('auxiliaires_profiles')
        .update({
          justificatif_identite_url: identiteUrl,
          justificatif_diplome_url: diplomeUrl,
        })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      alert('Justificatifs uploadés avec succès !')
    } catch (error) {
      console.error('Erreur upload:', error)
      alert('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Pièce d'identité (obligatoire)
        </label>
        <Input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setIdentiteFile(e.target.files?.[0] || null)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Diplôme (obligatoire)
        </label>
        <Input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setDiplomeFile(e.target.files?.[0] || null)}
        />
      </div>

      <Button
        onClick={handleUpload}
        disabled={uploading || !identiteFile || !diplomeFile}
      >
        {uploading ? 'Upload en cours...' : 'Envoyer les justificatifs'}
      </Button>
    </div>
  )
}
```

### Génération de Contrats PDF

```typescript
// lib/pdf/generate-contrat.ts
import { jsPDF } from 'jspdf'
import { createClient } from '@/lib/supabase/server'

interface ContratData {
  auxiliaireId: string
  beneficiaireId: string
  prestations: string[]
  tarif: number
  horaires: any
  dateDebut: Date
  duree: string
}

export async function generateContratPDF(data: ContratData): Promise<string> {
  const supabase = createClient({ serviceRole: true })

  // 1. Charger les profils
  const { data: auxiliaire } = await supabase
    .from('auxiliaires_profiles')
    .select('*, users!inner(first_name, last_name, email)')
    .eq('id', data.auxiliaireId)
    .single()

  const { data: beneficiaire } = await supabase
    .from('beneficiaires_profiles')
    .select('*, users!inner(first_name, last_name, email)')
    .eq('id', data.beneficiaireId)
    .single()

  // 2. Générer le PDF
  const doc = new jsPDF()

  // En-tête
  doc.setFontSize(18)
  doc.text('CONTRAT DE PRESTATION DE SERVICES', 105, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Généré via roxanetnous - ${new Date().toLocaleDateString('fr-FR')}`, 105, 30, { align: 'center' })

  // Parties
  doc.setFontSize(12)
  doc.text('ENTRE LES SOUSSIGNÉS :', 20, 50)

  doc.setFontSize(10)
  doc.text('L\'AUXILIAIRE DE VIE :', 20, 60)
  doc.text(`${auxiliaire.users.first_name} ${auxiliaire.users.last_name}`, 30, 68)
  doc.text(`Email : ${auxiliaire.users.email}`, 30, 75)
  doc.text(`Ville : ${auxiliaire.ville}`, 30, 82)

  doc.text('LE BÉNÉFICIAIRE :', 20, 95)
  doc.text(`${beneficiaire.users.first_name} ${beneficiaire.users.last_name}`, 30, 103)
  doc.text(`Email : ${beneficiaire.users.email}`, 30, 110)
  doc.text(`Ville : ${beneficiaire.ville}`, 30, 117)

  // Prestations
  doc.text('PRESTATIONS CONVENUES :', 20, 135)
  let yPos = 143
  data.prestations.forEach((prestation) => {
    doc.text(`• ${prestation}`, 30, yPos)
    yPos += 7
  })

  // Conditions financières
  doc.text('CONDITIONS FINANCIÈRES :', 20, yPos + 10)
  doc.text(`Tarif horaire convenu : ${data.tarif}€/heure`, 30, yPos + 18)

  // Horaires
  doc.text('HORAIRES :', 20, yPos + 35)
  doc.text(`Date de début : ${data.dateDebut.toLocaleDateString('fr-FR')}`, 30, yPos + 43)
  doc.text(`Durée : ${data.duree}`, 30, yPos + 50)

  // Signatures
  doc.text('SIGNATURES :', 20, 250)
  doc.text('L\'auxiliaire de vie', 30, 260)
  doc.text('Le bénéficiaire', 120, 260)

  // 3. Convertir en Buffer
  const pdfBuffer = doc.output('arraybuffer')

  // 4. Upload vers Supabase Storage
  const fileName = `contrat-${Date.now()}.pdf`
  const filePath = `${data.auxiliaireId}_${data.beneficiaireId}/${fileName}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('contrats')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
    })

  if (uploadError) {
    throw new Error(`Erreur upload PDF: ${uploadError.message}`)
  }

  // 5. Stocker le CHEMIN du fichier (PAS une URL signée)
  // Les URLs signées expirent — pour un document légal, on génère l'URL
  // signée À LA DEMANDE quand l'utilisateur veut télécharger le contrat.

  // 6. Enregistrer dans la table contrats (avec le chemin storage, pas l'URL)
  const { data: contrat, error: contratError } = await supabase
    .from('contrats')
    .insert({
      auxiliaire_id: data.auxiliaireId,
      beneficiaire_id: data.beneficiaireId,
      prestations: data.prestations,
      tarif: data.tarif,
      horaires: data.horaires,
      date_debut: data.dateDebut.toISOString().split('T')[0],
      duree: data.duree,
      pdf_storage_path: filePath, // Chemin storage, pas URL signée
    })
    .select()
    .single()

  if (contratError) {
    throw new Error(`Erreur création contrat: ${contratError.message}`)
  }

  return contrat
}

/**
 * Génère une URL signée temporaire pour télécharger un contrat
 * Appelée à la demande (Server Action) — URL valide 1h
 */
export async function getContratDownloadUrl(contratId: string): Promise<string> {
  const supabase = createClient({ serviceRole: true })

  const { data: contrat } = await supabase
    .from('contrats')
    .select('pdf_storage_path')
    .eq('id', contratId)
    .single()

  if (!contrat?.pdf_storage_path) {
    throw new Error('Contrat introuvable')
  }

  const { data: urlData } = await supabase.storage
    .from('contrats')
    .createSignedUrl(contrat.pdf_storage_path, 60 * 60) // 1h seulement

  if (!urlData) {
    throw new Error('Impossible de générer l\'URL de téléchargement')
  }

  return urlData.signedUrl
}
```

### Server Action pour Créer un Contrat

```typescript
// app/actions/contrats.ts
'use server'

import { generateContratPDF } from '@/lib/pdf/generate-contrat'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/emails/send'
import { ContratGeneratedEmail } from '@/lib/emails/templates/contrat-generated'

export async function createContrat(formData: ContratData) {
  const supabase = createClient()

  try {
    // Vérifier permissions (doit être l'une des parties)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    // Générer le PDF
    const pdfUrl = await generateContratPDF(formData)

    // Envoyer notifications aux 2 parties
    // TODO: implémenter sendEmail pour contrat

    return { success: true, pdfUrl }
  } catch (error) {
    console.error('Erreur création contrat:', error)
    return { success: false, error: error.message }
  }
}
```

---

## OCR & Pré-validation Documents

### Vue d'Ensemble

L'OCR est utilisé lors de l'inscription auxiliaire pour pré-vérifier les documents
déposés (pièce d'identité, diplômes). L'objectif est d'assister l'admin dans
la validation, PAS de remplacer la validation humaine.

### Architecture

```
┌─────────────────────────────────────┐
│ Upload justificatif (auxiliaire)    │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│ Server Action: processDocument()    │
│ 1. Upload vers Supabase Storage     │
│ 2. Envoi vers API OCR               │
│ 3. Extraction texte + données       │
│ 4. Stockage résultat pré-validation │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│ Table: ocr_results                  │
│ - document_type (identite/diplome)  │
│ - extracted_data (JSONB)            │
│ - confidence_score (0-100)          │
│ - coherence_check (BOOLEAN)         │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│ Dashboard Admin                     │
│ - Affiche résultat OCR à côté du   │
│   document original                 │
│ - Alerte si incohérence détectée    │
│   (diplôme déclaré ≠ texte OCR)    │
│ - Admin prend la décision finale    │
└─────────────────────────────────────┘
```

### Table OCR Results

```sql
CREATE TABLE public.ocr_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auxiliaire_profile_id UUID REFERENCES public.auxiliaires_profiles(id) ON DELETE CASCADE,

  -- Document analysé
  document_type TEXT NOT NULL CHECK (document_type IN ('identite', 'diplome', 'autre')),
  storage_path TEXT NOT NULL, -- chemin dans Supabase Storage

  -- Résultats OCR
  extracted_text TEXT,           -- texte brut extrait
  extracted_data JSONB,          -- données structurées (nom, prénom, numéro diplôme, etc.)
  confidence_score INTEGER,      -- score de confiance OCR (0-100)

  -- Pré-validation automatique
  coherence_diplome BOOLEAN,     -- diplôme déclaré correspond au texte OCR ?
  coherence_identite BOOLEAN,    -- nom/prénom correspondent au profil ?
  alerts TEXT[],                  -- alertes pour l'admin (ex: "diplôme illisible")

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: seuls les admins peuvent lire les résultats OCR
ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_admin_only" ON public.ocr_results
  FOR ALL USING (auth.is_admin());
```

### Implémentation OCR

```typescript
// lib/ocr/process-document.ts

// Option 1: Tesseract.js (gratuit, côté serveur Next.js)
// Option 2: Google Cloud Vision API (payant, plus précis)
// Recommandation MVP: Google Cloud Vision pour fiabilité >80%

import vision from '@google-cloud/vision'

const client = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS!),
})

interface OcrResult {
  extractedText: string
  confidence: number
  extractedData: Record<string, string>
}

export async function processDocument(
  fileBuffer: Buffer,
  documentType: 'identite' | 'diplome'
): Promise<OcrResult> {
  const [result] = await client.documentTextDetection({
    image: { content: fileBuffer.toString('base64') },
  })

  const fullText = result.fullTextAnnotation?.text || ''
  const confidence = Math.round(
    (result.fullTextAnnotation?.pages?.[0]?.confidence || 0) * 100
  )

  // Extraction de données structurées selon le type de document
  let extractedData: Record<string, string> = {}

  if (documentType === 'identite') {
    extractedData = extractIdentityData(fullText)
  } else if (documentType === 'diplome') {
    extractedData = extractDiplomaData(fullText)
  }

  return { extractedText: fullText, confidence, extractedData }
}

function extractIdentityData(text: string): Record<string, string> {
  // Regex pour extraire nom, prénom, date de naissance
  // depuis une CNI ou passeport français
  const lines = text.split('\n')
  return {
    raw_text: text.substring(0, 500),
    // L'extraction fine est complétée par l'admin
  }
}

function extractDiplomaData(text: string): Record<string, string> {
  // Recherche de mots-clés de diplômes connus
  const knownDiplomas = [
    'auxiliaire en gérontologie',
    'diplôme d\'état auxiliaire de vie',
    'aide médico-psychologique',
    'aide-soignante',
    'assistant de soin en gérontologie',
    'assistant de vie aux familles',
    'DEAES',
    'BAC PRO ASSP',
  ]

  const found = knownDiplomas.filter(d =>
    text.toLowerCase().includes(d.toLowerCase())
  )

  return {
    diplomas_detected: found.join(', ') || 'Aucun diplôme reconnu automatiquement',
    raw_text: text.substring(0, 500),
  }
}

/**
 * Vérifie la cohérence entre diplôme déclaré et texte OCR
 */
export function checkDiplomaCoherence(
  declaredDiplome: string,
  ocrData: Record<string, string>
): { coherent: boolean; alerts: string[] } {
  const alerts: string[] = []

  if (!ocrData.diplomas_detected || ocrData.diplomas_detected === 'Aucun diplôme reconnu automatiquement') {
    alerts.push('OCR: Aucun diplôme détecté dans le document - vérification manuelle requise')
    return { coherent: false, alerts }
  }

  // Vérifier si le diplôme déclaré est dans les diplômes détectés
  // (comparaison approximative car les noms peuvent varier)
  const coherent = ocrData.diplomas_detected
    .toLowerCase()
    .includes(declaredDiplome.toLowerCase().substring(0, 10))

  if (!coherent) {
    alerts.push(`OCR: Diplôme déclaré "${declaredDiplome}" non trouvé dans le document. Détecté: "${ocrData.diplomas_detected}"`)
  }

  return { coherent, alerts }
}
```

---

## Jobs & Automatisations

### Configuration Vercel Cron

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/update-badges",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/send-weekly-digest",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/cleanup-old-notifications",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

### Job 1 : Mise à Jour Badges (quotidien 2h)

**Déjà implémenté** dans la section "Architecture API" ci-dessus.

**Résumé :**
- Calcule les badges d'ancienneté (1 an / 3 ans / 5 ans)
- Met à jour le badge "annonce_active" pour auxiliaires
- Met à jour les badges modulation tarifaire PCH/APA
- Stocke dans `badges_cache`

### Job 2 : Résumé Hebdomadaire (lundi 9h)

```typescript
// app/api/cron/send-weekly-digest/route.ts
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/emails/send'
import { WeeklyDigestEmail } from '@/lib/emails/templates/weekly-digest'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient({ serviceRole: true })
  const now = new Date()
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Récupérer tous les users avec abonnement actif
  const { data: users } = await supabase
    .from('users')
    .select(`
      id,
      email,
      first_name,
      role,
      subscriptions!inner(status)
    `)
    .in('subscriptions.status', ['active', 'trialing']) // inclure trialing

  for (const user of users || []) {
    try {
      // Statistiques de la semaine selon le rôle
      let weeklyStats = {}

      if (user.role === 'auxiliaire') {
        // Stats auxiliaire
        const { data: profile } = await supabase
          .from('auxiliaires_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (!profile) continue

        // Nouvelles annonces bénéficiaires matchées cette semaine
        const { count: newMatches } = await supabase
          .from('annonces_beneficiaires')
          .select('id', { count: 'exact' })
          .eq('status', 'publiee')
          .gte('published_at', lastWeek.toISOString())

        // Nouveaux messages reçus
        const { count: newMessages } = await supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .neq('sender_id', user.id)
          .gte('created_at', lastWeek.toISOString())

        // Vues sur mes annonces
        const { data: annonces } = await supabase
          .from('annonces_auxiliaires')
          .select('vues')
          .eq('auxiliaire_id', profile.id)

        const totalVues = annonces?.reduce((sum, a) => sum + a.vues, 0) || 0

        weeklyStats = {
          newMatches: newMatches || 0,
          newMessages: newMessages || 0,
          totalVues,
        }
      } else if (user.role === 'beneficiaire') {
        // Stats bénéficiaire (similaire, inversé)
        // TODO: implémenter
      }

      // Envoyer le résumé
      await sendEmail({
        to: user.email,
        subject: '📊 Votre résumé hebdomadaire - roxanetnous',
        react: WeeklyDigestEmail({
          firstName: user.first_name,
          role: user.role,
          stats: weeklyStats,
        }),
        type: 'weekly_digest',
        userId: user.id,
      })
    } catch (error) {
      console.error(`Erreur envoi digest pour ${user.email}:`, error)
    }
  }

  return Response.json({ success: true, sent: users?.length || 0 })
}
```

### Job 3 : Alerte Expiration Abonnements (quotidien 10h)

```typescript
// app/api/cron/check-expiring-subscriptions/route.ts
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/emails/send'
import { SubscriptionExpiringEmail } from '@/lib/emails/templates/subscription-expiring'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient({ serviceRole: true })
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Trouver les abonnements qui expirent dans 7 jours
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      id,
      user_id,
      current_period_end,
      plan_type,
      users!inner(email, first_name)
    `)
    .eq('status', 'active')
    .lte('current_period_end', in7Days.toISOString())
    .gte('current_period_end', now.toISOString())

  for (const sub of subscriptions || []) {
    const daysRemaining = Math.ceil(
      (new Date(sub.current_period_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    await sendEmail({
      to: sub.users.email,
      subject: `⏰ Votre abonnement expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`,
      react: SubscriptionExpiringEmail({
        firstName: sub.users.first_name,
        daysRemaining,
        planType: sub.plan_type,
        renewalUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscription`,
      }),
      type: 'subscription_expiring',
      userId: sub.user_id,
    })
  }

  return Response.json({ success: true, notified: subscriptions?.length || 0 })
}
```

### Job 4 : Nettoyage Logs Notifications (dimanche 3h)

```typescript
// app/api/cron/cleanup-old-notifications/route.ts
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient({ serviceRole: true })

  // Supprimer les logs de plus de 90 jours
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90)

  const { error, count } = await supabase
    .from('notifications_log')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffDate.toISOString())

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, deleted: count })
}
```

### Triggers Supabase (Database-side)

**Trigger : Notification nouveau message**

```sql
-- Fonction: Envoyer notification quand nouveau message
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_email TEXT;
  recipient_name TEXT;
  sender_name TEXT;
BEGIN
  -- Identifier le destinataire (l'autre participant de la conversation)
  IF EXISTS (
    SELECT 1 FROM conversations c
    JOIN auxiliaires_profiles ap ON ap.id = c.auxiliaire_id
    WHERE c.id = NEW.conversation_id AND ap.user_id = NEW.sender_id
  ) THEN
    -- Sender est l'auxiliaire, recipient est le bénéficiaire
    SELECT u.email, u.first_name INTO recipient_email, recipient_name
    FROM conversations c
    JOIN beneficiaires_profiles bp ON bp.id = c.beneficiaire_id
    JOIN users u ON u.id = bp.user_id
    WHERE c.id = NEW.conversation_id;
  ELSE
    -- Sender est le bénéficiaire, recipient est l'auxiliaire
    SELECT u.email, u.first_name INTO recipient_email, recipient_name
    FROM conversations c
    JOIN auxiliaires_profiles ap ON ap.id = c.auxiliaire_id
    JOIN users u ON u.id = ap.user_id
    WHERE c.id = NEW.conversation_id;
  END IF;

  -- Logger la notification (l'email sera envoyé par un Edge Function)
  INSERT INTO notifications_log (
    email,
    type,
    subject,
    data,
    status
  ) VALUES (
    recipient_email,
    'new_message',
    'Nouveau message reçu',
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_preview', LEFT(NEW.content, 100),
      'recipient_name', recipient_name
    ),
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();
```

**Edge Function : Traiter les notifications pending**

```typescript
// supabase/functions/process-pending-notifications/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Récupérer notifications pending
  const { data: notifications } = await supabase
    .from('notifications_log')
    .select('*')
    .eq('status', 'pending')
    .limit(10)

  for (const notif of notifications || []) {
    try {
      // Appeler l'API d'envoi email (Resend, SendGrid, etc.)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'notifications@roxanetnous.fr',
          to: notif.email,
          subject: notif.subject,
          // Template selon notif.type
        }),
      })

      if (response.ok) {
        // Mettre à jour le statut
        await supabase
          .from('notifications_log')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', notif.id)
      } else {
        throw new Error('Failed to send email')
      }
    } catch (error) {
      // Logger l'erreur
      await supabase
        .from('notifications_log')
        .update({
          status: 'failed',
          error: error.message,
        })
        .eq('id', notif.id)
    }
  }

  return new Response(
    JSON.stringify({ processed: notifications?.length || 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## Sécurité & RGPD

### Principes de Sécurité

```
┌─────────────────────────────────────────────────────────────┐
│ STRATÉGIE SÉCURITÉ MULTI-COUCHES                            │
│                                                             │
│ 1. 🔐 Authentification (Supabase Auth)                     │
│ 2. 🛡️  RLS (Row Level Security)                            │
│ 3. 🔑 API Keys (Stripe, Resend, etc.)                      │
│ 4. 📁 Storage RLS (justificatifs privés)                   │
│ 5. 🚨 Rate Limiting (Vercel Edge)                          │
│ 6. 📝 Audit Logging (admin actions)                        │
│ 7. 🔒 Chiffrement (données sensibles)                      │
│ 8. ⚖️  Conformité RGPD                                      │
└─────────────────────────────────────────────────────────────┘
```

### 1. Authentification Supabase

**Configuration Auth**

```typescript
// lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protection des routes /auxiliaire et /beneficiaire
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/auxiliaire') ||
     request.nextUrl.pathname.startsWith('/beneficiaire') ||
     request.nextUrl.pathname.startsWith('/admin'))
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protection route admin (vérifier rôle)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user?.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}
```

### 2. Chiffrement Données Sensibles

```typescript
// lib/crypto/encrypt.ts
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY! // 32 bytes
const ALGORITHM = 'aes-256-gcm'

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

**Exemple d'usage : chiffrer numéro de téléphone**

```typescript
import { createHash } from 'crypto'

// Hash déterministe pour permettre la recherche et la détection de doublons
function hashPhone(phone: string): string {
  const normalized = phone.replace(/\s+/g, '').replace(/^0/, '+33')
  return createHash('sha256')
    .update(normalized + process.env.PHONE_HASH_SALT!)
    .digest('hex')
}

// Lors de la sauvegarde : stocker le chiffré ET le hash
const encryptedPhone = encrypt(user.phone)
const phoneHash = hashPhone(user.phone)

await supabase
  .from('users')
  .update({
    phone: encryptedPhone,      // chiffré AES-256 (réversible, pour affichage)
    phone_hash: phoneHash,      // hash SHA-256 salé (pour recherche/dédup)
  })
  .eq('id', userId)

// Lors de la lecture (déchiffrer pour affichage)
const { data } = await supabase
  .from('users')
  .select('phone')
  .eq('id', userId)
  .single()

const decryptedPhone = decrypt(data.phone)

// Pour rechercher par téléphone (admin support) :
const searchHash = hashPhone(searchedPhone)
const { data: found } = await supabase
  .from('users')
  .select('id, email')
  .eq('phone_hash', searchHash)
```

**NOTE** : Ajouter la colonne `phone_hash` à la table `users` :

```sql
ALTER TABLE public.users ADD COLUMN phone_hash TEXT;
CREATE INDEX idx_users_phone_hash ON users(phone_hash);
```

### 3. Rate Limiting (Vercel Edge)

**IMPORTANT : Next.js n'a qu'UN SEUL `middleware.ts` à la racine.**
Le rate limiting et la gestion de session Supabase doivent être combinés
dans le même middleware. Voici l'architecture unifiée :

```typescript
// middleware.ts (UNIQUE fichier middleware à la racine du projet)
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Rate limiter global
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
})

export async function middleware(request: NextRequest) {
  // ÉTAPE 1 : Rate limiting (avant tout traitement)
  const identifier = request.ip ?? 'anonymous'
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier)

  if (!success) {
    const response = NextResponse.json(
      { error: 'Trop de requêtes, veuillez patienter' },
      { status: 429 }
    )
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', reset.toString())
    return response
  }

  // ÉTAPE 2 : Gestion session Supabase + protection routes
  // (updateSession gère auth, redirection login, vérification rôle admin)
  const response = await updateSession(request)

  // Ajouter headers rate limiting sur la réponse
  response.headers.set('X-RateLimit-Limit', limit.toString())
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', reset.toString())

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/auxiliaire/:path*',
    '/beneficiaire/:path*',
    '/admin/:path*',
  ],
}
```

### 4. Audit Logging des Actions Admin

```typescript
// lib/audit/log.ts
import { createClient } from '@/lib/supabase/server'

export async function logAdminAction(
  actionType: string,
  targetType: string,
  targetId: string,
  details?: any
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    details,
  })
}

// Exemple d'usage
await logAdminAction(
  'validation',
  'auxiliaire',
  auxiliaireId,
  {
    decision: 'valide',
    motif: 'Documents conformes',
  }
)
```

### 5. Conformité RGPD

#### Droit à l'oubli (Suppression compte)

```typescript
// app/actions/account.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function deleteAccount() {
  const supabase = createClient({ serviceRole: true })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // 1. Anonymiser les données sensibles (garder historique)
  await supabase
    .from('users')
    .update({
      email: `deleted_${user.id}@anonymized.local`,
      first_name: '[Supprimé]',
      last_name: '[Supprimé]',
      phone: null,
    })
    .eq('id', user.id)

  // 2. Supprimer justificatifs (Storage)
  const { data: files } = await supabase.storage
    .from('justificatifs')
    .list(user.id)

  if (files && files.length > 0) {
    // Lister récursivement tous les sous-dossiers
    const allFiles: string[] = []
    for (const folder of ['identite', 'diplomes', 'autres']) {
      const { data: subFiles } = await supabase.storage
        .from('justificatifs')
        .list(`${user.id}/${folder}`)
      if (subFiles) {
        allFiles.push(...subFiles.map(f => `${user.id}/${folder}/${f.name}`))
      }
    }
    if (allFiles.length > 0) {
      await supabase.storage.from('justificatifs').remove(allFiles)
    }
  }

  // 3. Supprimer les favoris
  await supabase
    .from('favoris')
    .delete()
    .eq('user_id', user.id)

  // 4. Supprimer le cache de badges
  await supabase
    .from('badges_cache')
    .delete()
    .eq('user_id', user.id)

  // 6. Anonymiser les signalements créés par l'utilisateur
  await supabase
    .from('signalements')
    .update({ description: '[Supprimé - compte fermé]', motif: '[Supprimé]' })
    .eq('auteur_id', user.id)

  // 7. Supprimer les notifications log
  await supabase
    .from('notifications_log')
    .delete()
    .eq('user_id', user.id)

  // 8. Supprimer les PDFs de contrats (Storage) et anonymiser les contrats en BDD
  const profileField = userData.role === 'auxiliaire' ? 'auxiliaire_id' : 'beneficiaire_id'
  const profileTable = userData.role === 'auxiliaire' ? 'auxiliaires_profiles' : 'beneficiaires_profiles'
  const { data: profile } = await supabase
    .from(profileTable)
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (profile) {
    // Récupérer les contrats pour supprimer les PDFs
    const { data: contrats } = await supabase
      .from('contrats')
      .select('pdf_storage_path')
      .eq(profileField, profile.id)

    if (contrats) {
      const paths = contrats
        .map(c => c.pdf_storage_path)
        .filter(Boolean) as string[]
      if (paths.length > 0) {
        await supabase.storage.from('contrats').remove(paths)
      }
    }
  }

  // 9. Archiver annonces (pas supprimer pour historique)
  if (userData.role === 'auxiliaire' && profile) {
    await supabase
      .from('annonces_auxiliaires')
      .update({ status: 'archivee' })
      .eq('auxiliaire_id', profile.id)
  } else if (userData.role === 'beneficiaire' && profile) {
    await supabase
      .from('annonces_beneficiaires')
      .update({ status: 'archivee' })
      .eq('beneficiaire_id', profile.id)
  }

  // 10. Annuler abonnement Stripe
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (subscription?.stripe_subscription_id) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
  }

  // 5. Supprimer le compte Auth
  await supabase.auth.admin.deleteUser(user.id)

  return { success: true }
}
```

#### Export des données personnelles

```typescript
// app/actions/account.ts
'use server'

export async function exportPersonalData() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // Récupérer toutes les données de l'utilisateur
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  let profileData = null
  if (userData.role === 'auxiliaire') {
    const { data } = await supabase
      .from('auxiliaires_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profileData = data
  } else if (userData.role === 'beneficiaire') {
    const { data } = await supabase
      .from('beneficiaires_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profileData = data
  }

  const { data: subscriptionData } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)

  const { data: messagesData } = await supabase
    .from('messages')
    .select('*')
    .eq('sender_id', user.id)

  // Générer JSON
  const exportData = {
    user: userData,
    profile: profileData,
    subscriptions: subscriptionData,
    messages: messagesData,
    export_date: new Date().toISOString(),
  }

  return exportData
}
```

#### Mentions Légales & Politique de Confidentialité

```markdown
// app/(public)/mentions-legales/page.tsx

# Politique de Confidentialité - roxanetnous

## 1. Responsable du traitement
roxanetnous, [adresse], [email de contact]

## 2. Données collectées
- Identité (nom, prénom, email)
- Coordonnées (téléphone, adresse)
- Justificatifs (pièce d'identité, diplômes) - auxiliaires uniquement
- Données d'abonnement (via Stripe)
- Messages échangés sur la plateforme
- Logs de connexion

## 3. Finalités du traitement
- Mise en relation auxiliaires ↔ bénéficiaires
- Vérification identité et diplômes
- Gestion des abonnements
- Notifications email personnalisées
- Amélioration du service

## 4. Base légale
- Consentement explicite lors de l'inscription
- Exécution du contrat d'abonnement
- Obligation légale (vérification identité)

## 5. Durée de conservation
- Données compte actif : durée de l'abonnement
- Données compte supprimé : anonymisation immédiate
- Logs de sécurité : 1 an

## 6. Droits des utilisateurs
Conformément au RGPD, vous disposez des droits suivants :
- Droit d'accès
- Droit de rectification
- Droit à l'effacement ("droit à l'oubli")
- Droit à la portabilité
- Droit d'opposition

Pour exercer vos droits : contact@roxanetnous.fr

## 7. Sécurité
- Chiffrement des données sensibles (AES-256)
- Authentification sécurisée (Supabase Auth)
- Hébergement européen (Supabase EU)
- Sauvegarde quotidienne
- RLS (Row Level Security) sur toutes les tables

## 8. Cookies
- Cookies de session (authentification)
- Cookies analytiques (Vercel Analytics)

## 9. Sous-traitants
- Supabase (hébergement base de données)
- Vercel (hébergement application)
- Stripe (paiements)
- Resend (emails transactionnels)

Tous nos sous-traitants sont conformes RGPD.

## 10. Contact DPO
Pour toute question : dpo@roxanetnous.fr
```

### 6. Sécurité des Webhooks

```typescript
// app/api/webhooks/stripe/route.ts

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event

  try {
    // Vérification signature Stripe (OBLIGATOIRE)
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message)
    return Response.json({ error: 'Webhook signature invalid' }, { status: 400 })
  }

  // Traiter l'événement...
}
```

### 7. Validation des Inputs (Zod)

```typescript
// lib/validations/annonce.ts
import { z } from 'zod'

export const annonceAuxiliaireSchema = z.object({
  titre: z.string().min(10, 'Le titre doit contenir au moins 10 caractères').max(100),
  description: z.string().min(50, 'La description doit contenir au moins 50 caractères'),
  ville: z.string().min(2),
  code_postal: z.string().regex(/^\d{5}$/, 'Code postal invalide'),
  rayon_km: z.number().int().min(1).max(50),
  tarif_min: z.number().min(10).max(50),
  tarif_max: z.number().min(10).max(50),
  disponibilites: z.object({
    flexible: z.boolean().optional(),
    lundi: z.array(z.enum(['matin', 'apres_midi', 'soir', 'nuit'])).optional(),
    // autres jours...
  }),
})

// Utilisation dans Server Action
export async function createAnnonceAuxiliaire(rawData: unknown) {
  const validatedData = annonceAuxiliaireSchema.parse(rawData) // throw si invalide

  // Suite du code...
}
```

---

## Récapitulatif Final

### Stack Complet

```
Frontend:
  Next.js 15 (App Router) + React + TypeScript + TailwindCSS

Backend:
  Supabase (Postgres + Auth + Storage + Realtime + RLS)

Paiements:
  Stripe (Checkout + Customer Portal + Webhooks)

Emails:
  Resend + React Email (templates)

PDF:
  jsPDF (génération contrats)

Déploiement:
  Vercel (hosting + CRON jobs + Edge Functions)

Sécurité:
  - RLS sur toutes les tables
  - Chiffrement AES-256 données sensibles
  - Rate Limiting (Upstash Redis)
  - Audit logging admin actions
  - Conformité RGPD complète
```

### Fonctionnalités Clés Implémentées

✅ **Inscription & Validation**
- Formulaire multi-étapes auxiliaires
- Upload justificatifs (Supabase Storage)
- Validation manuelle admin (objectif 48h)
- Notification email selon décision

✅ **Système d'Abonnements**
- Stripe Checkout (mensuel/annuel)
- Webhooks synchronisation
- Hard paywall (RLS)
- Période lancement (mois offerts)

✅ **Marketplace Bidirectionnelle**
- Annonces auxiliaires + bénéficiaires
- Profils structurés (diplôme, spécialités, expérience)
- Recherche et filtres avancés
- Favoris

✅ **Matching Intelligent 6 Critères**
- Spécialités (≥1 commune)
- Zone géographique (rayon km)
- Disponibilités horaires (jour×créneau)
- Diplôme (si spécifié)
- Expérience (si spécifiée)
- Budget/Tarif avec badges PCH/APA

✅ **Système de Badges**
- 📢 Annonce active (priorisation recherche)
- 🥉🥈🥇 Ancienneté (1/3/5 ans)
- 💚 Tarif modulable PCH
- 💙 Tarif modulable APA

✅ **Notifications Email Personnalisées**
- Matching standard
- Matching PCH (avec message spécial)
- Matching APA (avec message spécial)
- Validation acceptée/refusée/à compléter
- Nouveau message
- Résumé hebdomadaire
- Alerte expiration abonnement

✅ **Messagerie Real-time**
- Chat WebSocket (Supabase Realtime)
- Conversations privées
- Notifications nouveau message

✅ **Génération Contrats**
- PDF automatique (jsPDF)
- Stockage sécurisé (Supabase Storage)
- Signatures électroniques (optionnel)

✅ **Jobs & Automatisations**
- Mise à jour badges (quotidien 2h)
- Résumé hebdomadaire (lundi 9h)
- Alerte expiration (quotidien 10h)
- Nettoyage logs (dimanche 3h)

✅ **Sécurité & RGPD**
- RLS complet sur toutes les tables
- Chiffrement données sensibles
- Rate limiting
- Audit logging
- Droit à l'oubli
- Export données personnelles
- Politique de confidentialité

---

**Document complet** ✅

Ce document d'architecture technique couvre l'intégralité du système roxanetnous avec :
- 18 tables Postgres avec ENUMs, relations, indexes
- RLS policies complètes pour isolation données
- API Routes (webhooks Stripe, CRON jobs, admin)
- Server Actions (mutations)
- Algorithme de matching 6 critères avec logique PCH/APA
- Système de badges (5 types) avec triggers + jobs
- Templates email React (9 types)
- Stockage fichiers sécurisé (justificatifs, contrats)
- Génération PDF contrats
- 4 jobs CRON automatisés
- Sécurité multi-couches + conformité RGPD

**Prêt pour l'implémentation** ! 🚀
