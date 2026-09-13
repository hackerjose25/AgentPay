CREATE TABLE providers (
  ens_name text PRIMARY KEY,
  enrollment_status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (enrollment_status IN ('ACTIVE', 'DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ens_name = lower(ens_name)),
  CHECK (position('/' in ens_name) = 0)
);

CREATE TABLE runs (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  idempotency_key text NOT NULL,
  task text NOT NULL,
  capability text NOT NULL CHECK (capability = 'invoice-extraction'),
  budget_tinybars bigint NOT NULL CHECK (budget_tinybars > 0),
  input_reference text NOT NULL,
  input_hash text NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  routing_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (session_id, idempotency_key),
  UNIQUE (session_id, id, input_hash)
);

CREATE TABLE requests (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id),
  provider_name text NOT NULL REFERENCES providers(ens_name),
  payer_account_id text NOT NULL,
  input_hash text NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  quote_snapshot jsonb NOT NULL,
  execution_status text NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (execution_status IN ('NOT_STARTED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  result jsonb,
  error jsonb,
  execution_lease_owner text,
  execution_lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, provider_name, payer_account_id, input_hash),
  CHECK ((execution_status = 'SUCCEEDED') = (result IS NOT NULL))
);

CREATE TABLE payments (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES requests(id),
  attempt_id text NOT NULL,
  payer_account_id text NOT NULL,
  amount_tinybars bigint NOT NULL CHECK (amount_tinybars > 0),
  asset text NOT NULL CHECK (asset = '0.0.0'),
  network text NOT NULL CHECK (network = 'hedera:testnet'),
  recipient_account_id text NOT NULL,
  status text NOT NULL DEFAULT 'RESERVED'
    CHECK (status IN ('RESERVED', 'SUBMITTING', 'SETTLED', 'FAILED', 'UNKNOWN')),
  transaction_reference text,
  submitted_at timestamptz,
  settled_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, attempt_id),
  UNIQUE (transaction_reference),
  CHECK (status <> 'SETTLED' OR (transaction_reference IS NOT NULL AND settled_at IS NOT NULL))
);

CREATE TABLE budget_reservations (
  id text PRIMARY KEY,
  payment_id text NOT NULL UNIQUE REFERENCES payments(id),
  payer_account_id text NOT NULL,
  run_id text NOT NULL REFERENCES runs(id),
  amount_tinybars bigint NOT NULL CHECK (amount_tinybars > 0),
  status text NOT NULL DEFAULT 'HELD'
    CHECK (status IN ('HELD', 'CONSUMED', 'RELEASED')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CHECK ((status = 'RELEASED') = (released_at IS NOT NULL))
);

-- Lock this stable payer row before computing daily availability. Held
-- reservations remain counted regardless of the UTC day when they began.
CREATE TABLE payer_budget_locks (
  payer_account_id text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_reconciliation_idx
  ON payments (network, status, updated_at)
  WHERE status IN ('SUBMITTING', 'UNKNOWN');

CREATE INDEX budget_reservations_payer_status_idx
  ON budget_reservations (payer_account_id, status, reserved_at);

CREATE INDEX requests_execution_lease_idx
  ON requests (execution_status, execution_lease_expires_at)
  WHERE execution_status = 'RUNNING';

