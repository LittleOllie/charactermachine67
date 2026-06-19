# Character Machine 67

Standalone public-facing **Little Ollie Character Creator** — extracted from the LO Creator Suite. Same traits, layering, compatibility rules, randomize, save/load, and image export. No admin/collection pipeline.

## What's included

- Gender gate (male / female) with trait rules
- All trait categories, select/deselect for randomizer
- Live layered preview
- Hat / hair / glasses compatibility (from `data/LOCompleteV5.json`)
- Randomize, New / Start New, Save / Load (browser storage)
- Export image, export trait list, export/import selection JSON
- Generate collection collage grid

## Run locally

```bash
cd CharacterMachine67
python3 -m http.server 8080
```

Open: **http://localhost:8080**

> Do not open `index.html` as `file://` — image export and collages need `http://`.

Trait PNGs and `traits-manifest.json` are **included** in `assets/` (~214 MB) so this folder is ready to push as its own repo.

## Deploy to its own GitHub repo

1. Use `CharacterMachine67` as the repo root (trait images are already in `assets/`).

2. Initialize and push:

   ```bash
   cd CharacterMachine67
   git init
   git add .
   git commit -m "Character Machine 67 — standalone Little Ollie creator"
   git remote add origin https://github.com/YOUR_USER/CharacterMachine67.git
   git push -u origin main
   ```

3. Enable **GitHub Pages** (Settings → Pages → deploy from `main` / root) or use Netlify / Cloudflare Pages.

### Refresh trait images from the main LOCC2 project

If traits change in the parent Creator Suite:

```bash
cd CharacterMachine67
./copy-assets.sh
```

For local dev inside LOCC2 without duplicating disk space, you can use `./link-assets.sh` instead (symlink — not for GitHub push).

## Folder layout

```
CharacterMachine67/
  index.html              # App shell
  css/creator.css         # Creator styles (from suite)
  js/
    traits-registry.js    # Trait manifest loader
    creator.js            # Character Creator logic (from suite)
    cm67-init.js          # Standalone bootstrap only
  data/LOCompleteV5.json  # Hat/hair/glasses compatibility rules
  branding/               # Logos (optional)
  assets/                 # Symlink or copy of trait PNGs + manifest
  link-assets.sh          # Dev: symlink to parent assets
  copy-assets.sh          # Deploy: copy assets for standalone repo
  scripts/build-from-suite.py  # Re-extract from index.html if suite updates
```

## Updating from Creator Suite

If the main Character Creator in `index.html` changes, re-run:

```bash
python3 CharacterMachine67/scripts/build-from-suite.py
```

This only **writes inside `CharacterMachine67/`** — it does not modify the Creator Suite.

## Original Creator Suite

The full LO Creator Suite (`index.html` at repo root) is unchanged. Use this folder when you only want mates to build characters, not manage collections.
