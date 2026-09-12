-- Widen the runs capability constraint to support invoice question answering.
ALTER TABLE runs DROP CONSTRAINT runs_capability_check;
ALTER TABLE runs ADD CONSTRAINT runs_capability_check
  CHECK (capability IN ('invoice-extraction', 'invoice-qa'));

-- The natural-language question for invoice-qa runs; null for extraction runs.
ALTER TABLE runs ADD COLUMN question text;
ALTER TABLE runs ADD CONSTRAINT runs_question_required_for_qa
  CHECK ((capability = 'invoice-qa') = (question IS NOT NULL));