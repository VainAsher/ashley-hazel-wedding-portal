# Wedding Dashboard Component Catalog

## App Shell

Path: `production/frontend/src/App.tsx`

### Purpose
Provides the browser app shell, primary navigation, and route integration for dashboard pages.

### Exports
- `App`: React root component wrapped in `BrowserRouter`.

### Routes
| Route | Component | Notes |
|---|---|---|
| `/` | Home dashboard view | Provides the entry point and link to guest management |
| `/guests` | `Guests` | Renders guest creation and guest list workflow |
| `*` | Redirect to `/` | Keeps unknown browser routes accessible and recoverable |

### Behavior
- Shows persistent primary navigation with Home and Guests links.
- Applies active navigation styling through `NavLink`.
- Allows direct browser access to `/guests`.
- Redirects unknown routes back to Home.

### Dependencies
- `react-router-dom`
- `Guests`

### Verification
TASK-008 ran `npm run build` and `npm run test:browser`. Browser validation covered desktop Chromium and Pixel 5 mobile scenarios for home-to-guests navigation, direct `/guests` access, fallback routing, mocked guest data rendering, and no console/page errors.

## GuestList

Path: `production/frontend/src/components/GuestList.tsx`

### Purpose
Fetches guests from the backend API and renders them in a responsive, horizontally scrollable table with optional row-level actions.

### Exports
- `GuestList`: React component using `forwardRef`.
- `Guest`: TypeScript interface for the guest API response shape.
- `GuestListHandle`: ref interface exposing `refresh()`.

### Props

| Prop | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `apiBaseUrl` | string | no | `import.meta.env.VITE_API_BASE_URL ?? ''` | Empty default uses relative `/api/guests` requests through the active host/proxy |
| `onCountChange` | `(count: number) => void` | no | none | Called after successful load or error reset |
| `onSelectGuest` | `(guest: Guest) => void` | no | none | Adds a View action for opening details |
| `onEditGuest` | `(guest: Guest) => void` | no | none | Adds an Edit action for loading the guest into `GuestForm` |
| `onDeleteGuest` | `(guest: Guest) => void` | no | none | Adds a Delete action for parent-owned deletion |
| `selectedGuestId` | `number | null` | no | none | Highlights the selected guest row |

### Ref Handle

`GuestList` exposes:

```ts
interface GuestListHandle {
  refresh: () => Promise<void>
}
```

Use this from parent pages to refresh the table after form submission or deletion.

### States
- Loading: shows a loading message while fetching.
- Error: shows an alert-style error message when the API request fails.
- Empty: shows an empty state when the API returns no guests.
- Loaded: shows a table of guest fields and optional actions.

### Displayed Fields
- Actions, when action callbacks are supplied
- Name
- Email
- Phone
- Relationship
- RSVP
- Dietary restrictions
- Plus one name
- Plus one RSVP
- Plus one dietary notes
- Table number
- Seat number
- Notes

### Usage

```tsx
import { useRef } from 'react'
import { GuestList, type Guest, type GuestListHandle } from '../components/GuestList'

export function GuestsPage() {
  const listRef = useRef<GuestListHandle>(null)

  return (
    <GuestList
      ref={listRef}
      onEditGuest={(guest: Guest) => undefined}
      onSelectGuest={(guest: Guest) => undefined}
    />
  )
}
```

### Verification
TASK-005 ran `npm run build` in `production/frontend` and the build passed in the VM frontend state. TASK-009 added desktop/mobile Playwright coverage for guest row view, edit, and delete actions.

## GuestForm

Path: `production/frontend/src/components/GuestForm.tsx`

### Purpose
Creates guests through `POST /api/guests` and updates guests through `PUT /api/guests/{id}` using the live guest schema.

### Exports
- `GuestForm`: React component for guest creation and editing.

### Props

