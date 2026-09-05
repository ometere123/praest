# Direct/integration tests are intended for gltest. This file intentionally avoids mocked web evidence.
# Run: gltest run --network studioDevnet
from pathlib import Path

# v0.3.0 header format is "# v0.3.0" on line 1 then the Depends comment on line 2 - check the
# first two lines rather than assuming a fixed line index.
def test_all_contracts_pin_runner():
    for p in Path(__file__).parent.glob("*.py"):
        if p.name.startswith("test_"): continue
        head = "\n".join(p.read_text().splitlines()[:2])
        assert "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" in head
