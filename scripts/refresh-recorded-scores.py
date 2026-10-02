import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/backend"))
from code_groove.source import run_node  # noqa: E402

kit = json.loads((ROOT / "apps/web/public/audio/midnight-jazz-v3/manifest.json").read_text())
for path in (ROOT / "fixtures/recorded-live").glob("*.json"):
    bundle = json.loads(path.read_text(encoding="utf-8"))
    bundle["score"] = run_node("groove-core", {"map": bundle["map"], "kit_hash": kit["kit_hash"]})
    path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.stem}: musical score upgraded; Agent interpretation and trace preserved")
