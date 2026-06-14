# 🎯 Immediate Action Plan - Next 7 Days

**Start Date:** 2026-06-10  
**End Date:** 2026-06-17  
**Goal:** Import database schema and build first working features

---

## 📋 Day 1 (TODAY/Tomorrow) - Database Setup

### Task 1: Import Database Schema
```bash
# SSH to wedding-db VM
ssh deploy@192.168.0.32

# Navigate to database folder
cd ~/wedding-dashboard/production/database

# Get schema from prototype
cp ~/wedding-dashboard/schema.sql ./schema.sql

# Import to PostgreSQL
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding -f schema.sql

# Verify all tables created
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding
\dt
```

**Expected Output:** 11 tables listed
- weddings ✓
- wedding_party ✓
- users ✓
- guests ✓
- vendors ✓
- budget_categories ✓
- budget_items ✓
- tasks ✓
- events ✓
- tables ✓
- seating_arrangements ✓

**Success Criteria:** Can query `SELECT COUNT(*) FROM guests;` without error

### Task 2: Verify Database Connection
```bash
# From VM, test database
cd ~/wedding-dashboard/production/backend
source venv/bin/activate

python << 'EOF'
from sqlalchemy import create_engine, inspect

engine = create_engine('postgresql://wedding_dev:wedding_dev_2026@localhost:5432/wedding')
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"Found {len(tables)} tables:")
for table in sorted(tables):
    print(f"  - {table}")
EOF
```

**Expected Output:** List of 11 tables

**Time Estimate:** 30 minutes

---

## 📋 Day 2-3 - Backend Models & CRUD

### Task 1: Create SQLAlchemy Models
**File:** `production/backend/app/db/models.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Wedding(Base):
    __tablename__ = "weddings"
    
    id = Column(Integer, primary_key=True)
    groom_name = Column(String(255), nullable=False)
    bride_name = Column(String(255), nullable=False)
    wedding_date = Column(DateTime, nullable=False)
    location = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

class Guest(Base):
    __tablename__ = "guests"
    
    id = Column(Integer, primary_key=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    status = Column(String(50), default="invited")
    dietary_restrictions = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

# Create similar models for:
# - Vendor
# - BudgetCategory
# - BudgetItem
# - Task
# - Event
# - Table
# - SeatingArrangement
```

**Checklist:**
- [ ] All 11 models created
- [ ] Relationships defined with ForeignKey
- [ ] Default values set appropriately
- [ ] Timestamp fields added

**Time Estimate:** 2 hours

### Task 2: Create Database Session
**File:** `production/backend/app/db/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://wedding_dev:wedding_dev_2026@localhost:5432/wedding"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Checklist:**
- [ ] Database connection working
- [ ] Session factory created
- [ ] Dependency injection ready

**Time Estimate:** 30 minutes

### Task 3: Create First API Endpoint (Guests)
**File:** `production/backend/app/api/guests.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Guest
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/guests", tags=["guests"])

class GuestCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str = None
    status: str = "invited"
    dietary_restrictions: str = None

class GuestResponse(GuestCreate):
    id: int
    
    class Config:
        from_attributes = True

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
async def update_guest(guest_id: int, guest: GuestCreate, db: Session = Depends(get_db)):
    db_guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not db_guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    for key, value in guest.dict().items():
        setattr(db_guest, key, value)
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

**Checklist:**
- [ ] POST /api/guests works
- [ ] GET /api/guests works
- [ ] GET /api/guests/{id} works
- [ ] PUT /api/guests/{id} works
- [ ] DELETE /api/guests/{id} works

**Test in browser:**
```
http://192.168.0.32:3001/docs  # Swagger UI
```

**Time Estimate:** 1.5 hours

---

## 📋 Day 4-5 - Frontend Guest Page

