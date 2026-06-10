from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, text


def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is required", file=sys.stderr)
        return 2

    try:
        engine = create_engine(database_url)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        print("Database credential verification failed", file=sys.stderr)
        return 1

    print("Database credential verification passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
