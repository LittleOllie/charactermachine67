#!/usr/bin/env python3
"""One-time extractor: builds CharacterMachine67 from LO Creator Suite index.html."""
from pathlib import Path
import shutil
import re

ROOT = Path(__file__).resolve().parent.parent.parent  # LOCC2-main
OUT = Path(__file__).resolve().parent.parent       # CharacterMachine67
INDEX = ROOT / "index.html"

def extract_lines(path: Path, start: int, end: int) -> str:
    lines = path.read_text(encoding="utf-8").splitlines()
    return "\n".join(lines[start - 1 : end]) + "\n"

def main():
    css = extract_lines(INDEX, 63, 74) + "\n" + extract_lines(INDEX, 2423, 3393)
    js = extract_lines(INDEX, 6276, 10341)
    js = js.replace(
        "var LO_CREATOR_COMPAT_JSON = 'LOCompleteV5.json';",
        "var LO_CREATOR_COMPAT_JSON = 'data/LOCompleteV5.json';",
    )
    js = js.replace(
        "  http://localhost:8080\n\n' +\n    'Collages and exports work there.';",
        "  http://localhost:8080/CharacterMachine67\n\n' +\n    'Collages and exports work there.';",
    )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "css").mkdir(exist_ok=True)
    (OUT / "js").mkdir(exist_ok=True)
    (OUT / "data").mkdir(exist_ok=True)
    (OUT / "branding").mkdir(exist_ok=True)

    (OUT / "css" / "creator.css").write_text(css, encoding="utf-8")
    (OUT / "js" / "creator.js").write_text(js, encoding="utf-8")

    src_reg = ROOT / "traits-registry1.js"
    if not src_reg.is_file():
        src_reg = ROOT / "traits-registry.js"
    if src_reg.is_file():
        shutil.copy2(src_reg, OUT / "js" / "traits-registry.js")

    compat = ROOT / "LOCompleteV5.json"
    if compat.is_file():
        shutil.copy2(compat, OUT / "data" / "LOCompleteV5.json")

    for name in ("LO.png", "websitelogo3.png", "header.png"):
        p = ROOT / name
        if p.is_file():
            shutil.copy2(p, OUT / "branding" / name)

    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Character Machine 67 — Little Ollie</title>
<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fredoka+One&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/creator.css">
<script>
window.__pendingGender = window.__pendingGender || null;
if (typeof window.setGender !== 'function') {
  window.setGender = function (g) { window.__pendingGender = g; };
}
if (typeof window.toggleGender !== 'function') {
  window.toggleGender = function () {
    if (!window.selectedGender && !window.__pendingGender) return;
    var current = window.selectedGender || window.__pendingGender;
    window.setGender(current === 'female' ? 'male' : 'female');
  };
}
</script>
</head>
<body>
<div id="transitionOverlay" aria-hidden="true"></div>

<header id="pageHeader">
  <img id="headerImage" src="branding/websitelogo3.png" alt="Little Ollie" onerror="this.style.display='none'">
  <img id="headerLOImage" src="branding/LO.png" alt="LO" onerror="this.style.display='none'">
  <p class="tagline">
    <span id="legacyHeaderTitle">Character Machine 67</span>
    <button type="button" id="toggleGenderBtn" onclick="toggleGender()" style="margin-left:10px;padding:6px 12px;font-size:12px;font-weight:800;border-radius:14px;border:none;cursor:pointer;background:#2c3e50;color:#fff;font-family:'Fredoka One', cursive;text-transform:uppercase;display:none;">
      SWITCH TO FEMALE
    </button>
  </p>
</header>

<div id="genderGate" class="gender-gate" aria-hidden="false" style="display:flex;">
  <div class="panel">
    <div class="gate-brand" aria-hidden="true">
      <img src="branding/websitelogo3.png" alt="" onerror="this.style.display='none'">
      <img src="branding/LO.png" class="logo-lo" alt="" onerror="this.style.display='none'">
    </div>
    <img src="branding/header.png" alt="Little Ollie" class="gate-logo" onerror="this.style.display='none'">
    <h2>CHOOSE A CHARACTER</h2>
    <p class="hint">SELECT A CHARACTER TO START CREATING.</p>
    <div class="buttons">
      <button type="button" class="male" id="chooseMaleBtn" disabled>CREATE MALE</button>
      <button type="button" class="female" id="chooseFemaleBtn" disabled>CREATE FEMALE</button>
    </div>
  </div>
