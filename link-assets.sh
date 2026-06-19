#!/bin/bash
# Link trait assets from parent LOCC2 project (run from CharacterMachine67 folder).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
if [ -L assets ]; then rm assets; fi
if [ -d assets ]; then echo "assets/ folder already exists — remove or rename it first."; exit 1; fi
ln -s ../assets assets
echo "Linked assets -> ../assets"
