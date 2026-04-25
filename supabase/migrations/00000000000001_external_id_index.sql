-- Supports efficient cleanup of hire-scoped vector rows (external_id LIKE '<hireId>:%')
CREATE INDEX IF NOT EXISTS runbook_documents_external_id_idx
  ON runbook_documents (external_id);
