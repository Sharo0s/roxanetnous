
-- ============================================
-- Planning Module : 6 tables + bucket + RLS
-- ============================================

-- 1. planning_subscriptions
CREATE TABLE planning_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status subscription_status NOT NULL DEFAULT 'trialing',
  plan_type text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  cancelled_at timestamptz,
  trial_end timestamptz,
  first_subscription_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE planning_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own planning subscription"
  ON planning_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all planning subscriptions"
  ON planning_subscriptions FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role manages planning subscriptions"
  ON planning_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- 2. beneficiaire_auxiliaires
CREATE TABLE beneficiaire_auxiliaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiaire_id uuid NOT NULL REFERENCES beneficiaires_profiles(id) ON DELETE CASCADE,
  auxiliaire_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couleur text NOT NULL DEFAULT '#6B7280',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(beneficiaire_id, auxiliaire_user_id)
);

ALTER TABLE beneficiaire_auxiliaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beneficiaire manages own team"
  ON beneficiaire_auxiliaires FOR ALL
  USING (
    beneficiaire_id IN (
      SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Auxiliaire reads own assignments"
  ON beneficiaire_auxiliaires FOR SELECT
  USING (auxiliaire_user_id = auth.uid());

CREATE POLICY "Admins read all teams"
  ON beneficiaire_auxiliaires FOR SELECT
  USING (is_admin());

-- 3. planning_shifts
CREATE TABLE planning_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiaire_id uuid NOT NULL REFERENCES beneficiaires_profiles(id) ON DELETE CASCADE,
  auxiliaire_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  creneaux jsonb NOT NULL DEFAULT '[]',
  total_heures decimal(5,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(beneficiaire_id, auxiliaire_user_id, date)
);

ALTER TABLE planning_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beneficiaire manages own shifts"
  ON planning_shifts FOR ALL
  USING (
    beneficiaire_id IN (
      SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Auxiliaire reads own shifts"
  ON planning_shifts FOR SELECT
  USING (auxiliaire_user_id = auth.uid());

CREATE POLICY "Admins read all shifts"
  ON planning_shifts FOR SELECT
  USING (is_admin());

CREATE INDEX idx_planning_shifts_beneficiaire_date ON planning_shifts(beneficiaire_id, date);
CREATE INDEX idx_planning_shifts_auxiliaire_date ON planning_shifts(auxiliaire_user_id, date);

-- 4. planning_documents (sans policy cross-table pour l'instant)
CREATE TABLE planning_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiaire_id uuid NOT NULL REFERENCES beneficiaires_profiles(id) ON DELETE CASCADE,
  nom_fichier text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE planning_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beneficiaire manages own documents"
  ON planning_documents FOR ALL
  USING (
    beneficiaire_id IN (
      SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all documents"
  ON planning_documents FOR SELECT
  USING (is_admin());

-- 5. planning_document_assignments
CREATE TABLE planning_document_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES planning_documents(id) ON DELETE CASCADE,
  auxiliaire_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, auxiliaire_user_id)
);

ALTER TABLE planning_document_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beneficiaire manages document assignments"
  ON planning_document_assignments FOR ALL
  USING (
    document_id IN (
      SELECT id FROM planning_documents WHERE beneficiaire_id IN (
        SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Auxiliaire reads own document assignments"
  ON planning_document_assignments FOR SELECT
  USING (auxiliaire_user_id = auth.uid());

CREATE POLICY "Admins read all document assignments"
  ON planning_document_assignments FOR SELECT
  USING (is_admin());

-- 6. planning_document_reads
CREATE TABLE planning_document_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES planning_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);

ALTER TABLE planning_document_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User manages own reads"
  ON planning_document_reads FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Beneficiaire reads document reads"
  ON planning_document_reads FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM planning_documents WHERE beneficiaire_id IN (
        SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins read all document reads"
  ON planning_document_reads FOR SELECT
  USING (is_admin());

-- Maintenant on peut ajouter la policy cross-table sur planning_documents
CREATE POLICY "Assigned auxiliaires read documents"
  ON planning_documents FOR SELECT
  USING (
    id IN (
      SELECT document_id FROM planning_document_assignments WHERE auxiliaire_user_id = auth.uid()
    )
  );

-- Bucket storage planning-documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('planning-documents', 'planning-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Beneficiaire uploads planning documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'planning-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Beneficiaire manages own planning files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'planning-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Planning document readers can download"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'planning-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR auth.uid() IN (
        SELECT pda.auxiliaire_user_id
        FROM planning_document_assignments pda
        JOIN planning_documents pd ON pd.id = pda.document_id
        WHERE pd.file_path = name
      )
    )
  );
