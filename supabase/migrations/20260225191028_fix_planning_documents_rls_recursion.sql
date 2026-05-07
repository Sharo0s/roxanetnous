
-- Fix infinite recursion between planning_documents and planning_document_assignments

-- Drop the problematic policy on planning_document_assignments
DROP POLICY IF EXISTS "Beneficiaire manages document assignments" ON planning_document_assignments;

-- Recreate it without referencing planning_documents (use a direct join approach)
-- The beneficiaire can manage assignments where the document belongs to them
-- We check ownership by joining through planning_documents but using a security_definer function
CREATE OR REPLACE FUNCTION is_document_owner(doc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM planning_documents pd
    JOIN beneficiaires_profiles bp ON bp.id = pd.beneficiaire_id
    WHERE pd.id = doc_id
      AND bp.user_id = auth.uid()
  );
$$;

CREATE POLICY "Beneficiaire manages document assignments"
  ON planning_document_assignments
  FOR ALL
  USING (is_document_owner(document_id))
  WITH CHECK (is_document_owner(document_id));
