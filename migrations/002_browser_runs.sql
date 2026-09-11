CREATE TABLE run_inputs (
  run_id text PRIMARY KEY REFERENCES runs(id),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
  byte_size integer NOT NULL CHECK (byte_size > 0),
  image_bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (octet_length(image_bytes) = byte_size)
);

CREATE INDEX run_inputs_expiry_idx ON run_inputs (expires_at);
