BEGIN;
SELECT pg_advisory_xact_lock(74190831);
CREATE TABLE IF NOT EXISTS feedback_pages (
  scope text NOT NULL,
  template text NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(scope, template)
);
CREATE TABLE IF NOT EXISTS feedback_rate_limits (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL
);
COMMIT;
