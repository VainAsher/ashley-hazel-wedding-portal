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
Fetches guests from the backend API and renders them in a responsive, horizontally scrollable table.

### Exports
- `GuestList`: React component using `forwardRef`.
- `Guest`: TypeScript interface for the guest API response shape.
- `GuestListHandle`: ref interface exposing `refresh()`.

### Props

| Prop | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `apiBaseUrl` | string | no | `import.meta.env.VITE_API_BASE_URL ?? ''` | Empty default uses relative `/api/guests` requests through the active host/proxy |
| `onCountChange` | `(count: number) => void` | no | none | Called after successful load or error reset |

### Ref Handle

`GuestList` exposes:

```ts
interface GuestListHandle {
  refresh: () => Promise<void>
}
```

Use this from parent pages to refresh the table after form submission.

### States
- Loading: shows a loading message while fetching.
- Error: shows an alert-style error message when the API request fails.
- Empty: shows an empty state when the API returns no guests.
- Loaded: shows a table of guest fields.

### Displayed Fields
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
import { GuestList, type GuestListHandle } from '../components/GuestList'

export function GuestsPage() {
  const listRef = useRef<GuestListHandle>(null)

  return <GuestList ref={listRef} />
}
```

### Verification
TASK-005 ran `npm run build` in `production/frontend` and the build passed in the VM frontend state. TASK-008 added browser coverage for routed guest list rendering with mocked guest API data.

## GuestForm

Path: `production/frontend/src/components/GuestForm.tsx`

### Purpose
Creates guests through `POST /api/guests` using the live guest schema.

### Exports
- `GuestForm`: React component for guest creation.

### Props

| Prop | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `apiBaseUrl` | string | no | `import.meta.env.VITE_API_BASE_URL ?? ''` | Empty default uses relative `/api/guests` requests through the active host/proxy |
| `defaultWeddingId` | number | no | `1` | Initial value for the required `wedding_id` field |
| `onSuccess` | `(guest: Guest) => void` | no | none | Called with the created guest after a successful submit |

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
- Loading: disables submit and shows `Adding...`.
- Success: shows a success message and clears the form.
- Error: shows validation or API error text.

### Validation
- Wedding ID must be at least `1`.
- Name is required.
- Email must contain `@` when provided.
- Table and seat numbers must be at least `1` when provided.

### Usage

```tsx
import { GuestForm } from '../components/GuestForm'

export function GuestsPage() {
  return <GuestForm onSuccess={() => undefined} />
}
```

### Verification
TASK-006 bundled `GuestForm.tsx` directly with esbuild and ran `npm run build` in `production/frontend`; both passed in the VM frontend state. TASK-008 confirmed the routed app shell can load guest-management UI in desktop and mobile browser contexts.

## Guests Page

Path: `production/frontend/src/pages/Guests.tsx`

### Purpose
Combines guest creation and guest listing into one guest-management page.

### Exports
- `Guests`: React page component.

### Behavior
- Shows `Guest Management` heading.
- Tracks and displays the current guest count from `GuestList`.
- Toggles the `GuestForm` with Add Guest / Cancel.
- Hides the form after successful guest creation.
- Calls `GuestListHandle.refresh()` after guest creation so the table reloads.

### Dependencies
- `GuestForm`
- `GuestList`
- `GuestListHandle`

### Usage

```tsx
import { Guests } from './pages/Guests'

export function App() {
  return <Guests />
}
```

### Verification
TASK-007 bundled `Guests.tsx` directly with esbuild and ran `npm run build` in `production/frontend`; both passed in the VM frontend state. TASK-008 added Playwright route coverage that exercises this page through `/guests` on desktop and mobile browser projects.
