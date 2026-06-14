# 📋 Codex Task List - Wedding Dashboard

**Start Date:** 2026-06-10  
**Target Completion:** 2026-06-17  
**Total Tasks:** 10  
**Estimated Duration:** 8-9 hours  

---

## 🎯 Week 1: Foundation

### ✅ Status: Ready to Start

```
Tasks 1-10: 0% Complete (0/10)
```

---

## TASK-001: Import Database Schema

**Epic:** Foundation (Week 1)  
**Story:** Database Setup & Backend Models  
**Estimate:** 30 min  
**Difficulty:** Easy  
**Status:** ⏳ READY TO START

### Description
Import the PostgreSQL database schema to the wedding database. The schema file exists but needs to be imported to create all 11 tables.

### Acceptance Criteria
- [ ] Schema file located (schema.sql)
- [ ] Connected to wedding database on 192.168.0.32
- [ ] Schema imported successfully
- [ ] All 11 tables created
- [ ] Foreign keys intact
- [ ] Can query tables without error
- [ ] Verified with SELECT COUNT(*) on each table

### Implementation Notes
```bash
# SSH to VM
ssh deploy@192.168.0.32

# Locate schema
cd ~/wedding-dashboard
ls -la schema.sql

# Copy to production directory if needed
cp schema.sql production/database/

# Import
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding -f schema.sql

# Verify
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding
\dt  # List tables
SELECT COUNT(*) FROM guests;  # Test query
```

### Testing Strategy
```bash
# Verify all tables exist
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding -c "\dt"

# Expected output: 11 tables
# - weddings
# - wedding_party
# - users
# - guests
# - vendors
# - budget_categories
# - budget_items
# - tasks
# - events
# - tables
# - seating_arrangements
```

### Files to Create/Modify
- [ ] production/database/schema.sql (copy from root if needed)
- [ ] No code files for this task

### Branch Name
```
feature/db-schema-import
```

### Commit Message
```
chore(database): import schema and create all 11 tables

- Imported schema.sql to wedding database
- Created all 11 required tables
- Verified foreign key relationships
- Tested basic queries
```

---

## TASK-002: Create Guest SQLAlchemy Model

**Epic:** Foundation (Week 1)  
**Story:** Database Setup & Backend Models  
**Estimate:** 45 min  
**Difficulty:** Easy  
**Status:** ⏳ READY (after TASK-001)

### Description
Create SQLAlchemy ORM model for the Guest table. This model bridges the database and FastAPI.

### Acceptance Criteria
- [ ] File created: production/backend/app/db/models.py
- [ ] Guest class defined with all fields
- [ ] All fields map to database columns
- [ ] Datetime fields use proper types
- [ ] Model can be imported without error
- [ ] Model is registered with Base

### Implementation Notes
```python
# production/backend/app/db/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Guest(Base):
    __tablename__ = "guests"
    
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20), nullable=True)
    status = Column(String(50), default="invited")
    dietary_restrictions = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Add other fields from schema
```

### Testing Strategy
```python
# In Python shell
from app.db.models import Guest, Base
from app.db.database import engine

# Verify model imports
print(Guest.__tablename__)
print(Guest.__columns__)

# Check if model works with session
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
db = SessionLocal()
guests = db.query(Guest).all()
print(f"Found {len(guests)} guests")
```

### Files to Create/Modify
- [ ] production/backend/app/db/models.py (create if not exists)
- [ ] production/backend/app/db/__init__.py (ensure exists)

### Branch Name
```
feature/guest-model
```

### Commit Message
```
feat(db): create guest SQLAlchemy model

- Created Guest model mapping to guests table
- Added all fields with proper types
- Configured primary key and indexes
- Ready for API integration
```

---

## TASK-003: Create Guest CRUD API Endpoints

**Epic:** Foundation (Week 1)  
**Story:** Database Setup & Backend Models  
**Estimate:** 90 min  
**Difficulty:** Medium  
**Status:** ⏳ READY (after TASK-002)

### Description
Create FastAPI endpoints for full CRUD operations on guests. Include input validation with Pydantic models.

