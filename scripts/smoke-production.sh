#!/usr/bin/env bash
# Free production smoke — no API keys. Run from CI or locally.
set -euo pipefail
BASE="${PRODUCTION_URL:-https://house-pot.onrender.com}"

echo "==> Health $BASE"
code="$(curl -sS -o /tmp/hp-health.json -w "%{http_code}" --max-time 90 "$BASE/api/health")"
if [[ "$code" != "200" ]]; then
  echo "FAIL health HTTP $code"
  exit 1
fi
python3 - <<'PY'
import json
h=json.load(open("/tmp/hp-health.json"))
d=h.get("detail",{})
print("  gemma", d.get("gemma"))
print("  mongo", h.get("integrations",{}).get("storage"))
print("  themealdb", h.get("integrations",{}).get("themealdb"))
print("  openfoodfacts", h.get("integrations",{}).get("openfoodfacts"))
if not d.get("gemma",{}).get("live"):
    raise SystemExit("FAIL gemma not live")
if h.get("integrations",{}).get("storage") != "mongodb":
    print("WARN storage is not mongodb (demo may still work)")
PY
echo "OK production smoke"
