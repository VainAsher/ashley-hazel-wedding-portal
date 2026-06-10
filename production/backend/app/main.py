"""FastAPI main application"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import guests


app = FastAPI(title="Wedding Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(guests.router)


@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Wedding Dashboard API is running!"}


@app.get("/")
async def root():
    return {"message": "Welcome to Wedding Dashboard API"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3001)
