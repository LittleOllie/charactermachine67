#!/usr/bin/env python3
"""Sync Character Machine 67 from main Creator Suite without modifying index.html."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CM67 = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

START_MARK = "/* =========================\n   TRAIT SELECTOR + RANDOMIZER"
END_MARK = "/* =========================\n   DOWNLOAD (COLOR + B&W LINE ART)"

SELECT_TRAIT_IMG_BLOCK = """  if (filename) {
    el.style.visibility = 'visible';
    el.src = (window.LOTraitRegistry && typeof LOTraitRegistry.traitImageUrl === 'function')
      ? LOTraitRegistry.traitImageUrl(filename)
      : encodeURI(filename);
  } else {
    el.style.visibility = 'hidden';
    el.removeAttribute('src');
    el.src = '';
  }"""

SELECT_TRAIT_CM67_BLOCK = """  if (filename) {
    loSetCreatorDisplayImgSrc(el, filename);
    if (window.LOTraitRegistry && typeof LOTraitRegistry.getTraitByPath === 'function') {
      var trMeta = LOTraitRegistry.getTraitByPath(filename);
      if (trMeta && trMeta.traitName) {
        el.title = trMeta.traitName;
        el.alt = trMeta.traitName;
      }
    }
  } else {
    loSetCreatorDisplayImgSrc(el, '');
  }"""

SUITE_APPLY_DEFAULTS = """/** Restore saved include/exclude from Collection Setup, or hoodies/bg-blur defaults on first run. */
function loApplySavedTraitSelectionOrDefaults() {
  var cfg = loLoadCollectionBuilderConfigRaw();
  if (loHasSavedTraitSelection(cfg)) {
    loApplyCollectionExclusionsToCreator(cfg);
  } else {
    applyStartupDeselectedSlots();
  }
}"""

CM67_DEFAULT_TRAIT_HELPERS = """
/** Restore saved include/exclude from Collection Setup, bundled default selection, or hoodies/bg-blur defaults. */
function loFindLocalTraitForImport(slot, importedTrait) {
  var want = importedTrait.image || importedTrait.path || '';
  if (!want || !TRAIT_DATA[slot]) return null;
  var wantLower = String(want).toLowerCase();
  return TRAIT_DATA[slot].find(function (t) {
    if (!t) return false;
    var p = (t.path || t.image || '').toLowerCase();
    if (p === wantLower) return true;
    if (window.LOTraitRegistry && LOTraitRegistry.getTraitByPath(want) === t) return true;
    return false;
  }) || null;
}

function loApplyTraitSelectionFromObject(importedData) {
  if (!importedData || typeof importedData !== 'object') return 0;
  loSyncTraitDataFromRegistry();
  var matched = 0;
  Object.keys(importedData).forEach(function (slot) {
    if (!TRAIT_DATA[slot] || !Array.isArray(importedData[slot])) return;
    importedData[slot].forEach(function (importedTrait) {
      var localTrait = loFindLocalTraitForImport(slot, importedTrait);
      if (localTrait) {
        localTrait.selected = !!importedTrait.selected;
        matched++;
      }
    });
  });
  if (matched && typeof loRefreshAllCreatorTraitUi === 'function') loRefreshAllCreatorTraitUi();
  return matched;
}

function loLoadDefaultTraitSelection() {
  return fetch(LO_DEFAULT_TRAIT_SELECTION_JSON + '?v=' + Date.now()).then(function (res) {
    if (!res.ok) return null;
    return res.json();
  }).catch(function () {
    return null;
  });
}

