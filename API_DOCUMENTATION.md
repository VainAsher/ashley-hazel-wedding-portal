# Wedding Dashboard API Documentation

## Guest Management

Base path: `/api/guests`

The guest API follows the imported production schema. Guests belong to a wedding through `wedding_id` and use a single `name` field.

### Guest Fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | integer | response only | Primary key |
| `wedding_id` | integer | yes | Must reference an existing wedding |
| `name` | string | yes | 1-255 characters |
| `email` | string | no | Basic `@` validation |
| `phone` | string | no | Max 20 characters |
| `relationship` | string | no | Max 100 characters |
| `rsvp_status` | string | no | `pending`, `accepted`, `declined`, or `tentative`; defaults to `pending` |
| `dietary_restrictions` | string | no | Free text |
| `plus_one_name` | string | no | Max 255 characters |
| `plus_one_rsvp` | string | no | Same RSVP values |
| `plus_one_dietary` | string | no | Free text |
| `table_number` | integer | no | Must be >= 1 when provided |
| `seat_number` | integer | no | Must be >= 1 when provided |
| `notes` | string | no | Free text |
| `created_at` | datetime | response only | Database timestamp |
| `updated_at` | datetime | response only | Database timestamp |

### Create Guest

`POST /api/guests`

Request:

```json
{
  "wedding_id": 1,
  "name": "Alex Guest",
  "email": "alex@example.com",
  "phone": "555-0100",
  "relationship": "friend",
  "rsvp_status": "pending"
}
```

Responses:
- `201 Created` with the created guest JSON.
- `400 Bad Request` if `wedding_id` does not reference an existing wedding.
- `422 Unprocessable Entity` for validation errors.

### List Guests

`GET /api/guests`

Optional query parameters:
- `skip`: offset, default `0`
- `limit`: maximum number of rows, default `100`

Response:

```json
[
  {
    "id": 1,
    "wedding_id": 1,
    "name": "Alex Guest",
    "email": "alex@example.com",
    "phone": "555-0100",
    "relationship": "friend",
    "rsvp_status": "pending",
    "dietary_restrictions": null,
    "plus_one_name": null,
    "plus_one_rsvp": null,
    "plus_one_dietary": null,
    "table_number": null,
    "seat_number": null,
    "notes": null,
    "created_at": "2026-06-10T17:00:00",
    "updated_at": "2026-06-10T17:00:00"
  }
]
```

### Get Guest

`GET /api/guests/{guest_id}`

Responses:
- `200 OK` with guest JSON.
- `404 Not Found` when the guest does not exist.

### Update Guest

`PUT /api/guests/{guest_id}`

Request fields are optional. Example:

```json
{
  "rsvp_status": "accepted",
  "notes": "Confirmed by phone"
}
```

Responses:
- `200 OK` with updated guest JSON.
- `400 Bad Request` if an updated `wedding_id` does not reference an existing wedding.
- `404 Not Found` when the guest does not exist.
- `422 Unprocessable Entity` for validation errors.

### Delete Guest

`DELETE /api/guests/{guest_id}`

Response:

```json
{
  "status": "deleted",
  "id": 1
}
```

Responses:
- `200 OK` after deletion.
- `404 Not Found` when the guest does not exist.
