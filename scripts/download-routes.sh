#!/bin/bash

# Download and parse all bus route PDFs
# Run from project root: ./scripts/download-routes.sh

cd "$(dirname "$0")/.."

echo "🚌 Downloading and parsing PPS bus routes..."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/services/driveService.js" ]; then
  echo "❌ Error: Please run this from the project root directory"
  exit 1
fi

# Run the download script
node scripts/download-and-parse.js

















