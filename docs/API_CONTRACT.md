# API Contract Documentation

Complete mapping of all current Wedding Portal frontend API endpoints with request/response schemas and status codes.

**Base URL**: Configurable via `VITE_API_BASE_URL` environment variable (defaults to current origin)

**Authentication**: All endpoints except login require `credentials: 'include'` for cookie-based session authentication

---

## Authentication Endpoints

### POST `/api/auth/login`

**Purpose**: Authenticate user with invite code and establish session

**Request**:
- Method: POST
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "invite_code": "string"
  }
  ```

**Response** (200 OK):
```json
{
  "user": {
    "id": "number",
    "name": "string",
    "role": "couple" | "coordinator" | "guest",
    "wedding_id": "number",
    "invite_id": "number",
    "guest_id": "number | null"
  }
}
```

**Error Responses**:
- 401 Unauthorized: Invalid or expired invite code
  ```json
  {
    "detail": "string (error message)"
  }
  ```
- 400 Bad Request: Malformed request body
- 500 Server Error: Internal server error

**Used By**: `src/pages/Invite.tsx` (loginWithInviteCode)

---

### GET `/api/auth/me`

**Purpose**: Fetch current authenticated user profile

**Request**:
- Method: GET
- Headers: None required (uses session cookie)
- Credentials: Required

**Response** (200 OK):
```json
{
  "id": "number",
  "name": "string",
  "role": "couple" | "coordinator" | "guest",
  "wedding_id": "number",
  "invite_id": "number",
  "guest_id": "number | null"
}
```

**Error Responses**:
- 401 Unauthorized: No valid session or session expired
  ```json
  {
    "detail": "Not authenticated"
  }
  ```
- 500 Server Error

**Used By**: 
- `src/pages/Admin.tsx`
- `src/pages/Invite.tsx`
- `src/pages/RSVP.tsx`
- Route guards in `src/components/AuthRoutes.tsx`

---

### POST `/api/auth/logout`

**Purpose**: Terminate user session

**Request**:
- Method: POST
- Headers: None required
- Credentials: Required
- Body: None

**Response** (200 OK):
```json
{}
```

**Error Responses**:
- 401 Unauthorized: No valid session
- 500 Server Error

**Used By**: Not currently wired in UI (prepared for future logout button)

---

## Guest RSVP Endpoints

### GET `/api/guests/{guest_id}`

**Purpose**: Fetch guest RSVP record by guest ID

**Request**:
- Method: GET
- Path Parameter: `guest_id` (number)
- Credentials: Required

**Response** (200 OK):
```json
{
  "id": "number",
  "wedding_id": "number",
  "name": "string",
  "email": "string | null",
  "phone": "string | null",
  "relationship": "string | null",
  "rsvp_status": "pending" | "accepted" | "declined" | "tentative",
  "meal_choice": "chicken" | "fish" | "vegetarian" | null,
  "dietary_notes": "string | null",
  "dietary_restrictions": "string | null",
  "plus_one_name": "string | null",
  "plus_one_rsvp": "pending" | "accepted" | "declined" | "tentative" | null,
  "plus_one_dietary": "string | null",
  "table_number": "number | null",
  "seat_number": "number | null",
  "notes": "string | null",
  "created_at": "string | null (ISO 8601)",
  "updated_at": "string | null (ISO 8601)"
}
```

**Error Responses**:
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission to view this guest
- 404 Not Found: Guest does not exist
- 500 Server Error

**Used By**: `src/pages/RSVP.tsx` (fetchGuestRsvp)

---

### PATCH `/api/guests/{guest_id}`

**Purpose**: Update guest RSVP record with partial data

**Request**:
- Method: PATCH
- Path Parameter: `guest_id` (number)
- Headers: `Content-Type: application/json`
- Credentials: Required
- Body (all fields optional):
  ```json
  {
    "rsvp_status": "pending" | "accepted" | "declined" | "tentative",
    "meal_choice": "chicken" | "fish" | "vegetarian" | null,
    "dietary_notes": "string | null",
    "plus_one_name": "string | null"
  }
  ```

**Response** (200 OK):
Full updated guest record (same as GET `/api/guests/{guest_id}`)

**Error Responses**:
- 400 Bad Request: Invalid field values
  ```json
  {
    "detail": "string"
  }
  ```
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission
- 404 Not Found: Guest does not exist
- 500 Server Error

**Used By**: `src/pages/RSVP.tsx` (saveGuestRsvp)

---

### GET `/api/guests`

**Purpose**: List all guests for admin view

**Request**:
- Method: GET
- Query Parameters: 
  - `wedding_id` (optional number): Filter by wedding
- Credentials: Required

**Response** (200 OK):
```json
[
  {
    "id": "number",
    "wedding_id": "number",
    "name": "string",
    "email": "string | null",
    "phone": "string | null",
    "relationship": "string | null",
    "rsvp_status": "pending" | "accepted" | "declined" | "tentative",
    "dietary_restrictions": "string | null",
    "plus_one_name": "string | null",
    "plus_one_rsvp": "pending" | "accepted" | "declined" | "tentative" | null,
    "plus_one_dietary": "string | null",
    "table_number": "number | null",
    "seat_number": "number | null",
    "notes": "string | null",
    "created_at": "string | null",
    "updated_at": "string | null"
  }
]
```

**Error Responses**:
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission (requires couple or coordinator role)
- 500 Server Error

**Used By**: 
- `src/components/GuestList.tsx`
- `src/components/InviteManagement.tsx`

---

### POST `/api/guests`

**Purpose**: Create new guest record

**Request**:
- Method: POST
- Headers: `Content-Type: application/json`
- Credentials: Required
- Body:
  ```json
  {
    "wedding_id": "number",
    "name": "string (required)",
    "email": "string | null",
    "phone": "string | null",
    "relationship": "string | null",
    "rsvp_status": "pending" | "accepted" | "declined" | "tentative",
    "dietary_restrictions": "string | null",
    "plus_one_name": "string | null",
    "plus_one_rsvp": "pending" | "accepted" | "declined" | "tentative" | null",
    "plus_one_dietary": "string | null",
    "table_number": "number | null",
    "seat_number": "number | null",
    "notes": "string | null"
  }
  ```

**Response** (201 Created):
Full guest record (same as GET `/api/guests/{guest_id}`)

**Error Responses**:
- 400 Bad Request: Validation errors
  ```json
  {
    "detail": [
      { "msg": "string" }
    ]
  }
  ```
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission (requires couple or coordinator)
- 500 Server Error

**Used By**: `src/components/GuestForm.tsx`

---

### PUT `/api/guests/{guest_id}`

**Purpose**: Update guest record completely

**Request**:
- Method: PUT
- Path Parameter: `guest_id` (number)
- Headers: `Content-Type: application/json`
- Credentials: Required
- Body: Full guest object (same schema as POST)

**Response** (200 OK):
Full updated guest record

**Error Responses**:
- 400 Bad Request: Validation errors
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission
- 404 Not Found: Guest does not exist
- 500 Server Error

**Used By**: `src/components/GuestForm.tsx` (edit mode)

---

### DELETE `/api/guests/{guest_id}`

**Purpose**: Delete guest record

**Request**:
- Method: DELETE
- Path Parameter: `guest_id` (number)
- Credentials: Required
- Body: None

**Response** (200 OK):
```json
{
  "status": "deleted",
  "id": "number"
}
```

**Error Responses**:
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission (requires couple or coordinator)
- 404 Not Found: Guest does not exist
- 500 Server Error

**Used By**: `src/pages/Guests.tsx` (handleDeleteGuest)

---

## Invite Management Endpoints

### GET `/api/invites`

**Purpose**: List invite codes for a wedding

**Request**:
- Method: GET
- Query Parameters:
  - `wedding_id` (required number): Wedding to fetch invites for
- Credentials: Required

**Response** (200 OK):
```json
[
  {
    "id": "number",
    "code": "string",
    "wedding_id": "number",
    "role": "guest" | "coordinator" | "couple",
    "guest_id": "number | null",
    "household_name": "string | null",
    "created_at": "string (ISO 8601)"
  }
]
```

**Error Responses**:
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission (requires couple or coordinator)
- 500 Server Error

**Used By**: `src/components/InviteManagement.tsx`

---

### POST `/api/invites`

**Purpose**: Generate new invite code

**Request**:
- Method: POST
- Headers: `Content-Type: application/json`
- Credentials: Required
- Body:
  ```json
  {
    "wedding_id": "number",
    "role": "guest" | "coordinator" | "couple"
  }
  ```

**Response** (201 Created):
```json
{
  "id": "number",
  "code": "string (alphanumeric)",
  "wedding_id": "number",
  "role": "guest" | "coordinator" | "couple",
  "guest_id": "null",
  "household_name": "null",
  "created_at": "string (ISO 8601)"
}
```

**Error Responses**:
- 400 Bad Request: Invalid role or missing fields
  ```json
  {
    "detail": "string"
  }
  ```
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission (requires couple or coordinator)
- 500 Server Error

**Used By**: `src/components/InviteManagement.tsx`

---

### PATCH `/api/invites/{invite_id}`

**Purpose**: Link guest to invite code

**Request**:
- Method: PATCH
- Path Parameter: `invite_id` (number)
- Headers: `Content-Type: application/json`
- Credentials: Required
- Body:
  ```json
  {
    "guest_id": "number | null"
  }
  ```

**Response** (200 OK):
```json
{
  "id": "number",
  "code": "string",
  "wedding_id": "number",
  "role": "guest" | "coordinator" | "couple",
  "guest_id": "number | null",
  "household_name": "string | null",
  "created_at": "string (ISO 8601)"
}
```

**Error Responses**:
- 400 Bad Request: Invalid guest_id
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission
- 404 Not Found: Invite or guest does not exist
- 500 Server Error

**Used By**: `src/components/InviteManagement.tsx` (linkGuestToInvite)

---

### DELETE `/api/invites/{invite_id}`

**Purpose**: Delete/revoke invite code

**Request**:
- Method: DELETE
- Path Parameter: `invite_id` (number)
- Credentials: Required
- Body: None

**Response** (200 OK):
```json
{
  "status": "deleted",
  "id": "number"
}
```

**Error Responses**:
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User lacks permission (requires couple or coordinator)
- 404 Not Found: Invite does not exist
- 500 Server Error

**Used By**: `src/components/InviteManagement.tsx` (deleteInvite)

---

## Summary by Page/Component

| Page/Component | Endpoints Called |
|---|---|
| **Invite.tsx** | POST `/api/auth/login`, GET `/api/auth/me` |
| **Admin.tsx** | GET `/api/auth/me` |
| **RSVP.tsx** | GET `/api/auth/me`, GET `/api/guests/{id}`, PATCH `/api/guests/{id}` |
| **Guests.tsx** | GET `/api/guests`, POST `/api/guests`, PUT `/api/guests/{id}`, DELETE `/api/guests/{id}` |
| **GuestList.tsx** | GET `/api/guests` |
| **GuestForm.tsx** | POST `/api/guests`, PUT `/api/guests/{id}` |
| **InviteManagement.tsx** | GET `/api/invites`, POST `/api/invites`, PATCH `/api/invites/{id}`, DELETE `/api/invites/{id}` |
| **AuthRoutes.tsx** | GET `/api/auth/me` |

---

## Error Handling Standards

All endpoints use standardized error response format:

**Single Error**:
```json
{
  "detail": "Human-readable error message"
}
```

**Validation Errors**:
```json
{
  "detail": [
    { "msg": "Field validation message" }
  ]
}
```

**Common HTTP Status Codes**:
- **200 OK**: Successful GET, PATCH, PUT, DELETE
- **201 Created**: Successful POST (resource created)
- **400 Bad Request**: Validation errors, malformed request
- **401 Unauthorized**: Missing or invalid session
- **403 Forbidden**: Authenticated but lacks permission
- **404 Not Found**: Resource does not exist
- **500 Internal Server Error**: Server-side error

---

## New Template Endpoint Alignment

The new template's design supports the same endpoints above. Expected new routes planned:
- Additional admin dashboards (analytics, seating charts)
- Wedding settings management (future enhancement)
- Guest RSVP analytics (read-only endpoints)

**Phase 1 Migration**: Endpoints remain unchanged. Only UI components migrate from inline styles to TailwindCSS + Radix UI.

---

**Last Updated**: June 23, 2026
**Status**: Complete - All endpoints documented with full request/response schemas
