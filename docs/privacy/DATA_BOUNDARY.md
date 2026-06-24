# Data Boundary

Date: 2026-06-09

## Rule

This repo is wedding/PII-sensitive by domain. Use synthetic or placeholder data until explicitly approved otherwise.

## Allowed

- fake guest names
- fake household groupings
- fake meal choices
- fake budget rows
- fake music requests
- fake blessing-wall messages
- UI screenshots that contain only placeholder data

## Not Allowed

- real guest names
- real addresses
- real phone numbers
- real email addresses
- real dietary/accessibility notes
- real RSVP answers
- real invite codes
- private budget/account details
- exported guest spreadsheets

## Before Real Data

Before this repo handles real data, create and approve:

1. storage model
2. access model
3. backup/export model
4. data retention rule
5. manual privacy review checklist

## Current status (v1.0.0-rc1)

As of v1.0.0-rc1 the production database holds **synthetic/demo data only** — seeded by
migration `008_seed_test_data.sql` (e.g. "Demo Guest", "Alice Anderson", "Bob Butler", and
the `DEMO-COUPLE` / `DEMO-COORDINATOR` / `DEMO-GUEST` invite codes). No real wedding PII is
stored yet, and all five pre-approval items above remain open.
