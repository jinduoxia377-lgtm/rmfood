"""Verify peptide database tables"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.database_url.replace('postgresql+asyncpg', 'postgresql'))

with engine.connect() as conn:
    # Check peptide tables
    result = conn.execute(text(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name LIKE '%peptide%' "
        "ORDER BY table_name"
    ))
    print("Peptide tables:")
    for row in result.fetchall():
        print(f"  - {row[0]}")

    # Check peptide_structures columns
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='peptide_structures' "
        "ORDER BY ordinal_position"
    ))
    print("\npeptide_structures columns:")
    for row in result.fetchall():
        print(f"  - {row[0]}")

    # Check peptide_structure_analyses columns
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='peptide_structure_analyses' "
        "ORDER BY ordinal_position"
    ))
    print("\npeptide_structure_analyses columns:")
    for i, row in enumerate(result.fetchall()):
        if i < 15:
            print(f"  - {row[0]}")
        else:
            print(f"  ... ({result.rowcount - 15} more)")
            break

    # Check has_structure column
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='peptide_analyses' "
        "AND column_name='has_structure'"
    ))
    print("\nhas_structure in peptide_analyses:")
    if result.fetchone():
        print("  - EXISTS")
    else:
        print("  - NOT FOUND")
