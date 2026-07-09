-- 012: couple-configurable guest-site theme.
--
-- One JSONB blob on the wedding row (single-wedding deployment) holding the
-- admin "theme dials": {"primary": "#f6c445", "secondary": "#2b064d",
-- "tint_opacity": 0.9}. NULL means "use the built-in prototype defaults";
-- validation of shape/ranges lives in the API layer (WeddingTheme schema).

ALTER TABLE weddings ADD COLUMN IF NOT EXISTS theme JSONB;
