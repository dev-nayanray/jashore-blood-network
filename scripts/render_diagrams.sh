#!/usr/bin/env bash
# Render all Mermaid diagrams to PNG at 2x scale for print quality.
set -euo pipefail

DIR="/home/z/my-project/scripts/diagrams"
OUT="$DIR/png"
mkdir -p "$OUT"

DIAGRAMS=(
  "01_system_architecture"
  "02_role_hierarchy"
  "03_request_lifecycle"
  "04_auth_flow"
  "05_er_diagram"
  "06_deployment"
  "07_phase_timeline"
)

for d in "${DIAGRAMS[@]}"; do
  echo "=== Rendering $d ==="
  mmdc \
    -i "$DIR/$d.mmd" \
    -o "$OUT/$d.png" \
    --size 1600 \
    -s 2 \
    -b white \
    -p "$DIR/puppeteer-config.json" \
    2>&1 || echo "FAILED: $d"
done

echo ""
echo "=== Output files ==="
ls -lh "$OUT/"
