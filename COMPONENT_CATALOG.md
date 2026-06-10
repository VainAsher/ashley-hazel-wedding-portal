# Wedding Dashboard Component Catalog

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
| `apiBaseUrl` | string | no | `http://192.168.0.32:3001` | Override for alternate environments |
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
TASK-005 ran `npm run build` in `production/frontend` and the build passed in the VM frontend state.

## GuestForm

Path: `production/frontend/src/components/GuestForm.tsx`

### Purpose
Creates guests through `POST /api/guests` using the live guest schema.

### Exports
- `GuestForm`: React component for guest creation.

### Props

| Prop | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `apiBaseUrl` | string | no | `http://192.168.0.32:3001` | Override for alternate environments |
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
TASK-006 bundled `GuestForm.tsx` directly with esbuild and ran `npm run build` in `production/frontend`; both passed in the VM frontend state.