</div>

<div id="mainContent" style="display:none;">
  <div id="topRow">
    <div id="traitSelection">
      <button class="category-button pair-background" data-category-id="backgroundCategory" data-label="BACKGROUNDS" onclick="showCategory('backgroundCategory')">BACKGROUNDS (0)</button>
      <button class="category-button pair-background" data-category-id="backgroundblurCategory" data-label="BG BLUR" onclick="showCategory('backgroundblurCategory')">BG BLUR (0)</button>
      <button class="category-button pair-skin" data-category-id="skinCategory" data-label="SKIN" onclick="showCategory('skinCategory')">SKIN (0)</button>
      <button class="category-button pair-skin" data-category-id="mouthCategory" data-label="MOUTH" onclick="showCategory('mouthCategory')">MOUTH (0)</button>
      <button class="category-button pair-clothing" data-category-id="clothingCategory" data-label="CLOTHING" onclick="showCategory('clothingCategory')">CLOTHING (0)</button>
      <button class="category-button pair-clothing" data-category-id="hoodiesCategory" data-label="HOODIES" onclick="showCategory('hoodiesCategory')">HOODIES (0)</button>
      <button class="category-button pair-eyes" data-category-id="eyesCategory" data-label="EYES" onclick="showCategory('eyesCategory')">EYES (0)</button>
      <button class="category-button pair-eyes" data-category-id="accessoriesCategory" data-label="GLASSES" onclick="showCategory('accessoriesCategory')">GLASSES (0)</button>
      <button class="category-button pair-hair" data-category-id="hairCategory" data-label="HAIR" onclick="showCategory('hairCategory')">HAIR (0)</button>
      <button class="category-button pair-hair" data-category-id="hatCategory" data-label="HEADWEAR" onclick="showCategory('hatCategory')">HEADWEAR (0)</button>
      <button class="category-button pair-behind" data-category-id="behindbackCategory" data-label="BEHIND BACK" onclick="showCategory('behindbackCategory')">BEHIND BACK (0)</button>
      <button class="category-button pair-behind" data-category-id="gooCategory" data-label="ACCESSORIES" onclick="showCategory('gooCategory')">ACCESSORIES (0)</button>
      <button class="category-button pair-hand1" data-category-id="handCategory" data-label="HAND 1" onclick="showCategory('handCategory')">HAND 1 (0)</button>
      <button class="category-button pair-hand1" data-category-id="ballCategory" data-label="BALLS 1" onclick="showCategory('ballCategory')">BALLS 1 (0)</button>
      <button class="category-button pair-hand2" data-category-id="hand2Category" data-label="HAND 2" onclick="showCategory('hand2Category')">HAND 2 (0)</button>
      <button class="category-button pair-hand2" data-category-id="ball2Category" data-label="BALLS 2" onclick="showCategory('ball2Category')">BALLS 2 (0)</button>
      <button id="randomButton" class="category-button randomize-button" onclick="randomizeCharacter()">RANDOMIZE</button>
    </div>
    <button type="button" id="viewTraitNamesBtn" class="view-trait-names-btn" onclick="openTraitSelectionNamesModal()">VIEW TRAIT SELECTION NAMES</button>
  </div>

  <div id="creatorRow">
    <div id="characterDisplayContainer">
      <div id="characterDisplay">
        <img id="background" alt="">
        <img id="backgroundblur" alt="">
        <img id="behindback" alt="">
        <img id="skin" alt="">
        <img id="eyes" alt="">
        <img id="clothing" alt="">
        <img id="mouth" alt="">
        <img id="hair" alt="">
        <img id="accessories" alt="">
        <img id="hat" alt="">
        <img id="hoodies" alt="">
        <img id="goo" alt="">
        <img id="ball" alt="">
        <img id="hand" alt="">
        <img id="ball2" alt="">
        <img id="hand2" alt="">
        <div class="creatorBlockedOverlay" id="creatorBlockedOverlay" aria-hidden="true"><span class="creatorBlockedX" aria-hidden="true">✕</span></div>
      </div>
      <div id="characterDisplayOffscreenWrap" aria-hidden="true">
        <div id="characterDisplayOffscreen">
          <img id="off_background" alt="">
          <img id="off_backgroundblur" alt="">
          <img id="off_behindback" alt="">
          <img id="off_skin" alt="">
          <img id="off_eyes" alt="">
          <img id="off_clothing" alt="">
          <img id="off_mouth" alt="">
          <img id="off_hair" alt="">
          <img id="off_accessories" alt="">
          <img id="off_hat" alt="">
          <img id="off_hoodies" alt="">
          <img id="off_goo" alt="">
          <img id="off_ball" alt="">
          <img id="off_hand" alt="">
          <img id="off_ball2" alt="">
          <img id="off_hand2" alt="">
        </div>
      </div>
      <div class="underCharacterRow">
        <div class="character-actions">
          <button id="saveCharacterBtn">SAVE</button>
          <button id="loadCharacterBtn">LOAD</button>
          <button id="newCharacterBtn">NEW</button>
          <button type="button" id="startNewBlankBtn" onclick="startNewBlankCharacter()">START NEW</button>
          <button id="exportImageBtn">EXPORT IMAGE</button>
          <button id="exportTraitListBtn" class="export-trait-button">EXPORT TRAIT LIST</button>
          <button type="button" id="generateCollectionBtn">GENERATE COLLECTION!</button>
        </div>
        <div id="jsonSelectionBar" aria-label="Selection JSON controls">
          <button id="exportSelectionBtn" onclick="exportSelectionState()">EXPORT SELECTION .JSON</button>
          <label id="importSelectionBtn">
            IMPORT SELECTION .JSON
            <input type="file" accept=".json" onchange="if(this.files.length) importSelectionState(this.files[0]); this.value='';">
          </label>
        </div>
      </div>
    </div>

    <div id="traitPictures">
      <div class="trait-category" id="backgroundCategory" data-slot="background"><div class="trait-options"></div></div>
      <div class="trait-category" id="backgroundblurCategory" data-slot="backgroundblur"><div class="trait-options"></div></div>
      <div class="trait-category" id="skinCategory" data-slot="skin"><div class="trait-options"></div></div>
      <div class="trait-category" id="eyesCategory" data-slot="eyes"><div class="trait-options"></div></div>
      <div class="trait-category" id="mouthCategory" data-slot="mouth"><div class="trait-options"></div></div>
      <div class="trait-category" id="hairCategory" data-slot="hair"><div class="trait-options"></div></div>
      <div class="trait-category" id="clothingCategory" data-slot="clothing"><div class="trait-options"></div></div>
      <div class="trait-category" id="accessoriesCategory" data-slot="accessories"><div class="trait-options"></div></div>
      <div class="trait-category" id="behindbackCategory" data-slot="behindback"><div class="trait-options"></div></div>
      <div class="trait-category" id="hatCategory" data-slot="hat"><div class="trait-options"></div></div>
      <div class="trait-category" id="hoodiesCategory" data-slot="hoodies"><div class="trait-options"></div></div>
      <div class="trait-category" id="gooCategory" data-slot="goo"><div class="trait-options"></div></div>
      <div class="trait-category" id="handCategory" data-slot="hand"><div class="trait-options"></div></div>
      <div class="trait-category" id="ballCategory" data-slot="ball"><div class="trait-options"></div></div>
      <div class="trait-category" id="hand2Category" data-slot="hand2"><div class="trait-options"></div></div>
      <div class="trait-category" id="ball2Category" data-slot="ball2"><div class="trait-options"></div></div>
    </div>
  </div>
