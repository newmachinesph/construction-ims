-- Sales Invoice document series for the POS.
-- Must live in its own migration: Postgres forbids using an enum value ('SI')
-- in the same transaction that added it to the type (that happened in 0004).
INSERT INTO document_series (series, prefix, next_number, padding)
VALUES ('SI', 'SI', 1, 6)
ON CONFLICT (series) DO NOTHING;