### Acceptance Criteria
- [ ] File created: production/backend/app/api/guests.py
- [ ] POST /api/guests endpoint working (create)
- [ ] GET /api/guests endpoint working (list all)
- [ ] GET /api/guests/{id} endpoint working (get one)
- [ ] PUT /api/guests/{id} endpoint working (update)
- [ ] DELETE /api/guests/{id} endpoint working (delete)
- [ ] Pydantic schemas for request/response
- [ ] Input validation working
- [ ] Error handling with proper status codes
- [ ] Endpoints tested with curl
- [ ] All return proper JSON responses

### Implementation Notes

**Create Pydantic schemas:**
```python
# production/backend/app/db/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class GuestCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    status: str = "invited"
    dietary_restrictions: Optional[str] = None

class GuestUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    dietary_restrictions: Optional[str] = None

class GuestResponse(GuestCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

**Create endpoints:**
```python
# production/backend/app/api/guests.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Guest
from app.db.schemas import GuestCreate, GuestUpdate, GuestResponse
from typing import List

router = APIRouter(prefix="/api/guests", tags=["guests"])

@router.post("/", response_model=GuestResponse)
async def create_guest(guest: GuestCreate, db: Session = Depends(get_db)):
    db_guest = Guest(**guest.dict())
    db.add(db_guest)
    db.commit()
    db.refresh(db_guest)
    return db_guest

@router.get("/", response_model=List[GuestResponse])
async def list_guests(db: Session = Depends(get_db)):
    return db.query(Guest).all()

@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(guest_id: int, db: Session = Depends(get_db)):
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    return guest

@router.put("/{guest_id}", response_model=GuestResponse)
async def update_guest(guest_id: int, guest: GuestUpdate, db: Session = Depends(get_db)):
    db_guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not db_guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    update_data = guest.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_guest, field, value)
    db.commit()
    db.refresh(db_guest)
    return db_guest

@router.delete("/{guest_id}")
async def delete_guest(guest_id: int, db: Session = Depends(get_db)):
    db_guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not db_guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    db.delete(db_guest)
    db.commit()
    return {"status": "deleted"}
```

**Update main.py:**
```python
from app.api import guests
app.include_router(guests.router)
```

### Testing Strategy

```bash
# Test with curl
# Create guest
curl -X POST http://localhost:3001/api/guests \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "555-1234"
  }'

# List guests
curl http://localhost:3001/api/guests

# Get specific guest
curl http://localhost:3001/api/guests/1

# Update guest
curl -X PUT http://localhost:3001/api/guests/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "accepted"}'

# Delete guest
curl -X DELETE http://localhost:3001/api/guests/1

# Check Swagger UI
# Visit http://192.168.0.32:3001/docs
```

### Files to Create/Modify
- [ ] production/backend/app/api/guests.py (create)
- [ ] production/backend/app/db/schemas.py (create)
- [ ] production/backend/app/main.py (modify - add router)
- [ ] production/backend/app/api/__init__.py (ensure exists)

### Branch Name
```
feature/guest-crud-api
```

### Commit Message
```
feat(api): add guest CRUD endpoints

- Created POST /api/guests (create guest)
- Created GET /api/guests (list all)
- Created GET /api/guests/{id} (get one)
- Created PUT /api/guests/{id} (update)
- Created DELETE /api/guests/{id} (delete)
- Added Pydantic schemas for validation
- All endpoints tested with curl
```

---

## TASK-004: Create Guest API Tests

**Epic:** Foundation (Week 1)  
**Story:** Database Setup & Backend Models  
**Estimate:** 60 min  
**Difficulty:** Medium  
**Status:** ⏳ READY (after TASK-003)

### Description
Write comprehensive pytest tests for all guest endpoints. Test success cases and error conditions.

### Acceptance Criteria
- [ ] File created: production/backend/tests/test_guests.py
- [ ] Test POST endpoint (create)
- [ ] Test GET endpoints (list and single)
- [ ] Test PUT endpoint (update)
- [ ] Test DELETE endpoint
- [ ] Test validation errors
- [ ] Test 404 errors
- [ ] All tests pass
- [ ] Test coverage >80%

### Implementation Notes
```python
# production/backend/tests/test_guests.py
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal

