-- Migration 023: guest mailing address.
--
-- Self-service field: while RSVP is closed (planning/event/archived phases),
-- guests can update their own email/phone/address from the RSVP page so the
-- couple always has current contact details for save-the-dates, invites, and
-- thank-you cards. NULL = not provided yet.

ALTER TABLE guests ADD COLUMN IF NOT EXISTS address VARCHAR(500);