### Task 1: Create Guest List Component
**File:** `production/frontend/src/pages/Guests.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useApi } from '../hooks/useApi'

interface Guest {
  id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  status: string
}

export function Guests() {
  const { data: guests, loading, error } = useApi('/api/guests')
  const [showForm, setShowForm] = useState(false)

  return (
    <div style={{ padding: '20px' }}>
      <h1>Guest Management</h1>
      
      <button onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Cancel' : '+ Add Guest'}
      </button>

      {showForm && <GuestForm onSuccess={() => setShowForm(false)} />}

      {loading && <p>Loading guests...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {guests && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc' }}>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest: Guest) => (
              <tr key={guest.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td>{guest.first_name} {guest.last_name}</td>
                <td>{guest.email}</td>
                <td>{guest.phone || '-'}</td>
                <td>{guest.status}</td>
                <td>
                  <button>Edit</button>
                  <button style={{ marginLeft: '5px' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function GuestForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'invited',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const response = await fetch('http://192.168.0.32:3001/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    if (response.ok) {
      alert('Guest added successfully!')
      onSuccess()
    } else {
      alert('Error adding guest')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
      <input
        placeholder="First Name"
        value={formData.first_name}
        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
        required
      />
      <input
        placeholder="Last Name"
        value={formData.last_name}
        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <input
        placeholder="Phone"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <button type="submit">Add Guest</button>
    </form>
  )
}
```

**Checklist:**
- [ ] Guest list displays from API
- [ ] Can add new guest
- [ ] Form validates inputs
- [ ] Success message shows
- [ ] Page loads without errors

**Time Estimate:** 2 hours

### Task 2: Add Navigation
**Update App.tsx:**
```typescript
import { Guests } from './pages/Guests'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
        <Link to="/" style={{ marginRight: '20px' }}>Home</Link>
        <Link to="/guests">Guests</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/guests" element={<Guests />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Checklist:**
- [ ] React Router installed
- [ ] Navigation working
- [ ] Guest page accessible

**Time Estimate:** 1 hour

---

## 📋 Day 6-7 - Testing & Polish

### Task 1: Test Everything
```bash
# Backend tests
cd ~/wedding-dashboard/production/backend
source venv/bin/activate
pytest tests/

# Frontend tests
cd ~/wedding-dashboard/production/frontend
npm test
```

### Task 2: Bug Fixes
- Fix any broken links
- Handle error states
- Test on mobile
- Verify API responses

### Task 3: First Commit
```bash
cd ~/wedding-dashboard
git checkout -b feature/guest-management
git add production/
git commit -m "feat(guests): add guest management CRUD with UI"
git push -u origin feature/guest-management
```

**Create PR on GitHub for review**

---

## ✅ Success Criteria for Week 1

- [x] Database imported with all 11 tables
- [x] Backend models created for Guest
- [x] First CRUD API endpoint working (guests)
- [x] Frontend guest list page working
- [x] Add guest form working
- [x] Data persists in database
- [x] API responses in Swagger UI
- [x] First PR created and ready for review
- [x] Documentation updated

---

## 📊 Expected Outcome

After 7 days, you should have:

**Backend:**
- ✅ Database connected and populated with schema
- ✅ Working guest management API
- ✅ Clean, reusable code structure
- ✅ Ready to replicate for other domains

**Frontend:**
- ✅ Guest management page
- ✅ Add/edit/delete forms
- ✅ Real-time API integration
- ✅ Responsive design

**Process:**
- ✅ Git workflow established
- ✅ Pull request process tested
- ✅ Team collaboration ready
- ✅ Testing framework in place

---

## 🚀 Week 2 Preview

Once Week 1 is done, Week 2 will involve:
- Adding vendor management (replicate guest pattern)
- Adding budget tracking
- Adding task management
- Building dashboard summary view
- Connecting all domains together

---

## 📞 Questions to Answer Before Starting

1. **Guest database has existing data?**
   - If yes: Export from Google Sheets and import
   - If no: Start fresh, add test data

2. **Who is testing the system?**
   - Wedding couple (Ashley & Hazel)
   - Wedding planner
   - Guests

3. **What's the priority order?**
   - Guests (most important)
   - Budget
   - Vendors
   - Tasks/Timeline

4. **Mobile access important?**
   - Yes: Prioritize responsive design
   - No: Focus on desktop first

---

## 💡 Pro Tips

1. **Commit often** - Small commits are easier to review
2. **Test as you go** - Don't wait until the end
3. **Ask for feedback** - Get early feedback on design
4. **Document decisions** - Write down why you chose something
5. **Keep code clean** - Refactor as you go

---

## 🎯 Remember

You have a fully functional development environment. Everything you need is running. All you need to do is:

1. Import the schema
2. Create the models
3. Build the API
4. Build the frontend
5. Test everything
6. Push to GitHub

**That's it. You've got this!** 🚀

---

**Ready to start?** Follow the Day 1 steps above and you'll have your first working feature in 7 days!