| Prop | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `apiBaseUrl` | string | no | `import.meta.env.VITE_API_BASE_URL ?? ''` | Empty default uses relative `/api/guests` requests through the active host/proxy |
| `defaultWeddingId` | number | no | `1` | Initial value for the required `wedding_id` field in create mode |
| `guest` | `Guest | null` | no | none | Guest to load when `mode="edit"` |
| `mode` | `'create' | 'edit'` | no | `'create'` | Selects POST or PUT behavior and submit labels |
| `onCancel` | `() => void` | no | none | Shows a Cancel button when supplied |
| `onSuccess` | `(guest: Guest) => void` | no | none | Called with the saved guest after a successful submit |

### Fields
- Wedding ID
- Name
- Email
- Phone
- Relationship
- RSVP
- Plus one name
- Plus one RSVP
- Table number
- Seat number
- Dietary restrictions
- Plus one dietary notes
- Notes

### States
- Idle: shows the form.
- Loading: disables submit and shows `Adding...` or `Saving...`.
- Success: shows a success message and clears or refreshes form state.
- Error: shows validation or API error text.

### Validation
- Browser-native validation is disabled with `noValidate` so app-owned validation messages are visible and testable.
- Wedding ID must be at least `1`.
- Name is required.
- Email must contain `@` when provided.
- Table and seat numbers must be at least `1` when provided.

### Usage

```tsx
import { GuestForm } from '../components/GuestForm'

export function GuestsPage() {
  return <GuestForm mode="create" onSuccess={() => undefined} />
}
```

### Verification
TASK-006 bundled `GuestForm.tsx` directly with esbuild and ran `npm run build` in `production/frontend`; both passed in the VM frontend state. TASK-009 added Playwright coverage for create mode, edit mode, validation errors, API errors, and recovery after success.

## Guests Page

Path: `production/frontend/src/pages/Guests.tsx`

### Purpose
Combines guest creation, listing, details, editing, and deletion into one guest-management page.

### Exports
- `Guests`: React page component.

### Behavior
- Shows `Guest Management` heading.
- Tracks and displays the current guest count from `GuestList`.
- Toggles create mode with Add Guest / Cancel.
- Shows a detail panel for the selected guest.
- Loads a selected guest into `GuestForm` for editing.
- Deletes guests through `DELETE /api/guests/{id}` after browser confirmation.
- Refreshes `GuestList` after create, update, or delete operations.
- Shows page-level success and error feedback.

### Dependencies
- `GuestForm`
- `GuestList`
- `Guest`
- `GuestListHandle`

### Usage

```tsx
import { Guests } from './pages/Guests'

export function App() {
  return <Guests />
}
```

### Verification
TASK-007 bundled `Guests.tsx` directly with esbuild and ran `npm run build` in `production/frontend`; both passed in the VM frontend state. TASK-009 validated add, view, edit, delete, API error, and validation recovery scenarios in desktop Chromium and Pixel 5 mobile browser projects.

## Browser Tests

Paths:
- `production/frontend/playwright.config.ts`
- `production/frontend/tests/browser/navigation.spec.ts`
- `production/frontend/tests/browser/guest-management.spec.ts`
- `production/frontend/tests/browser/guest-management-live.spec.ts`

### Purpose
Provides browser-based validation for routed frontend access and guest-management workflows.

### Coverage
- Navigation between `/` and `/guests`.
- Direct `/guests` access and fallback routing.
- Guest list rendering with mocked API data.
- Add, view, edit, and delete guest flow with mocked API state.
- Validation and API error recovery.
- Optional live full-stack flow that verifies database persistence via the real API.

### Projects
- `chromium-desktop`: Desktop Chrome viewport, 1366x900.
- `chromium-mobile`: Pixel 5 emulation.

### Commands
- `npm run test:browser`: runs deterministic browser tests; live tests are skipped by default.
- `LIVE_E2E=1 LIVE_API_URL=http://127.0.0.1:3201 VITE_API_BASE_URL=http://127.0.0.1:3201 npx playwright test tests/browser/guest-management-live.spec.ts`: runs the live database-backed browser spec when a FastAPI server is available.

### Verification
TASK-009 ran `npm run test:browser` with `8 passed` and `2 skipped`, then ran the live full-stack spec with `2 passed` across desktop and mobile projects.
