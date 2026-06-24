# Synthetic Data Schema

Date: 2026-06-10  
Source: `data/fixture.js`  
Status: WD-003 in progress

> **Scope: root static design prototype only.** This document describes the in-browser
> fixture (`data/fixture.js`) used by the original static design concept at the repo root
> (`index.html` / `app.js` / `styles.css`). It does **not** describe the production
> application under `production/`, which has its own PostgreSQL schema and FastAPI backend.
> For the real data model and API surface, see [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
> Several fixture fields (`songs`, blessing `likes`, blessing `pinned`) have no equivalent
> in production: there is no song-request feature, and production blessings use a `hidden`
> moderation flag with no likes.

## Overview

This document describes the structure and content of the synthetic data fixture used in the static Wedding Dashboard prototype. All data is fictional and designed for testing, demonstration, and browser-based prototyping only.

## Important: No Real Data

The fixture contains **no real wedding data**:
- No real guest names or contact details
- No real RSVP responses
- No real dietary restrictions or accessibility notes
- No real budget figures or payment records
- No real song requests or guest preferences
- No real household invite codes or access tokens

All names, descriptions, and responses are synthetic placeholders for UI testing and demonstration.

## Data Structure

### Guests Array

```javascript
guests: [
  {
    id: 'guest-001',              // Unique identifier (synthetic)
    name: 'Alex Palmer',           // Display name (synthetic)
    description: 'Day guest · adult meal',  // Guest type and meal category
    attending: true,               // RSVP state (can be changed in UI)
    meal: 'Jerk chicken with rice & peas',  // Selected meal option
    notesLabel: 'Dietary/allergy notes',    // Label for guest-specific notes field
    notesPlaceholder: 'e.g. nut allergy',   // Placeholder text for input
    notes: '',                     // Guest notes (empty until filled in UI)
  },
  // ... more guests
]
```

**Fields:**
- `id` — Unique identifier for the guest in this fixture
- `name` — Display name (synthetic, for testing UI)
- `description` — Role and meal type (not real guest info)
- `attending` — Boolean flag; can be toggled in the RSVP form
- `meal` — Selected meal option; must match one of `mealOptions`
- `notesLabel` — Label for the notes field (context-specific)
- `notesPlaceholder` — Placeholder text for input; hints at acceptable content
- `notes` — String; can be updated via RSVP form

### Meal Options Array

```javascript
mealOptions: [
  'Jerk chicken with rice & peas',
  'Vegetarian celebration plate',
  "Children's meal",
]
```

The available meal choices presented in the RSVP form dropdown. Guests are restricted to these options.

### Songs Array

```javascript
songs: [
  {
    id: 'song-001',             // Unique identifier
    title: 'Candy',             // Song title (real song, synthetic request)
    artist: 'Cameo',            // Artist name
    dedication: 'Requested by Alex Palmer',  // Attribution (synthetic guest)
    likes: 12,                  // Like count (can increase via UI)
  },
  // ... more songs
]
```

**Fields:**
- `id` — Unique identifier
- `title` — Song title
- `artist` — Artist/performer name
- `dedication` — Who requested the song (synthetic guest name or "preview request")
- `likes` — Number of likes; increments when users click the heart button

### Blessings Array

```javascript
blessings: [
  {
    id: 'blessing-001',         // Unique identifier
    author: 'Alex Palmer',      // Display name (synthetic)
    message: 'May your home...',  // Blessing text (synthetic message)
    likes: 18,                  // Like count (can increase via UI)
    pinned: true,               // Whether this blessing is featured/highlighted
  },
  // ... more blessings
]
```

**Fields:**
- `id` — Unique identifier
- `author` — Display name (synthetic)
- `message` — Blessing text (synthetic, safe to modify)
- `likes` — Like count; can increment via UI
- `pinned` — Boolean; indicates if the blessing is featured at the top

## App State

The `createAppState()` function returns a deep copy of the fixture data:

```javascript
{
  rsvpSubmitted: false,       // RSVP form state (false until submit button clicked)
  guests: [...],              // Deep copy of guests array
  songs: [...],               // Deep copy of songs array
  blessings: [...],           // Deep copy of blessings array
}
```

**Why deep copy?** The fixture is read-only. The app state is a mutable copy so changes made in the UI (RSVP updates, new songs, new blessings) don't affect the fixture itself.

## Safe to Modify

For testing and demonstration, you can safely modify:
- Guest names (change 'Alex Palmer' to something else)
- Blessing messages (rewrite synthetic messages)
- Song titles and artists (reference real or fictional songs)
- Meal options (add/remove options)
- Like counts (increase/decrease to simulate activity)

## Not in this fixture

The static prototype's `data/fixture.js` only models guests, meal options, songs, and
blessings. Other content shown in the static `index.html` — couple profile cards, an event
schedule/timeline, venue/map data, travel and accommodation notes, budget line items,
planning-board tasks, and vendor contacts — is hardcoded in `index.html` for the demo, not
driven by this fixture.

> These features are **not** "unimplemented" in the product overall: events/schedule,
> budget, tasks, and vendors are all fully implemented in the production app
> (`production/`) backed by PostgreSQL tables and FastAPI endpoints — see
> [`docs/ARCHITECTURE.md`](ARCHITECTURE.md). This section refers only to the limits of the
> root static prototype.

## Persisting Changes

Currently, **all changes are in-memory only**. When the page reloads:
- RSVP changes are lost
- New songs are lost
- New blessings are lost
- State resets to the fixture defaults

This is by design for the prototype. In Phase 3 (real data), localStorage or a backend service will persist changes.

## Next Steps

- **WD-003 completion:** Validate that all interactive flows work on phone, tablet, and desktop
- **WD-004:** Consider adding print/export functionality for planning and budget views
- **Phase 3:** Replace synthetic fixture with real guest data after privacy review and storage model approval
