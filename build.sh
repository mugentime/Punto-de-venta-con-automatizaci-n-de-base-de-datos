#!/bin/bash
echo "Building static assets..."
mkdir -p dist
cp -r public/* dist/ 2>/dev/null || true
cp *.html dist/ 2>/dev/null || true
echo "Static build complete"