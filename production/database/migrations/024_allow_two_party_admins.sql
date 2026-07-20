-- Migration 024: allow up to two Best Man/Maid of Honour per party.
--
-- The couple wants two people to be able to share the Best Man (stag) /
-- Maid of Honour (hen) role per party, not just one. Drops the single-
-- holder partial unique index; the cap of two is now enforced in the API
-- (app/api/invites.py) rather than the DB, matching this table's existing
-- philosophy that DB constraints backstop app-level checks rather than
-- being the sole enforcement (see migration 021's own comment on this
-- index -- the app-level check was already doing the real work).

DROP INDEX IF EXISTS uq_one_party_admin_per_party;