</div>

<div id="traitSelectionNamesModal" class="load-modal" aria-hidden="true" onclick="if (event.target === this) closeTraitSelectionNamesModal();">
  <div class="load-modal-dialog trait-selection-names-dialog" role="dialog" aria-labelledby="traitSelectionNamesTitle">
    <h4 id="traitSelectionNamesTitle">TRAIT SELECTION ON THIS CHARACTER</h4>
    <ul id="onCharacterListItems"></ul>
    <div class="modal-buttons" style="margin-top:12px;flex-shrink:0;">
      <button type="button" onclick="closeTraitSelectionNamesModal()">CLOSE</button>
    </div>
  </div>
</div>

<div id="collectionModal" class="load-modal" aria-hidden="true">
  <div class="load-modal-dialog">
    <h4>GENERATE COLLECTION</h4>
    <p class="collection-modal-hint">How many random characters in the collage?</p>
    <input type="number" id="collectionCountInput" min="1" max="5000" value="9" />
    <div class="modal-buttons">
      <button type="button" id="collectionModalCancel">CANCEL</button>
      <button type="button" id="collectionModalGo">GENERATE</button>
    </div>
  </div>
</div>

<div id="collectionProgress" class="collection-progress-overlay" aria-hidden="true">
  <div class="inner">
    <div>GENERATING COLLECTION&hellip;</div>
    <div id="collectionProgressText" style="margin-top:12px;font-size:16px;">0 / 0</div>
  </div>