client = TestClient(app)

def test_create_guest():
    response = client.post("/api/guests", json={
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "phone": "555-1234"
    })
    assert response.status_code == 200
    assert response.json()["first_name"] == "John"
    return response.json()["id"]

def test_list_guests():
    response = client.get("/api/guests")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_guest():
    guest_id = test_create_guest()
    response = client.get(f"/api/guests/{guest_id}")
    assert response.status_code == 200
    assert response.json()["id"] == guest_id

def test_update_guest():
    guest_id = test_create_guest()
    response = client.put(f"/api/guests/{guest_id}", json={
        "status": "accepted"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"

def test_delete_guest():
    guest_id = test_create_guest()
    response = client.delete(f"/api/guests/{guest_id}")
    assert response.status_code == 200
    
    # Verify deleted
    response = client.get(f"/api/guests/{guest_id}")
    assert response.status_code == 404

def test_invalid_email():
    response = client.post("/api/guests", json={
        "first_name": "John",
        "last_name": "Doe",
        "email": "not-an-email"
    })
    assert response.status_code == 422  # Validation error

def test_guest_not_found():
    response = client.get("/api/guests/99999")
    assert response.status_code == 404
```

### Testing Strategy
```bash
# Run tests
cd production/backend
source venv/bin/activate
pytest tests/test_guests.py -v

# Expected output: All tests pass
```

### Files to Create/Modify
- [ ] production/backend/tests/test_guests.py (create)
- [ ] production/backend/tests/__init__.py (ensure exists)

### Branch Name
```
feature/guest-api-tests
```

### Commit Message
```
test(api): add guest CRUD endpoint tests

- Added tests for all CRUD operations
- Added validation error tests
- Added 404 error tests
- All tests passing
- 85% code coverage
```

---

## TASK-005: Create Guest List Component

**Epic:** Foundation (Week 1)  
**Story:** Frontend Guest Management  
**Estimate:** 60 min  
**Difficulty:** Medium  
**Status:** ⏳ READY (after TASK-003)

### Description
Build React component to display list of guests fetched from API. Show loading and error states.

### Acceptance Criteria
- [ ] Component created: production/frontend/src/components/GuestList.tsx
- [ ] Fetches guests from /api/guests
- [ ] Displays guests in table format
- [ ] Shows all guest fields
- [ ] Shows loading state while fetching
- [ ] Shows error state if fetch fails
- [ ] No console errors
- [ ] Responsive table layout
- [ ] Can be imported and used

### Implementation Notes
```typescript
// production/frontend/src/components/GuestList.tsx
import React, { useState, useEffect } from 'react'

interface Guest {
  id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  status: string
}

export function GuestList() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGuests()
  }, [])

  const fetchGuests = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://192.168.0.32:3001/api/guests')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setGuests(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading guests...</div>
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #ccc' }}>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {guests.map((guest) => (
          <tr key={guest.id} style={{ borderBottom: '1px solid #ddd' }}>
            <td>{guest.first_name} {guest.last_name}</td>
            <td>{guest.email}</td>
            <td>{guest.phone || '-'}</td>
            <td>{guest.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### Testing Strategy
```bash
# Verify component renders
npm test GuestList.test.tsx

# Manual test in browser
# 1. Navigate to page using component
# 2. Verify guests display
# 3. Check no console errors
```

### Files to Create/Modify
- [ ] production/frontend/src/components/GuestList.tsx (create)

### Branch Name
```
feature/guest-list-component
```

### Commit Message
```
feat(ui): add guest list component

- Created GuestList component
- Fetches from /api/guests
- Displays in responsive table
- Handles loading and error states
```

---

## TASK-006: Create Guest Form Component

**Epic:** Foundation (Week 1)  
**Story:** Frontend Guest Management  
**Estimate:** 75 min  
**Difficulty:** Medium  
**Status:** ⏳ READY (after TASK-005)

### Description
Build React form component for adding/editing guests. Include validation and error handling.

### Acceptance Criteria
- [ ] Component created: production/frontend/src/components/GuestForm.tsx
- [ ] Form inputs for all fields
- [ ] Client-side validation
- [ ] Submits to POST /api/guests
- [ ] Shows success message
- [ ] Shows error message
- [ ] Clears form after submit
- [ ] Handles API errors
- [ ] No console errors

### Implementation Notes
```typescript
// production/frontend/src/components/GuestForm.tsx
import React, { useState } from 'react'

interface GuestFormProps {
  onSuccess?: () => void
}

export function GuestForm({ onSuccess }: GuestFormProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'invited',
    dietary_restrictions: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('http://192.168.0.32:3001/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to add guest')
      }

      setSuccess(true)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        status: 'invited',
        dietary_restrictions: ''
      })

      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
      {success && <p style={{ color: 'green' }}>Guest added successfully!</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <input
        name="first_name"
        placeholder="First Name"
        value={formData.first_name}
        onChange={handleChange}
        required
      />
      <input
        name="last_name"
        placeholder="Last Name"
        value={formData.last_name}
        onChange={handleChange}
        required
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        required
      />
      <input
        name="phone"
        placeholder="Phone"
        value={formData.phone}
        onChange={handleChange}
      />
      <select
        name="status"
        value={formData.status}
        onChange={handleChange}
      >
        <option value="invited">Invited</option>
        <option value="accepted">Accepted</option>
        <option value="declined">Declined</option>
      </select>
      <textarea
        name="dietary_restrictions"
        placeholder="Dietary Restrictions"
        value={formData.dietary_restrictions}
        onChange={(e) => setFormData({ ...formData, dietary_restrictions: e.target.value })}
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Adding...' : 'Add Guest'}
      </button>
    </form>
  )
}
```

### Testing Strategy
```bash
# Manual test in browser
# 1. Navigate to page with form
# 2. Fill out all fields
# 3. Submit form
# 4. Verify success message
# 5. Verify guest appears in list
# 6. Test with invalid email (should error)
```

### Files to Create/Modify
- [ ] production/frontend/src/components/GuestForm.tsx (create)

### Branch Name
```
feature/guest-form-component
```

### Commit Message
```
feat(ui): add guest form component

- Created form for adding guests
- Client-side validation
- Submits to /api/guests
- Error and success messages
```

---

## TASK-007: Build Guests Page

**Epic:** Foundation (Week 1)  
**Story:** Frontend Guest Management  
**Estimate:** 60 min  
**Difficulty:** Medium  
**Status:** ⏳ READY (after TASK-006)

### Description
Combine GuestList and GuestForm into a complete Guests page. Add page title and styling.

### Acceptance Criteria
- [ ] Page created: production/frontend/src/pages/Guests.tsx
- [ ] Shows GuestForm component
- [ ] Shows GuestList component
- [ ] Has page title
- [ ] Has "Add Guest" button/toggle
- [ ] Form and list work together
- [ ] List refreshes after adding guest
- [ ] Mobile responsive
- [ ] No console errors

### Implementation Notes
```typescript
// production/frontend/src/pages/Guests.tsx
import React, { useState, useRef } from 'react'
import { GuestForm } from '../components/GuestForm'
import { GuestList } from '../components/GuestList'

export function Guests() {
  const [showForm, setShowForm] = useState(false)
  const listRef = useRef<any>(null)

  const handleGuestAdded = () => {
    setShowForm(false)
    // Refresh list if possible
    listRef.current?.refresh?.()
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Guest Management</h1>

      <button onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Cancel' : '+ Add Guest'}
      </button>

      {showForm && <GuestForm onSuccess={handleGuestAdded} />}

      <h2>Guests ({/* count */})</h2>
      <GuestList ref={listRef} />
    </div>
  )
}
```

### Testing Strategy
```bash
# Manual test in browser
# 1. Navigate to /guests
# 2. Verify guest list shows
# 3. Click "Add Guest" button
# 4. Fill and submit form
# 5. Verify guest appears in list
# 6. Test on mobile (responsive)
# 7. Check console (no errors)
```

### Files to Create/Modify
- [ ] production/frontend/src/pages/Guests.tsx (create)

### Branch Name
```
feature/guests-page
```

### Commit Message
```
feat(page): add guests management page

- Created Guests page
- Integrated form and list
- Form submission refreshes list
- Mobile responsive design
```

---

## TASK-008: Add Navigation & Integration

**Epic:** Foundation (Week 1)  
**Story:** Frontend Guest Management  
**Estimate:** 45 min  
**Difficulty:** Easy  
**Status:** ⏳ READY (after TASK-007)

### Description
Set up React Router and add navigation menu. Make Guests page accessible.

### Acceptance Criteria
- [ ] React Router installed and configured
- [ ] Navigation menu created
- [ ] Guests page accessible via /guests
- [ ] Home page accessible via /
- [ ] Links work and don't cause errors
- [ ] No 404s when navigating
- [ ] Navigation visible on all pages

### Implementation Notes
```typescript
// production/frontend/src/App.tsx
import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Guests } from './pages/Guests'

function Home() {
  return (
    <div>
      <h1>Wedding Dashboard</h1>
      <p>Select an item from the menu</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
        <Link to="/" style={{ marginRight: '20px' }}>Home</Link>
        <Link to="/guests">Guests</Link>
        {/* Add more links as features are built */}
      </nav>

      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/guests" element={<Guests />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

**Install React Router:**
```bash
cd production/frontend
npm install react-router-dom
```

### Testing Strategy
```bash
# Manual test in browser
# 1. Visit http://192.168.0.32:3000
# 2. Click Home link
# 3. Click Guests link
# 4. Verify page changes
# 5. Check no console errors
# 6. Test back/forward buttons
```

### Files to Create/Modify
- [ ] production/frontend/src/App.tsx (modify)
- [ ] production/frontend/package.json (install react-router-dom)

### Branch Name
```
feature/navigation-setup
```

### Commit Message
```
feat(nav): add React Router and navigation menu

- Installed react-router-dom
- Set up routing
- Added navigation menu
- Guests page accessible
```

---

## TASK-009: End-to-End Testing

**Epic:** Foundation (Week 1)  
**Story:** Testing & Quality  
**Estimate:** 45 min  
**Difficulty:** Medium  
**Status:** ⏳ READY (after TASK-008)

### Description
Comprehensive manual testing of entire guest management flow. Test adding, editing, deleting guests.

### Acceptance Criteria
- [ ] Can add guest via UI form
- [ ] Guest appears in list immediately
- [ ] Guest data persists in database
- [ ] Can view guest details
- [ ] Can edit guest
- [ ] Can delete guest
- [ ] All error messages clear
- [ ] No console errors
- [ ] Mobile responsive
- [ ] API and UI work together

### Testing Checklist
```
☐ Add Guest
  ☐ Fill all fields
  ☐ Submit form
  ☐ See success message
  ☐ Guest appears in list
  ☐ Guest in database

☐ View Guest
  ☐ Click on guest in list
  ☐ Details display correctly

☐ Edit Guest
  ☐ Change fields
  ☐ Save changes
  ☐ List updates

☐ Delete Guest
  ☐ Delete from list
  ☐ Confirmation dialog (if added)
  ☐ Guest removed from list
  ☐ Guest removed from database

☐ Edge Cases
  ☐ Duplicate email (should error)
  ☐ Invalid email (should error)
  ☐ Missing required fields (should error)
  ☐ Network error (should show error message)

☐ Performance
  ☐ <2 sec page load
  ☐ <500ms add guest
  ☐ No lag when scrolling

☐ Mobile
  ☐ Test on phone/tablet
  ☐ Responsive layout
  ☐ Form readable
  ☐ Buttons clickable
```

### Files to Test
- [ ] http://192.168.0.32:3000/guests (Frontend)
- [ ] http://192.168.0.32:3001/api/guests (API)
- [ ] Database queries

### Branch Name
```
feature/e2e-testing
```

### Commit Message
```
test(e2e): comprehensive end-to-end testing

- Tested add, edit, delete flows
- Verified data persistence
- Tested edge cases
- Validated error messages
- Confirmed mobile responsive
```

---

## TASK-010: Create PR & Validation

**Epic:** Foundation (Week 1)  
**Story:** Testing & Quality  
**Estimate:** 30 min  
**Difficulty:** Easy  
**Status:** ⏳ READY (after TASK-009)

### Description
Create final PR combining all 10 tasks. Prepare for human review and merge.

### Acceptance Criteria
- [ ] All tests passing (backend and frontend)
- [ ] Manual E2E testing complete
- [ ] PR created on GitHub
- [ ] PR description comprehensive
- [ ] No merge conflicts
- [ ] Ready for human code review

### PR Template
```markdown
## Task
Week 1 Foundation: Guest Management (Tasks 1-10)

## What This Does
Implements complete guest management system:
- Database schema imported
- Guest CRUD API endpoints
- Guest management frontend
- Full integration testing

## Changes Made
- Imported PostgreSQL schema (11 tables)
- Created Guest SQLAlchemy model
- Built guest CRUD endpoints
- Added comprehensive API tests
- Built guest list component
- Built guest form component
- Integrated into Guests page
- Added React Router navigation
- Completed E2E testing

## Testing Done
- [x] All pytest tests pass (guest API)
- [x] All npm tests pass (frontend)
- [x] Manual curl tests complete
- [x] Manual browser testing complete
- [x] E2E flow tested
- [x] Mobile responsive verified
- [x] No console errors

## Checklist
- [x] Code follows patterns
- [x] Tests pass (pytest + npm test)
- [x] Commit messages clear
- [x] PR description complete
- [x] Ready for review

## Notes for Reviewer
- Database schema created with 11 tables
- Guest endpoints fully functional
- Frontend integrates with API
- All flows tested E2E
- Ready for next week's features
```

### Branch Name
```
feature/week-1-complete
```

### Commit Message (if needed)
```
chore: mark week 1 complete, ready for review

All guest management features implemented and tested.
Ready for human review and merge.
```

---

## Summary

| Task | Status | Estimate |
|------|--------|----------|
| TASK-001: Schema Import | ⏳ Ready | 30 min |
| TASK-002: Guest Model | ⏳ Ready | 45 min |
| TASK-003: CRUD API | ⏳ Ready | 90 min |
| TASK-004: API Tests | ⏳ Ready | 60 min |
| TASK-005: Guest List | ⏳ Ready | 60 min |
| TASK-006: Guest Form | ⏳ Ready | 75 min |
| TASK-007: Guests Page | ⏳ Ready | 60 min |
| TASK-008: Navigation | ⏳ Ready | 45 min |
| TASK-009: E2E Testing | ⏳ Ready | 45 min |
| TASK-010: PR Creation | ⏳ Ready | 30 min |
| **TOTAL** | **⏳ READY** | **~540 min (9 hours)** |

---

## Success Criteria

Week 1 is complete when:

```
✅ TASK-001 merged to main
✅ TASK-002 merged to main
✅ TASK-003 merged to main
✅ TASK-004 merged to main
✅ TASK-005 merged to main
✅ TASK-006 merged to main
✅ TASK-007 merged to main
✅ TASK-008 merged to main
✅ TASK-009 merged to main
✅ TASK-010 merged to main
✅ All tests passing
✅ Feature-complete guest management
✅ Ready for Week 2
```

---

## How Codex Should Use This

1. **Read this file first** - Understand all 10 tasks
2. **Start with TASK-001** - Least complex
3. **Follow the Implementation Loop** for each task
4. **Create a separate PR for each task** (or batch 1-4 together if desired)
5. **Wait for human review** before moving to next task
6. **Update IMPLEMENTATION_LOG.md** after each task
7. **Complete all 10 tasks** by end of week

---

**Start Date:** 2026-06-10  
**Target End Date:** 2026-06-17  
**Ready to Begin:** YES ✅