function loApplySavedTraitSelectionOrDefaults() {
  var cfg = loLoadCollectionBuilderConfigRaw();
  if (loHasSavedTraitSelection(cfg)) {
    loApplyCollectionExclusionsToCreator(cfg);
    return Promise.resolve();
  }
  return loLoadDefaultTraitSelection().then(function (data) {
    if (data && data.excludedTraitIdsBySlot && typeof data.excludedTraitIdsBySlot === 'object') {
      loApplyCollectionExclusionsToCreator(data);
      return;
    }
    if (data && loApplyTraitSelectionFromObject(data)) return;
    applyStartupDeselectedSlots();
  });
}
"""

LO_SET_CREATOR_DISPLAY_IMG_SRC = """
function loSetCreatorDisplayImgSrc(el, filename) {
  if (!el) return;
  if (filename) {
    el.style.visibility = 'visible';
    var url = (window.LOTraitRegistry && typeof LOTraitRegistry.traitImageUrl === 'function')
      ? LOTraitRegistry.traitImageUrl(filename)
      : encodeURI(filename);
    el.onerror = function loCreatorDisplayImgErr() {
      el.onerror = null;
      var clean = String(filename).trim().split('#')[0].split('?')[0];
      var isFile = window.location && window.location.protocol === 'file:';
      var fb = (window.LOTraitRegistry && typeof LOTraitRegistry.encodeAssetPath === 'function')
        ? LOTraitRegistry.encodeAssetPath(clean)
        : encodeURI(clean);
      if (!isFile) fb += '?t=' + Date.now();
      if (el.src !== fb) el.src = fb;
    };
    el.src = url;
  } else {
    el.onerror = null;
    el.style.visibility = 'hidden';
    el.removeAttribute('src');
    el.src = '';
  }
}
"""


def extract_creator_js() -> str:
    text = INDEX.read_text(encoding="utf-8")
    start = text.find(START_MARK)
    end = text.find(END_MARK)
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("Could not locate creator JS block in index.html")
    return text[start:end]


def patch_creator_js(js: str) -> str:
    js = js.replace(
        "var LO_CREATOR_COMPAT_JSON = 'LOCompleteV5.json';",
        "var LO_CREATOR_COMPAT_JSON = 'data/LOCompleteV5.json';\n"
        "var LO_DEFAULT_TRAIT_SELECTION_JSON = 'data/default-trait-selection.json';",
    )
    js = js.replace(
        "  http://localhost:8080\n\n' +\n    'Collages and exports work there.';",
        "  http://localhost:8080/CharacterMachine67\n\n' +\n    'Collages and exports work there.';",
    )
    js = js.replace(SELECT_TRAIT_IMG_BLOCK, SELECT_TRAIT_CM67_BLOCK)
    js = js.replace(SUITE_APPLY_DEFAULTS, CM67_DEFAULT_TRAIT_HELPERS.strip() + "\n")
    if "function loSetCreatorDisplayImgSrc" not in js:
        js = js.replace(
            "function loSetHandItemSlotDirect(slot, filename) {",
            LO_SET_CREATOR_DISPLAY_IMG_SRC.strip() + "\n\nfunction loSetHandItemSlotDirect(slot, filename) {",
        )
  # initTraitCulling: refresh thumb URLs after registry metadata wire-up
    js = js.replace(
        "        img.alt = t.traitName || img.alt;\n      }\n      var wrap = img.closest('.trait-thumb-wrap');",
        "        img.alt = t.traitName || img.alt;\n"
        "        if (window.LOTraitRegistry && typeof LOTraitRegistry.traitImageUrl === 'function') {\n"
        "          img.src = LOTraitRegistry.traitImageUrl(t);\n"
        "        }\n"
        "      }\n      var wrap = img.closest('.trait-thumb-wrap');",
        1,
    )
    if "e.preventDefault();\n      e.stopPropagation();" not in js:
        js = js.replace(
            "    if (img && img.dataset.slot) {\n      var wrap = img.closest('.trait-thumb-wrap');",
            "    if (img && img.dataset.slot) {\n"
            "      e.preventDefault();\n"
            "      e.stopPropagation();\n"
            "      var wrap = img.closest('.trait-thumb-wrap');",
            1,
        )
    return js


def extract_creator_css() -> str:
    lines = INDEX.read_text(encoding="utf-8").splitlines()
    return "\n".join(lines[62:74] + [""] + lines[2422:3393]) + "\n"


def sync_traits_registry() -> None:
    src = ROOT / "traits-registry1.js"
    if not src.is_file():
        src = ROOT / "traits-registry.js"
    text = src.read_text(encoding="utf-8")
    if "MANIFEST_CACHE_REV" not in text:
        text = text.replace(
            "  var REMOVE_THUMB = 'assets/traits/HATS/REMOVE.png';\n",
            "  var REMOVE_THUMB = 'assets/traits/HATS/REMOVE.png';\n"
            "  var MANIFEST_CACHE_REV = '';\n",
        )
    if "function loIsFileProtocol" not in text:
        text = text.replace(
            "  function traitImageUrl(traitOrPath) {",
            """  /** file:// pages cannot load images when ?query cache-bust is appended (breaks only updated traits). */
  function loIsFileProtocol() {
    try {
      return typeof location !== 'undefined' && location.protocol === 'file:';
    } catch (e) {
      return false;
    }
  }

  function traitImageCacheBust(traitOrPath, path) {
    if (loIsFileProtocol()) return '';
    var parts = [];
    if (typeof traitOrPath === 'object' && traitOrPath && traitOrPath.fileMtime) {
      parts.push('v=' + traitOrPath.fileMtime);
    } else {
      var t = getTraitByPath(path);
      if (t && t.fileMtime) parts.push('v=' + t.fileMtime);
    }
    if (MANIFEST_CACHE_REV) parts.push('r=' + encodeURIComponent(MANIFEST_CACHE_REV));
    return parts.length ? '?' + parts.join('&') : '';
  }

  function traitImageUrl(traitOrPath) {""",
        )
        text = text.replace(
            """    var bust = '';
    if (typeof traitOrPath === 'object' && traitOrPath && traitOrPath.fileMtime) {
      bust = '?v=' + traitOrPath.fileMtime;
    } else {
      var t = getTraitByPath(path);
      if (t && t.fileMtime) bust = '?v=' + t.fileMtime;
    }
    return encodeAssetPath(path) + bust;""",
            "    return encodeAssetPath(path) + traitImageCacheBust(traitOrPath, path);",
        )
        text = text.replace(
            "    return fetch(bust).then(function (res) {",
            "    return fetch(bust, { cache: 'no-store' }).then(function (res) {",
        )
        text = text.replace(
            "    }).then(function (manifest) {\n      buildRegistryFromManifest(manifest);",
            "    }).then(function (manifest) {\n"
            "      MANIFEST_CACHE_REV = (manifest && manifest.generatedAt) ? String(manifest.generatedAt) : String(Date.now());\n"
            "      buildRegistryFromManifest(manifest);",
        )
        text = text.replace(
            "    img.decoding = 'async';\n    img.alt = trait.traitName;",
            "    img.decoding = 'async';\n    img.draggable = false;\n    img.alt = trait.traitName;",
        )
        text = text.replace(
            "      img.src = fallback + '?t=' + Date.now();",
            "      img.src = loIsFileProtocol() ? fallback : (fallback + '?t=' + Date.now());",
        )
    (CM67 / "js" / "traits-registry.js").write_text(text, encoding="utf-8")


def sync_assets() -> None:
    src_traits = ROOT / "assets" / "traits"
    dst_traits = CM67 / "assets" / "traits"
    if not src_traits.is_dir():
        return
    dst_traits.mkdir(parents=True, exist_ok=True)
    for path in src_traits.rglob("*"):
        if path.is_dir():
            continue
        rel = path.relative_to(src_traits)
        dest = dst_traits / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
    shutil.copy2(ROOT / "assets" / "traits-manifest.json", CM67 / "assets" / "traits-manifest.json")


def main() -> None:
    js = patch_creator_js(extract_creator_js())
    (CM67 / "js" / "creator.js").write_text(js, encoding="utf-8")
    (CM67 / "css" / "creator.css").write_text(extract_creator_css(), encoding="utf-8")
    sync_traits_registry()
    sync_assets()
    compat = ROOT / "LOCompleteV5.json"
    if compat.is_file():
        shutil.copy2(compat, CM67 / "data" / "LOCompleteV5.json")
    default_sel = CM67 / "data" / "default-trait-selection.json"
    if not default_sel.is_file():
        print("Note: default-trait-selection.json unchanged (not in suite root)")
    build = ROOT / "scripts" / "build-trait-manifest.py"
    if build.is_file():
        subprocess.run(["python3", str(build)], check=True, cwd=ROOT)
        shutil.copy2(ROOT / "assets" / "traits-manifest.json", CM67 / "assets" / "traits-manifest.json")
    print("Synced Character Machine 67 from Creator Suite:", CM67)


if __name__ == "__main__":
    main()