</div>

<div id="loadModal" class="load-modal" aria-hidden="true">
  <div class="load-modal-dialog">
    <h4>LOAD A SAVED CHARACTER</h4>
    <select id="loadModalSelect"></select>
    <div class="modal-buttons">
      <button type="button" id="loadModalCancel">CANCEL</button>
      <button type="button" id="loadModalLoad">LOAD</button>
    </div>
  </div>
</div>

<div id="preloader" class="preloader hidden">
  <div class="preloader-header">
    <img src="branding/LO.png" alt="LO" class="preloader-logo" onerror="this.style.display='none'">
    <h3>LOADING CHARACTER CREATOR...</h3>
  </div>
  <div class="preloader-progress">
    <div id="preloaderBar" class="preloader-bar"></div>
  </div>
  <div id="preloaderText" class="preloader-text">PREPARING TRAITS...</div>
</div>

<script src="js/traits-registry.js"></script>
<script src="js/creator.js"></script>
<script src="js/cm67-init.js"></script>
</body>
</html>
"""
    (OUT / "index.html").write_text(html, encoding="utf-8")

    init_js = """/* CharacterMachine67 — standalone bootstrap (does not modify Creator Suite). */
(function () {
  function showMainAfterGender() {
    var main = document.getElementById('mainContent');
    if (main && window.selectedGender) main.style.display = 'block';
  }

  var origSwitch = window.switchGender;
  if (typeof origSwitch === 'function') {
    window.switchGender = function (newGender, opts) {
      origSwitch(newGender, opts);
      showMainAfterGender();
    };
  }

  var origSet = window.setGender;
  window.setGender = function (g) {
    if (typeof origSet === 'function') origSet(g);
    showMainAfterGender();
  };

  function wireGenderButtons() {
    var maleBtn = document.getElementById('chooseMaleBtn');
    var femaleBtn = document.getElementById('chooseFemaleBtn');
    if (maleBtn && !maleBtn.__cm67Wired) {
      maleBtn.__cm67Wired = true;
      maleBtn.addEventListener('click', function () { window.setGender('male'); });
    }
    if (femaleBtn && !femaleBtn.__cm67Wired) {
      femaleBtn.__cm67Wired = true;
      femaleBtn.addEventListener('click', function () { window.setGender('female'); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGenderButtons);
  } else {
    wireGenderButtons();
  }

  if (window.LOTraitRegistry) {
    window.LOTraitRegistry.MANIFEST_URL = 'assets/traits-manifest.json';
  }
})();
"""
    (OUT / "js" / "cm67-init.js").write_text(init_js, encoding="utf-8")

    link_sh = """#!/bin/bash
# Link trait assets from parent LOCC2 project (run from CharacterMachine67 folder).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
if [ -L assets ]; then rm assets; fi
if [ -d assets ]; then echo "assets/ folder already exists — remove or rename it first."; exit 1; fi
ln -s ../assets assets
echo "Linked assets -> ../assets"
"""
    (OUT / "link-assets.sh").write_text(link_sh, encoding="utf-8")
    (OUT / "link-assets.sh").chmod(0o755)

    print("Built CharacterMachine67 at", OUT)

if __name__ == "__main__":
    main()
