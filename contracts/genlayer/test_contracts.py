# Direct/integration tests are intended for gltest. This file intentionally avoids mocked web evidence.
# Run: gltest run --network studionet
from pathlib import Path

def test_all_contracts_pin_runner():
    for p in Path(__file__).parent.glob("*.py"):
        if p.name.startswith("test_"): continue
        first=p.read_text().splitlines()[0]
        assert "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" in first
