/* =========================
   TRAIT SELECTOR + RANDOMIZER
   ========================= */
// Safari inline onclick handlers resolve globals via window.*,
// so expose gender state + setter explicitly on window.
window.selectedGender = null; // "male" | "female"
var __creatorInitialized = false;
// Do not persist/convert traits between genders. Switching must be a clean rebuild.
window.__loGenderCharacterState = { male: {}, female: {} };
window.__loSuppressGenderState = false;
window.__loGenderSwitchInProgress = false;
window.__loManifestPromise = null;
window.__loBootstrapPromise = null;
var LO_CREATOR_COMPAT_JSON = 'data/LOCompleteV5.json';
var LO_DEFAULT_TRAIT_SELECTION_JSON = 'data/default-trait-selection.json';
window.__loTraitsReady = false;
// Must be declared before manifest preload / setGender — a later `var TRAIT_DATA = {}` would wipe loaded data.
var TRAIT_DATA = {}; // synced from LOTraitRegistry after manifest loads

var categoryIdToSlot = {
  backgroundCategory: 'background',
  backgroundblurCategory: 'backgroundblur',
  skinCategory: 'skin',
  eyesCategory: 'eyes',
  mouthCategory: 'mouth',
  hairCategory: 'hair',
  clothingCategory: 'clothing',
  accessoriesCategory: 'accessories',
  behindbackCategory: 'behindback',
  hatCategory: 'hat',
  hoodiesCategory: 'hoodies',
  gooCategory: 'goo',
  handCategory: 'hand',
  hand2Category: 'hand2',
  ballCategory: 'ball',
  ball2Category: 'ball2'
};

/** Slots kept out of the randomizer by default (still visible in the picker). */
var LO_CREATOR_DESELECTED_SLOTS = { hoodies: true, backgroundblur: true };

function loCreatorSlotSelectedByDefault(slot) {
  return !LO_CREATOR_DESELECTED_SLOTS[slot];
}

function loCreatorApplyDefaultTraitSelection() {
  Object.keys(TRAIT_DATA || {}).forEach(function (slot) {
    (TRAIT_DATA[slot] || []).forEach(function (t) {
      if (!t || t.isRemove) return;
      t.selected = loCreatorSlotSelectedByDefault(slot);
    });
  });
}

function loShowPreloader(msg) {
  var preloader = document.getElementById('preloader');
  var preloaderText = document.getElementById('preloaderText');
  if (preloaderText && msg) preloaderText.textContent = msg;
  if (preloader) preloader.classList.remove('hidden');
}

function loHidePreloader() {
  var preloader = document.getElementById('preloader');
  if (preloader) preloader.classList.add('hidden');
}

function loEnsureManifestLoaded() {
  if (!window.LOTraitRegistry) {
    return Promise.reject(new Error('Trait registry script missing'));
  }
  if (window.__loManifestPromise) return window.__loManifestPromise;
  window.__loManifestPromise = window.LOTraitRegistry.loadTraitManifest().then(function (manifest) {
    TRAIT_DATA = window.LOTraitRegistry.TRAIT_DATA;
    if (window.LOCandidateEngine && typeof window.LOCandidateEngine.invalidateTraitIndex === 'function') {
      window.LOCandidateEngine.invalidateTraitIndex();
    }
    return manifest;
  });
  return window.__loManifestPromise;
}

function __loGetDisplaySlots() {
  if (typeof displaySlotOrder !== 'undefined' && Array.isArray(displaySlotOrder) && displaySlotOrder.length) {
    return displaySlotOrder.slice();
  }
  return ['background','backgroundblur','behindback','skin','eyes','clothing','mouth','hair','accessories','hat','hoodies','goo','ball','hand','ball2','hand2'];
}

function __loCaptureGenderStateFromDOM(g) {
  if (!g) return;
  if (!window.__loGenderCharacterState) window.__loGenderCharacterState = { male: {}, female: {} };
  if (!window.__loGenderCharacterState[g]) window.__loGenderCharacterState[g] = {};
  var slots = __loGetDisplaySlots();
  slots.forEach(function (slot) {
    var el = document.getElementById(slot);
    if (!el) return;
    var path = getTraitPathFromDisplayImg(el);
    if (path) window.__loGenderCharacterState[g][slot] = path;
    else delete window.__loGenderCharacterState[g][slot];
  });
}

function __loApplyGenderStateToDOM(g) {
  if (!g || !window.__loGenderCharacterState || !window.__loGenderCharacterState[g]) return;
  var slots = __loGetDisplaySlots();
  var state = window.__loGenderCharacterState[g];
  // Restore all slots (missing => blank)
  slots.forEach(function (slot) {
    selectTrait(slot, state[slot] || '');
  });
  reconcileCreatorHairHatState();
}

function initCharacterCreator() {
  if (__creatorInitialized) return Promise.resolve();
  if (window.__loInitPromise) return window.__loInitPromise;

  loShowPreloader('LOADING TRAIT LIBRARY...');

  window.__loInitPromise = Promise.all([
    loEnsureManifestLoaded().then(function () {
      var preloaderText = document.getElementById('preloaderText');
      if (preloaderText) preloaderText.textContent = 'BUILDING TRAIT PICKER...';
      return new Promise(function (resolve) {
        window.LOTraitRegistry.populateAllTraitCategories(categoryIdToSlot, {
          removeThumb: 'assets/traits/HATS/REMOVE.png'
        }, resolve);
      });
    }),
    loadCreatorCompatData()
  ]).then(function () {
    try {
      TRAIT_DATA = window.LOTraitRegistry.TRAIT_DATA;
      __creatorInitialized = true;
      window.__loTraitsReady = true;
      initTraitCulling();
      loApplySavedTraitSelectionOrDefaults();
      initCharacterCanvasClicks();
      applyGenderRules();
      attachGenderAwareTraitClickGuard();
      updateAllCategoryCounters();
      updateTabCounts();
      loSetRandomizeEnabled(true);
      showCategory('backgroundCategory');
      setTimeout(function () {
        try { preloadAllImages(); } catch (e) { console.error('preloadAllImages failed:', e); }
      }, 50);
      applyCreatorCompatLayers();
    } catch (e) {
      console.error('initCharacterCreator failed:', e);
      throw e;
    } finally {
      loHidePreloader();
    }
  }).catch(function (err) {
    console.error('Trait load failed:', err);
    loHidePreloader();
    if (typeof alert === 'function') {
      alert('Could not load traits. Use http://localhost (not file://) and check assets/traits-manifest.json exists.');
    }
    throw err;
  });
  return window.__loInitPromise;
}

function updateBackgroundForGender(g) {
  // Solid color backdrop to make the switch obvious (per spec).
  document.body.style.backgroundImage = 'none';
  document.body.style.backgroundColor = (g === 'male') ? '#4DA6FF' : '#FF9ED6';
}

function resetCharacterState() {
  // Clear canvas (all layers)
  if (typeof window.__loGenCollectionOffscreen !== 'undefined') window.__loGenCollectionOffscreen = false;
  window.__loSuppressGenderState = true;
  (typeof displaySlotOrder !== 'undefined' && Array.isArray(displaySlotOrder) ? displaySlotOrder :
    ['background','backgroundblur','behindback','skin','eyes','clothing','mouth','hair','accessories','hat','hoodies','goo','ball','hand','ball2','hand2']
  ).forEach(function (slot) { selectTrait(slot, ''); });
  window.__loSuppressGenderState = false;

  // Clear gender-disabled overlays only — preserve saved include/exclude checkboxes.
  try {
    document.querySelectorAll('.trait-thumb-wrap.trait-disabled').forEach(function (w) {
      w.classList.remove('trait-disabled');
    });
    if (typeof loRefreshAllCreatorTraitUi === 'function') loRefreshAllCreatorTraitUi();
  } catch (e) {}

  // Kill any remembered per-gender character state (critical rule: no reuse).
  window.__loGenderCharacterState = { male: {}, female: {} };
  window.__loFemaleEnforceHair = null;
}

function playSwirlTransition(callback) {
  var overlay = document.getElementById('transitionOverlay');
  if (!overlay) { callback(); return; }
  overlay.classList.add('active');
  setTimeout(function () {
    callback();
    overlay.classList.remove('active');
  }, 400);
}

function loadTraitsForGender(g) {
  applyGenderRules();
  try { loApplyCollectionExclusionsToCreator(); } catch (e) {}
  if (typeof loRefreshAllCreatorTraitUi === 'function') loRefreshAllCreatorTraitUi();
  else refreshTraitUI();
  updateAllCategoryCounters();
}

function switchGender(newGender, opts) {
  opts = opts || {};
  if (!newGender || newGender === window.selectedGender) return;
  if (window.__loGenderSwitchInProgress) return;
  window.__loGenderSwitchInProgress = true;

  var run = function () {
    // HARD RESET
    resetCharacterState();

    // SET NEW GENDER
    window.selectedGender = newGender;
    document.body.classList.toggle('gender-female', newGender === 'female');
    updateBackgroundForGender(newGender);

    // Hide the gate (if present)
    var gate = document.getElementById('genderGate');
    if (gate) {
      gate.style.display = 'none';
      gate.setAttribute('aria-hidden', 'true');
    }

    function finishSwitch() {
      updateGenderToggleUI();
      loadTraitsForGender(newGender);
      if (typeof randomizeCharacter === 'function') randomizeCharacter();
      window.__loGenderSwitchInProgress = false;
    }

    if (!window.__loTraitsReady) {
      window.__pendingGender = newGender;
      loBootstrapApp().then(finishSwitch).catch(function () {
        window.__loGenderSwitchInProgress = false;
      });
      return;
    }

    finishSwitch();
  };

  if (opts.noTransition) run();
  else playSwirlTransition(run);
}

window.setGender = function setGender(g) {
  if (!window.__loTraitsReady) {
    window.__pendingGender = g;
    loBootstrapApp();
    return;
  }
  switchGender(g, { noTransition: true });
};

// Ensure the page always begins from a blank canvas before any gender is chosen.
(function loEnsureCleanStartCanvas() {
  try { resetCharacterState(); } catch (e) {}
})();

// Make toggle work even if event listener fails
window.toggleGender = function toggleGender() {
  if (!window.selectedGender) return;
  switchGender(window.selectedGender === 'female' ? 'male' : 'female');
};

function updateGenderToggleUI() {
  var btn = document.getElementById('toggleGenderBtn');
  if (!btn) return;
  if (!window.selectedGender) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'inline-block';
  btn.textContent = (window.selectedGender === 'female') ? 'SWITCH TO MALE' : 'SWITCH TO FEMALE';

  // Also tint the gender gate background if it is ever shown again
  var gate = document.getElementById('genderGate');
  if (gate) gate.classList.toggle('female', window.selectedGender === 'female');
}

// Header toggle: switch to opposite gender
(function initGenderToggleButton() {
  var btn = document.getElementById('toggleGenderBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (!window.selectedGender) return;
    window.setGender(window.selectedGender === 'female' ? 'male' : 'female');
  });
})();

function loSetGenderGateEnabled(enabled) {
  var maleBtn = document.getElementById('chooseMaleBtn');
  var femaleBtn = document.getElementById('chooseFemaleBtn');
  if (maleBtn) maleBtn.disabled = !enabled;
  if (femaleBtn) femaleBtn.disabled = !enabled;
  var hint = document.querySelector('#genderGate .hint');
  if (hint) {
    hint.textContent = enabled
      ? 'SELECT A MODE TO START CREATING.'
      : 'LOADING ALL TRAITS — PLEASE WAIT...';
  }
}

function loSetRandomizeEnabled(enabled) {
  var btn = document.getElementById('randomButton');
  if (btn) btn.disabled = !enabled;
}

function loBootstrapApp() {
  if (window.__loTraitsReady) return Promise.resolve();
  if (window.__loBootstrapPromise) return window.__loBootstrapPromise;

  loSetGenderGateEnabled(false);
  loSetRandomizeEnabled(false);
  loShowPreloader('LOADING ALL TRAITS...');

  window.__loBootstrapPromise = initCharacterCreator().then(function () {
    TRAIT_DATA = window.LOTraitRegistry.TRAIT_DATA;
    window.__loTraitsReady = true;
    var pending = window.__pendingGender;
    if (pending) {
      window.__pendingGender = null;
      switchGender(pending, { noTransition: true });
    }
    try { loApplyCollectionExclusionsToCreator(); } catch (eCb) {}
    updateAllCategoryCounters();
    updateTabCounts();
    loSetGenderGateEnabled(true);
    loSetRandomizeEnabled(true);
  }).catch(function (err) {
    console.error('Bootstrap failed:', err);
    loSetGenderGateEnabled(true);
    if (typeof alert === 'function') {
      alert('Could not load traits. Use http://localhost:8080 (not file://).');
    }
    throw err;
  });

  return window.__loBootstrapPromise;
}

function loParseIdFromPath(path) {
  if (!path) return null;
  var m = (path + '').match(/\/(\d+)\.PNG$/i);
  if (!m) m = (path + '').match(/(\d+)\.PNG$/i);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function loRange(a, b) {
  var out = [];
  for (var i = a; i <= b; i++) out.push(i);
  return out;
}

function loSetFromArray(arr) {
  var s = new Set();
  (arr || []).forEach(function (x) { s.add(x); });
  return s;
}

function loHasHatSelected() {
  var hat = document.getElementById(window.__loGenCollectionOffscreen ? 'off_hat' : 'hat');
  if (!hat) return false;
  var path = getTraitPathFromDisplayImg(hat);
  if (!path) return false;
  if (window.LOTraitRegistry && LOTraitRegistry.isBlankTrait(path)) return false;
  var u = path.toUpperCase();
  if (u.endsWith('/AA.PNG') || u.endsWith('/AAA.PNG') || u.indexOf('REMOVE') >= 0) return false;
  return true;
}

function loUsesLegacyNumericTraits() {
  var sample = (TRAIT_DATA.skin && TRAIT_DATA.skin[0]) ? TRAIT_DATA.skin[0].image : '';
  return sample && !/assets\/traits\//i.test(sample);
}

function setTraitTileDisabled(img, disabled) {
  if (!img) return;
  var wrap = img.closest('.trait-thumb-wrap');
  if (!wrap) return;
  wrap.classList.toggle('trait-disabled', !!disabled);
}

function applyGenderRules() {
  if (!__creatorInitialized) return;
  if (window.selectedGender !== 'female') {
    // MALE MODE: no Female mouths; no Feathered Flow / Layered Back Flow / Pigtails & Bow
    document.querySelectorAll('.trait-thumb-wrap.trait-disabled').forEach(function (w) {
      w.classList.remove('trait-disabled');
    });

    if (TRAIT_DATA.mouth) {
      TRAIT_DATA.mouth.forEach(function (t) {
        if (isFemaleMouthTrait(t)) t.selected = false;
      });
    }

    document.querySelectorAll('.trait-options img[data-slot="mouth"]').forEach(function (img) {
      var path = img.dataset.src || '';
      var t = findTraitInSlotByPath('mouth', path);
      setTraitTileDisabled(img, isFemaleMouthTrait(t || path));
    });

    var mouthEl = document.getElementById(window.__loGenCollectionOffscreen ? 'off_mouth' : 'mouth');
    var currentMouth = mouthEl ? getTraitPathFromDisplayImg(mouthEl) : '';
    if (currentMouth && isFemaleMouthTrait(currentMouth)) {
      selectTrait('mouth', '', true);
    }

    var hairList = TRAIT_DATA.hair || [];
    hairList.forEach(function (t) {
      if (!isMaleAllowedHairTrait(t)) t.selected = false;
    });

    document.querySelectorAll('.trait-options img[data-slot="hair"]').forEach(function (img) {
      var path = img.dataset.src || '';
      var t = findTraitInSlotByPath('hair', path);
      setTraitTileDisabled(img, !isMaleAllowedHairTrait(t || path));
    });

    reconcileCreatorHairHatState();

    var hairEl = document.getElementById(window.__loGenCollectionOffscreen ? 'off_hair' : 'hair');
    var currentHair = hairEl ? getTraitPathFromDisplayImg(hairEl) : '';
    if (currentHair && !isMaleAllowedHairTrait(currentHair)) {
      var pool = hairList.filter(function (t) { return t && t.selected && (t.image || t.path); });
      var pick = pickRandomFrom(pool);
      selectTrait('hair', pick ? loTraitPath(pick) : '', true, true);
    }

    applyCreatorCompatLayers();
    updateAllCategoryCounters();
    window.__loFemaleEnforceHair = null;
    window.__loFemaleHairUiHasHat = null;
    return;
  }

  // FEMALE RULES — mouths: Female* only; hair: (no hat + 3 styles) OR (hat + Pigtails / Back Flow colors only)
  if (TRAIT_DATA.mouth) {
    TRAIT_DATA.mouth.forEach(function (t) {
      if (!isFemaleMouthTrait(t)) t.selected = false;
    });
  }

  document.querySelectorAll('.trait-options img[data-slot="mouth"]').forEach(function (img) {
    var path = img.dataset.src || '';
    var t = findTraitInSlotByPath('mouth', path);
    setTraitTileDisabled(img, !isFemaleMouthTrait(t || path));
  });

  var mouthEl = document.getElementById(window.__loGenCollectionOffscreen ? 'off_mouth' : 'mouth');
  var currentMouth = mouthEl ? getTraitPathFromDisplayImg(mouthEl) : '';
  if (currentMouth && !isFemaleMouthTrait(currentMouth)) {
    selectTrait('mouth', '', true);
  }

  function enforceFemaleHairRules() {
    if (window.__loFemaleEnforceLock) return;
    window.__loFemaleEnforceLock = true;

    var hairList = TRAIT_DATA.hair || [];
    var hairPath = creatorGetSlotPath('hair');
    var hatPath = creatorGetSlotPath('hat');
    var activeHair = creatorPathIsActiveHair(hairPath);
    var activeHat = creatorPathIsActiveHat(hatPath);

    // XOR: headwear OR the 3 female styles — never stack hat on Feathered / Layered / Pigtails & Bow
    if (activeHair && isFemaleOnlyHairTrait(hairPath)) {
      if (activeHat) selectTrait('hat', '', true, true);
    } else if (activeHat) {
      if (activeHair && !isFemaleHatHairTrait(hairPath)) {
        selectTrait('hair', '', true, true);
        activeHair = false;
      }
      if (!femaleCurrentHairIsValid(true)) {
        var hatPick = pickFemaleRequiredHairTrait(true, hairList);
        if (hatPick) selectTrait('hair', loTraitPath(hatPick), true, true);
      }
    } else {
      if (activeHair && isFemaleHatHairTrait(hairPath)) {
        selectTrait('hair', '', true, true);
      }
      if (!femaleCurrentHairIsValid(false)) {
        var noHatPick = pickFemaleRequiredHairTrait(false, hairList);
        if (noHatPick) selectTrait('hair', loTraitPath(noHatPick), true, true);
      }
    }

    var hasHat = loHasHatSelected();
    hairList.forEach(function (t) {
      if (!t || t.isRemove) return;
      if (!isFemaleAllowedHairTrait(t, hasHat)) t.selected = false;
    });

    if (window.__loFemaleHairUiHasHat !== hasHat) {
      window.__loFemaleHairUiHasHat = hasHat;
      updateFemaleHairTraitTiles(hasHat);
    }

    window.__loFemaleEnforceLock = false;
    applyCreatorCompatLayers();
  }

  window.__loFemaleHairUiHasHat = null;
  enforceFemaleHairRules();
  window.__loFemaleEnforceHair = enforceFemaleHairRules;

  updateAllCategoryCounters();
}

function attachGenderAwareTraitClickGuard() {
  // idempotent
  if (window.__loGenderGuardAttached) return;
  window.__loGenderGuardAttached = true;

  var container = document.getElementById('traitPictures');
  if (!container) return;

  container.addEventListener('click', function (e) {
    if (window.selectedGender !== 'female') return;
    var img = e.target.closest('.trait-options img');
    if (!img || !img.dataset.slot) return;

    // If disabled by female rules, block.
    var wrap = img.closest('.trait-thumb-wrap');
    if (wrap && wrap.classList.contains('trait-disabled')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (img.dataset.slot === 'accessories') {
      setTimeout(applyCreatorCompatLayers, 0);
    }
  }, true);
}

/* =========================
   CHARACTER CREATOR — compatibility layers (LOCompleteV5.json)
   Mullet hairstyles (Back Flow, Pigtails, etc.): hair+glasses + hat+glasses stacking.
   ========================= */
var CREATOR_HAIR_COLOR_SUFFIXES = ['-blonde', '-white', '-brown', '-black', '-ginger', '-chrome'];
var CREATOR_MULLET_STYLE_PREFIXES = ['layered-back-flow', 'pigtails-bow', 'pigtails', 'back-flow'];
/** When randomize picks a hat, chance to also add Back Flow / Pigtails (1 in N). */
var CREATOR_HAT_MULLET_PAIR_ODDS = 5;

function creatorRollHatMulletHairPair() {
  return pickRandomIndex(CREATOR_HAT_MULLET_PAIR_ODDS) === 0;
}

/** Single compatibility source of truth — all modules read/write this key. */
window.LO_COMPAT_STORAGE_KEY = 'lo_trait_compatibility_v2';
window.LO_COMPAT_LEGACY_V5_KEY = 'lo_trait_manager_compat_db_v5';

function loNormalizeCompatStore(obj) {
  if (!obj || typeof obj !== 'object') obj = {};
  if (!obj.hats_vs_glasses) obj.hats_vs_glasses = {};
  if (!obj.hair_vs_glasses) obj.hair_vs_glasses = {};
  return obj;
}

function loReadCompatFromStorage() {
  try {
    var raw = localStorage.getItem(window.LO_COMPAT_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return loNormalizeCompatStore(parsed);
    }
  } catch (e) {}
  try {
    var legacy = localStorage.getItem(window.LO_COMPAT_LEGACY_V5_KEY);
    if (legacy) {
      var parsedLegacy = JSON.parse(legacy);
      if (parsedLegacy && typeof parsedLegacy === 'object') {
        var migrated = loNormalizeCompatStore(parsedLegacy);
        localStorage.setItem(window.LO_COMPAT_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e2) {}
  return null;
}

function loGetCreatorCompatStore() {
  if (window.__loCreatorCompat && typeof window.__loCreatorCompat === 'object') return window.__loCreatorCompat;
  return loReadCompatFromStorage() || { hats_vs_glasses: {}, hair_vs_glasses: {} };
}
window.loGetCreatorCompatStore = loGetCreatorCompatStore;

function loCompatHasSessionData(store) {
  store = loNormalizeCompatStore(store);
  var n = 0;
  function countSec(sec) {
    Object.keys(sec || {}).forEach(function (pid) {
      Object.keys(sec[pid] || {}).forEach(function (sid) {
        var e = sec[pid][sid];
        if (e && e.status) n++;
      });
    });
  }
  countSec(store.hats_vs_glasses);
  countSec(store.hair_vs_glasses);
  return n > 0;
}

function loApplyCreatorCompatStore(store) {
  window.__loCreatorCompat = loNormalizeCompatStore(store);
  window.__loCreatorCompatSource = 'unified';
  try {
    if (typeof window.refreshProjectHome === 'function') window.refreshProjectHome();
  } catch (e) {}
  try {
    if (typeof applyCreatorCompatLayers === 'function') applyCreatorCompatLayers();
  } catch (e2) {}
}

function loadCreatorCompatData() {
  if (window.__loCreatorCompat && window.__loCreatorCompatSource === 'unified') {
    return Promise.resolve(window.__loCreatorCompat);
  }
  if (window.__loCreatorCompatPromise) return window.__loCreatorCompatPromise;
  var localStore = loReadCompatFromStorage();
  var jsonPath = (typeof LO_CREATOR_COMPAT_JSON === 'string' && LO_CREATOR_COMPAT_JSON) ? LO_CREATOR_COMPAT_JSON : 'LOCompleteV5.json';
  var url = jsonPath + (jsonPath.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now();
  window.__loCreatorCompatPromise = fetch(url).then(function (res) {
    if (!res.ok) throw new Error('Failed to load ' + LO_CREATOR_COMPAT_JSON);
    return res.json();
  }).then(function (obj) {
    var fileData = loNormalizeCompatStore((obj && obj.data) ? obj.data : obj);
    var merged = fileData;
    if (localStore) {
      merged = loCompatHasSessionData(localStore) && typeof window.loMergeCompatData === 'function'
        ? window.loMergeCompatData(fileData, localStore)
        : localStore;
      try { localStorage.setItem(window.LO_COMPAT_STORAGE_KEY, JSON.stringify(merged)); } catch (eSave) {}
    }
    loApplyCreatorCompatStore(merged);
    return window.__loCreatorCompat;
  }).catch(function (err) {
    console.warn('[Creator compat]', err);
    if (localStore) {
      loApplyCreatorCompatStore(localStore);
      return window.__loCreatorCompat;
    }
    loApplyCreatorCompatStore({ hats_vs_glasses: {}, hair_vs_glasses: {} });
    return window.__loCreatorCompat;
  });
  return window.__loCreatorCompatPromise;
}

function creatorTraitIdFromPath(path) {
  if (!path) return '';
  path = resolveCreatorTraitPath(path);
  if (window.LOTraitRegistry) {
    var t = LOTraitRegistry.getTraitByPath(path);
    if (t && t.normalizedName) return t.normalizedName;
  }
  var num = loParseIdFromPath(path);
  if (num != null) return String(num);
  var base = (path.split('/').pop() || '').replace(/\.(png|PNG)$/i, '');
  return base.toLowerCase().replace(/\s+/g, '-');
}

function creatorHatLookupIds(hatPath) {
  var ids = [];
  if (!hatPath) return ids;
  if (window.LOTraitRegistry) {
    var t = LOTraitRegistry.getTraitByPath(hatPath);
    if (t && t.normalizedName) ids.push(t.normalizedName);
  }
  var num = loParseIdFromPath(hatPath);
  if (num != null) ids.push(String(num));
  var slug = creatorTraitIdFromPath(hatPath);
  if (slug && ids.indexOf(slug) < 0) ids.push(slug);
  return ids;
}

function creatorHairStylePrefix(hairId) {
  if (!hairId) return '';
  var key = String(hairId).toLowerCase();
  var i, suf;
  for (i = 0; i < CREATOR_HAIR_COLOR_SUFFIXES.length; i++) {
    suf = CREATOR_HAIR_COLOR_SUFFIXES[i];
    if (key.length > suf.length && key.slice(-suf.length) === suf) {
      return key.slice(0, -suf.length);
    }
  }
  return key;
}

function isCreatorMulletHairId(hairId) {
  var prefix = creatorHairStylePrefix(hairId);
  for (var i = 0; i < CREATOR_MULLET_STYLE_PREFIXES.length; i++) {
    if (prefix === CREATOR_MULLET_STYLE_PREFIXES[i] || prefix.indexOf(CREATOR_MULLET_STYLE_PREFIXES[i]) === 0) {
      return true;
    }
  }
  return false;
}

function creatorHairTraitLabel(pathOrTrait) {
  var resolved = typeof pathOrTrait === 'string' ? resolveCreatorTraitPath(pathOrTrait) : '';
  var t = typeof pathOrTrait === 'object' ? pathOrTrait : (window.LOTraitRegistry && LOTraitRegistry.getTraitByPath(resolved));
  if (!resolved && t) resolved = t.path || t.image || '';
  var file = ((t && t.file) || (resolved && resolved.split('/').pop()) || '').replace(/\.(png|jpe?g)$/i, '');
  var name = (t && t.traitName) || file;
  return (name + ' ' + file).toLowerCase();
}

function creatorHairNormalizedId(pathOrTrait) {
  var t = typeof pathOrTrait === 'object' ? pathOrTrait : null;
  if (!t && pathOrTrait) {
    var p = typeof pathOrTrait === 'string' ? pathOrTrait : '';
    t = findTraitInSlotByPath('hair', p) ||
      (window.LOTraitRegistry && LOTraitRegistry.getTraitByPath(resolveCreatorTraitPath(p)));
  }
  if (t && t.normalizedName) return String(t.normalizedName).toLowerCase();
  return '';
}

/** Display/file name without extension (e.g. "Pigtails - White", "Back Flow - Blonde"). */
function creatorHairCanonicalStyle(pathOrTrait) {
  var t = typeof pathOrTrait === 'object' ? pathOrTrait : null;
  var resolved = typeof pathOrTrait === 'string' ? resolveCreatorTraitPath(pathOrTrait) : '';
  if (!t && pathOrTrait) {
    t = findTraitInSlotByPath('hair', resolved) ||
      (window.LOTraitRegistry && LOTraitRegistry.getTraitByPath(resolved));
  }
  if (!resolved && t) resolved = t.path || t.image || '';
  var name = (t && t.traitName) || '';
  if (!name && resolved) {
    name = (resolved.split('/').pop() || '').replace(/\.(png|jpe?g)$/i, '');
  }
  return String(name).replace(/\s+/g, ' ').trim();
}

/** Female, no headwear: Feathered Flow, Layered Back Flow, Pigtails & Bow (all colors). */
function isFemaleOnlyHairTrait(pathOrTrait) {
  var norm = creatorHairNormalizedId(pathOrTrait);
  if (norm) {
    if (/^feathered-flow(-|$)/.test(norm)) return true;
    if (/^layered-back-flow(-|$)/.test(norm)) return true;
    if (/^pigtails-bow(-|$)/.test(norm)) return true;
  }
  var label = creatorHairTraitLabel(pathOrTrait);
  if (!label.trim()) return false;
  if (/\bfeathered\s+flow\b/.test(label) || /\bfeathered-flow\b/.test(label)) return true;
  if (/\blayered\s+back\s+flow\b/.test(label) || /\blayered-back-flow\b/.test(label)) return true;
  if (/\bpigtails\s*&\s*bow\b/.test(label) || /\bpigtails-bow\b/.test(label)) return true;
  return false;
}

function isFemaleNoHatHairTrait(pathOrTrait) {
  return isFemaleOnlyHairTrait(pathOrTrait);
}

function isMaleAllowedHairTrait(pathOrTrait) {
  return !isFemaleOnlyHairTrait(pathOrTrait);
}

/** Female + headwear: plain "Pigtails - {color}" only (not Pigtails & Bow). */
function isFemalePlainPigtailsTrait(pathOrTrait) {
  var norm = creatorHairNormalizedId(pathOrTrait);
  if (norm) {
    if (/^pigtails-bow/.test(norm)) return false;
    if (/^pigtails-[a-z0-9-]+$/.test(norm)) return true;
  }
  var style = creatorHairCanonicalStyle(pathOrTrait);
  if (!style) return false;
  return /^pigtails?\s*-\s*[a-z0-9][a-z0-9\s-]*$/i.test(style) && !/&\s*bow/i.test(style);
}

/** Female + headwear: "Back Flow - {color}" only (not Layered Back Flow). */
function isFemaleBackFlowTrait(pathOrTrait) {
  var norm = creatorHairNormalizedId(pathOrTrait);
  if (norm) {
    if (/^layered-back-flow/.test(norm)) return false;
    if (/^back-flow-[a-z0-9-]+$/.test(norm)) return true;
  }
  var style = creatorHairCanonicalStyle(pathOrTrait);
  if (!style) return false;
  return /^back\s*flow\s*-\s*[a-z0-9][a-z0-9\s-]*$/i.test(style) && !/layered/i.test(style);
}

/** Female + headwear: Pigtails + Back Flow color variants only. */
function isFemaleHatHairTrait(pathOrTrait) {
  return isFemalePlainPigtailsTrait(pathOrTrait) || isFemaleBackFlowTrait(pathOrTrait);
}

/** Any hair allowed in female mode (no-hat trio OR hat + Pigtails/Back Flow). */
function isFemaleCatalogHairTrait(pathOrTrait) {
  return isFemaleOnlyHairTrait(pathOrTrait) || isFemaleHatHairTrait(pathOrTrait);
}

function isFemaleAllowedHairTrait(pathOrTrait, hasHat) {
  if (hasHat === undefined) hasHat = loHasHatSelected();
  return hasHat ? isFemaleHatHairTrait(pathOrTrait) : isFemaleNoHatHairTrait(pathOrTrait);
}

function creatorFilterFemaleHatHairList(hairList) {
  return (hairList || []).filter(function (t) {
    return isFemaleHatHairTrait(t);
  });
}

function creatorFilterFemaleNoHatHairList(hairList) {
  return (hairList || []).filter(function (t) {
    return isFemaleNoHatHairTrait(t);
  });
}

function creatorFemaleHairPool(hasHat, hairList) {
  return (hairList || TRAIT_DATA.hair || []).filter(function (t) {
    return t && !t.isRemove && (t.image || t.path) && isFemaleAllowedHairTrait(t, hasHat);
  });
}

/** Female preview must always show an allowed hair for current hat state. */
function pickFemaleRequiredHairTrait(hasHat, hairList) {
  return pickRandomFrom(creatorFemaleHairPool(hasHat, hairList));
}

function femaleCurrentHairIsValid(hasHat) {
  var hairEl = document.getElementById(window.__loGenCollectionOffscreen ? 'off_hair' : 'hair');
  var currentHair = hairEl ? getTraitPathFromDisplayImg(hairEl) : '';
  return !!(currentHair && creatorPathIsActiveHair(currentHair) && isFemaleAllowedHairTrait(currentHair, hasHat));
}

function updateFemaleHairTraitTiles(hasHat) {
  document.querySelectorAll('.trait-options img[data-slot="hair"]').forEach(function (img) {
    var path = img.dataset.src || '';
    var t = findTraitInSlotByPath('hair', path);
    var trait = t || path;
    if (!isFemaleCatalogHairTrait(trait)) {
      setTraitTileDisabled(img, true);
      return;
    }
    setTraitTileDisabled(img, !isFemaleAllowedHairTrait(trait, hasHat));
  });
}

function isFemaleMouthTrait(pathOrTrait) {
  if (loUsesLegacyNumericTraits()) {
    var path = typeof pathOrTrait === 'object' ? (pathOrTrait.image || pathOrTrait.path) : pathOrTrait;
    var id = loParseIdFromPath(path || '');
    return id != null && id >= 109 && id <= 119;
  }
  var label = creatorHairTraitLabel(pathOrTrait);
  return /\bfemale\b/.test(label);
}

/** Back Flow + plain Pigtails may display with headwear (not Bow / Feathered / Layered). */
function creatorHairCoexistsWithHat(hairPath) {
  if (!hairPath) return false;
  if (window.selectedGender === 'female') {
    return isFemaleHatHairTrait(hairPath);
  }
  var label = creatorHairTraitLabel(hairPath);
  if (/\blayered\s+back\s+flow\b/.test(label) || /\blayered-back-flow\b/.test(label)) return false;
  if (/\bfeathered\s+flow\b/.test(label) || /\bfeathered-flow\b/.test(label)) return false;
  if (/\bpigtails\s*&\s*bow\b/.test(label) || /\bpigtails-bow\b/.test(label)) return false;
  if (/\bback\s+flow\b/.test(label) || /\bback-flow\b/.test(label)) return true;
  if (/\bpigtails\b/.test(label) && !/\bbow\b/.test(label)) return true;
  return false;
}

function creatorPathIsActiveHair(path) {
  if (!path) return false;
  if (window.LOTraitRegistry && LOTraitRegistry.isBlankTrait(path)) return false;
  var u = path.toUpperCase();
  if (u.endsWith('/AA.PNG') || u.endsWith('/AAA.PNG') || u.indexOf('REMOVE') >= 0) return false;
  return true;
}

/** If both slots are filled, clear hair unless it is Back Flow / Pigtails (color variants). */
function reconcileCreatorHairHatState() {
  if (window.__loGenCollectionOffscreen || window.__loFemaleEnforceLock) return;
  var hatPath = creatorGetSlotPath('hat');
  var hairPath = creatorGetSlotPath('hair');
  if (!creatorPathIsActiveHat(hatPath) || !creatorPathIsActiveHair(hairPath)) return;
  if (window.selectedGender === 'female') {
    if (isFemaleOnlyHairTrait(hairPath)) {
      selectTrait('hat', '', true, true);
    } else if (!isFemaleHatHairTrait(hairPath)) {
      selectTrait('hair', '', true, true);
    }
    return;
  }
  if (!creatorHairCoexistsWithHat(hairPath)) {
    selectTrait('hair', '', true, true);
  }
}

function creatorFilterMulletHairList(hairList) {
  return (hairList || []).filter(function (t) {
    return creatorHairCoexistsWithHat(loTraitPath(t));
  });
}

function resolveCreatorTraitPath(path) {
  if (!path) return path;
  if (/drip\s*x\.png/i.test(path)) return 'assets/traits/GLASSES/DripX.PNG';
  return path;
}

function creatorGlassesCompatIds(glassesIdOrPath) {
  var ids = [];
  var id = glassesIdOrPath;
  if (glassesIdOrPath && String(glassesIdOrPath).indexOf('/') >= 0) {
    id = creatorTraitIdFromPath(resolveCreatorTraitPath(glassesIdOrPath));
  }
  if (id) ids.push(id);
  if (id === 'dripx' && ids.indexOf('drip-x') < 0) ids.push('drip-x');
  else if (id === 'drip-x' && ids.indexOf('dripx') < 0) ids.push('dripx');
  return ids;
}

/** Hair XOR headwear on preview, except Back Flow / Pigtails + headwear. */
function enforceCreatorHairHatMutualExclusion(category, filename) {
  if (window.__loGenCollectionOffscreen) return;
  filename = resolveCreatorTraitPath(filename);
  if (window.selectedGender === 'female') {
    if (category === 'hair' && filename && creatorPathIsActiveHair(filename)) {
      if (isFemaleOnlyHairTrait(filename)) {
        selectTrait('hat', '', true, true);
      } else if (isFemaleHatHairTrait(filename) && !loHasHatSelected()) {
        selectTrait('hair', '', true, true);
      }
    } else if (category === 'hat' && filename && creatorPathIsActiveHat(filename)) {
      var hairPath = creatorGetSlotPath('hair');
      if (!isFemaleHatHairTrait(hairPath)) {
        selectTrait('hair', '', true, true);
      }
    } else if (category === 'hat' && !filename) {
      var wornHair = creatorGetSlotPath('hair');
      if (wornHair && isFemaleHatHairTrait(wornHair) && !isFemaleOnlyHairTrait(wornHair)) {
        selectTrait('hair', '', true, true);
      }
    }
    reconcileCreatorHairHatState();
    return;
  }
  if (category === 'hair' && filename && creatorPathIsActiveHair(filename)) {
    if (!creatorHairCoexistsWithHat(filename)) {
      selectTrait('hat', '', true, true);
    }
  } else if (category === 'hat' && filename && creatorPathIsActiveHat(filename)) {
    var hairPath = creatorGetSlotPath('hair');
    if (!creatorHairCoexistsWithHat(hairPath)) {
      selectTrait('hair', '', true, true);
    }
  }
  reconcileCreatorHairHatState();
}

/** Clothing XOR hoodie — hoodies are outerwear that must render above headwear. */
function enforceCreatorClothingHoodieMutualExclusion(category, filename) {
  if (window.__loGenCollectionOffscreen) return;
  filename = resolveCreatorTraitPath(filename);
  if (!filename) return;
  if (category === 'clothing') {
    selectTrait('hoodies', '', true, true);
  } else if (category === 'hoodies') {
    selectTrait('clothing', '', true, true);
  }
}

function creatorHatTraitNameFromPath(path) {
  if (!path) return '';
  if (window.LOTraitRegistry && LOTraitRegistry.getTraitByPath) {
    var t = LOTraitRegistry.getTraitByPath(path);
    if (t && t.traitName) return t.traitName;
  }
  var file = String(path).split('/').pop() || '';
  return file.replace(/\.(png|PNG)$/i, '').trim();
}

function creatorHatIsBackwardsHat(name) {
  return String(name || '').indexOf('Backwards Hat - ') === 0;
}

function creatorHatIsHoodieOnlyBeanie(pathOrName) {
  var name = pathOrName && String(pathOrName).indexOf('/') >= 0
    ? creatorHatTraitNameFromPath(pathOrName)
    : String(pathOrName || '');
  return name === 'Beanie - White' || name === 'Beanie - Black';
}

function creatorHatCompatibleWithHoodie(pathOrName) {
  if (!pathOrName) return false;
  var name = String(pathOrName).indexOf('/') >= 0
    ? creatorHatTraitNameFromPath(pathOrName)
    : String(pathOrName || '');
  if (creatorHatIsHoodieOnlyBeanie(name)) return true;
  return creatorHatIsBackwardsHat(name);
}

function creatorHasHoodieSelected() {
  var path = creatorGetSlotPath('hoodies');
  if (!path) return false;
  if (window.LOTraitRegistry && LOTraitRegistry.isBlankTrait(path)) return false;
  return true;
}

function filterCreatorHatsForHoodieState(hatList, hasHoodie) {
  return (hatList || []).filter(function (t) {
    var p = loTraitPath(t);
    if (!p) return false;
    if (hasHoodie) return creatorHatCompatibleWithHoodie(p);
    return !creatorHatIsHoodieOnlyBeanie(p);
  });
}

/** Hoodies: no hair; only Backwards Hats + Beanie (Black/White) under the hoodie. */
function enforceCreatorHoodieHatRules(category, filename) {
  if (window.__loGenCollectionOffscreen) return;
  filename = resolveCreatorTraitPath(filename);
  if (category === 'hoodies' && filename) {
    selectTrait('hair', '', true, true);
    var hatPath = creatorGetSlotPath('hat');
    if (hatPath && !creatorHatCompatibleWithHoodie(hatPath)) {
      selectTrait('hat', '', true, true);
    }
    if (creatorTraitIsHeadphones(creatorGetSlotPath('goo'))) {
      selectTrait('goo', '', true, true);
    }
    if (creatorTraitIsHeadphones(creatorGetSlotPath('accessories'))) {
      selectTrait('accessories', '', true, true);
    }
  } else if (category === 'hoodies' && !filename) {
    var wornHat = creatorGetSlotPath('hat');
    if (creatorHatIsHoodieOnlyBeanie(wornHat)) {
      selectTrait('hat', '', true, true);
    }
  } else if (category === 'hair' && filename && creatorHasHoodieSelected()) {
    selectTrait('hair', '', true, true);
  } else if ((category === 'goo' || category === 'accessories') && filename &&
      creatorHasHoodieSelected() && creatorTraitIsHeadphones(filename)) {
    selectTrait(category, '', true, true);
  } else if (category === 'hat' && filename && !creatorHatCompatibleWithHoodie(filename) && creatorHasHoodieSelected()) {
    selectTrait('hat', '', true, true);
  } else if (category === 'hat' && filename && creatorHatIsHoodieOnlyBeanie(filename) && !creatorHasHoodieSelected()) {
    selectTrait('hat', '', true, true);
  }
}

window.creatorHasHoodieSelected = creatorHasHoodieSelected;
window.creatorHatCompatibleWithHoodie = creatorHatCompatibleWithHoodie;
window.creatorHatIsHoodieOnlyBeanie = creatorHatIsHoodieOnlyBeanie;
window.filterCreatorHatsForHoodieState = filterCreatorHatsForHoodieState;

function findCreatorCompatEntry(section, primaryId, secondaryId) {
  if (!section || !primaryId || !secondaryId) return null;
  if (section[primaryId] && section[primaryId][secondaryId]) {
    return section[primaryId][secondaryId];
  }
  var prefix = creatorHairStylePrefix(primaryId);
  if (!prefix) return null;
  var pid;
  for (pid in section) {
    if (!Object.prototype.hasOwnProperty.call(section, pid)) continue;
    if (creatorHairStylePrefix(pid) === prefix && section[pid][secondaryId]) {
      return section[pid][secondaryId];
    }
  }
  return null;
}

function getCreatorHairCompatEntry(hairId, glassesId) {
  var store = loGetCreatorCompatStore();
  if (!store || !store.hair_vs_glasses) return null;
  var gids = creatorGlassesCompatIds(glassesId);
  var i, entry;
  for (i = 0; i < gids.length; i++) {
    entry = findCreatorCompatEntry(store.hair_vs_glasses, hairId, gids[i]);
    if (entry) return entry;
  }
  return null;
}

function getCreatorHatCompatEntry(hatPath, glassesId) {
  var store = loGetCreatorCompatStore();
  if (!store || !store.hats_vs_glasses) return null;
  var ids = creatorHatLookupIds(hatPath);
  var gids = creatorGlassesCompatIds(glassesId);
  var i, j, entry, gid;
  for (i = 0; i < ids.length; i++) {
    for (j = 0; j < gids.length; j++) {
      gid = gids[j];
      entry = findCreatorCompatEntry(store.hats_vs_glasses, ids[i], gid);
      if (entry) return entry;
      if (store.hats_vs_glasses[ids[i]] && store.hats_vs_glasses[ids[i]][gid]) {
        return store.hats_vs_glasses[ids[i]][gid];
      }
    }
  }
  return null;
}

function creatorCompatIsBlocked(entry) {
  if (!entry || !entry.status) return false;
  return String(entry.status).toLowerCase() === 'blocked';
}

function creatorGetSlotPath(slot) {
  return creatorSlotEl(slot) ? getTraitPathFromDisplayImg(creatorSlotEl(slot)) : '';
}

function creatorPathIsActiveHat(path) {
  if (!path) return false;
  if (window.LOTraitRegistry && LOTraitRegistry.isBlankTrait(path)) return false;
  var u = path.toUpperCase();
  if (u.endsWith('/AA.PNG') || u.endsWith('/AAA.PNG') || u.indexOf('REMOVE') >= 0) return false;
  return true;
}

function creatorPathsAfterSelect(category, filename) {
  return {
    hair: category === 'hair' ? (filename || '') : creatorGetSlotPath('hair'),
    accessories: category === 'accessories' ? (filename || '') : creatorGetSlotPath('accessories'),
    hat: category === 'hat' ? (filename || '') : creatorGetSlotPath('hat')
  };
}

/** Creator deselected + Collection Builder excluded + Collection 1 hoodie ban. */
function loBuildEffectiveExcludedSets(cbExcludedBySlot) {
  cbExcludedBySlot = cbExcludedBySlot || {};
  var out = {};
  Object.keys(TRAIT_DATA || {}).forEach(function (slot) {
    out[slot] = new Set((cbExcludedBySlot[slot] || []).map(String));
  });
  Object.keys(TRAIT_DATA || {}).forEach(function (slot) {
    (TRAIT_DATA[slot] || []).forEach(function (t) {
      if (!t || t.isRemove) return;
      if (t.selected === false) {
        var id = (t.id != null) ? String(t.id) : null;
        if (!id && window.LOCreatorSuite && typeof window.LOCreatorSuite.stableTraitId === 'function') {
          id = String(window.LOCreatorSuite.stableTraitId(t));
        }
        if (id) out[slot].add(id);
      }
    });
  });
  if (!out.hoodies) out.hoodies = new Set();
  (TRAIT_DATA.hoodies || []).forEach(function (t) {
    if (!t || t.isRemove) return;
    var hid = (t.id != null) ? String(t.id) : null;
    if (!hid && window.LOCreatorSuite && typeof window.LOCreatorSuite.stableTraitId === 'function') {
      hid = String(window.LOCreatorSuite.stableTraitId(t));
    }
    if (hid) out.hoodies.add(hid);
  });
  return out;
}

/** Stable trait id shared by Collection Setup and Character Creator. */
function loTraitIdForSync(trait) {
  if (!trait) return null;
  if (window.LOCreatorSuite && typeof window.LOCreatorSuite.stableTraitId === 'function') {
    return window.LOCreatorSuite.stableTraitId(trait);
  }
  if (trait.id != null) return String(trait.id);
  if (trait.normalizedName) return String(trait.normalizedName);
  var path = trait.path || trait.image || '';
  if (path) return 'path:' + String(path).toLowerCase();
  return null;
}

function loLoadCollectionBuilderConfigRaw() {
  try {
    var raw = localStorage.getItem('lo_collection_builder_config_v1');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function loHasSavedTraitSelection(cfg) {
  cfg = cfg || loLoadCollectionBuilderConfigRaw();
  if (!cfg || typeof cfg !== 'object') return false;
  if (cfg.lastSyncedAt) return true;
  var ex = cfg.excludedTraitIdsBySlot;
  if (!ex || typeof ex !== 'object') return false;
  return Object.keys(ex).some(function (slot) {
    return Array.isArray(ex[slot]) && ex[slot].length > 0;
  });
}

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


/** Push Collection Setup include/exclude state onto Character Creator data + tiles. */
function loApplyCollectionExclusionsToCreator(cfg) {
  loSyncTraitDataFromRegistry();
  if (!cfg || typeof cfg !== 'object') cfg = loLoadCollectionBuilderConfigRaw();
  var ex = (cfg && cfg.excludedTraitIdsBySlot && typeof cfg.excludedTraitIdsBySlot === 'object')
    ? cfg.excludedTraitIdsBySlot
    : {};
  Object.keys(TRAIT_DATA || {}).forEach(function (slot) {
    var exSet = new Set((ex[slot] || []).map(String));
    (TRAIT_DATA[slot] || []).forEach(function (t) {
      if (!t || t.isRemove) return;
      var id = loTraitIdForSync(t);
      if (!id) return;
      t.selected = !exSet.has(String(id));
    });
  });
  if (typeof loRefreshAllCreatorTraitUi === 'function') loRefreshAllCreatorTraitUi();
  try {
    if (typeof applyCreatorCompatLayers === 'function') applyCreatorCompatLayers();
  } catch (e) {}
}

function loRefreshCreatorTraitUiForSlot(slot) {
  var categoryId = slotToCategoryId[slot];
  if (!categoryId) return;
  var cat = document.getElementById(categoryId);
  if (!cat) return;
  loSyncTraitDataFromRegistry();
  cat.querySelectorAll('.trait-options img').forEach(function (img) {
    var path = img.dataset.src || '';
    var t = findTraitInSlotByPath(slot, path);
    if (!t) return;
    setTraitSelected(img, t.selected !== false);
  });
  updateCategoryCounter(categoryId);
}

function loRefreshAllCreatorTraitUi() {
  Object.keys(slotToCategoryId || {}).forEach(function (slot) {
    loRefreshCreatorTraitUiForSlot(slot);
  });
  try { updateAllCategoryCounters(); } catch (e) {}
}

function loSetCreatorTraitSelected(slot, traitId, selected) {
  if (!slot || !traitId) return;
  loSyncTraitDataFromRegistry();
  (TRAIT_DATA[slot] || []).forEach(function (t) {
    if (!t || t.isRemove) return;
    var id = loTraitIdForSync(t);
    if (id && String(id) === String(traitId)) t.selected = !!selected;
  });
  loRefreshCreatorTraitUiForSlot(slot);
  if (slot === 'hair' || slot === 'accessories' || slot === 'hat') {
    try {
      if (window.selectedGender === 'female' && typeof window.__loFemaleEnforceHair === 'function') {
        window.__loFemaleEnforceHair();
      } else if (typeof applyCreatorCompatLayers === 'function') {
        applyCreatorCompatLayers();
      }
    } catch (e) {}
  }
}

/** Push Character Creator checkbox state → Collection Setup storage (full slot or all slots). */
function loSyncCreatorSelectionToCollectionBuilder(opts) {
  opts = opts || {};
  loSyncTraitDataFromRegistry();
  var cfg = loLoadCollectionBuilderConfigRaw() || {
    schemaVersion: 1,
    collectionName: 'Collection 1',
    targetSupply: 5555,
    excludedTraitIdsBySlot: {}
  };
  if (!cfg.excludedTraitIdsBySlot || typeof cfg.excludedTraitIdsBySlot !== 'object') {
    cfg.excludedTraitIdsBySlot = {};
  }
  var slots = opts.slot ? [opts.slot] : Object.keys(TRAIT_DATA || {});
  slots.forEach(function (slot) {
    var ex = [];
    (TRAIT_DATA[slot] || []).forEach(function (t) {
      if (!t || t.isRemove) return;
      var id = loTraitIdForSync(t);
      if (!id) return;
      if (t.selected === false) ex.push(String(id));
    });
    cfg.excludedTraitIdsBySlot[slot] = ex;
  });
  cfg.lastSyncedAt = new Date().toISOString();
  if (typeof window.__loCbSaveConfigQuiet === 'function') {
    window.__loCbSaveConfigQuiet(cfg, opts.reason || 'sync_from_creator', { applyToCreator: false });
  } else {
    try { localStorage.setItem('lo_collection_builder_config_v1', JSON.stringify(cfg, null, 2)); } catch (eSave) {}
  }
  return cfg;
}

/** Mirror one Character Creator trait checkbox into Collection Setup storage. */
function loSyncCreatorTraitToCollectionBuilder(slot, trait) {
  if (!trait || !slot) return;
  var id = loTraitIdForSync(trait);
  if (!id) return;
  try {
    var cfg = loLoadCollectionBuilderConfigRaw() || {
      schemaVersion: 1,
      collectionName: 'Collection 1',
      targetSupply: 5555,
      excludedTraitIdsBySlot: {}
    };
    if (!cfg.excludedTraitIdsBySlot || typeof cfg.excludedTraitIdsBySlot !== 'object') {
      cfg.excludedTraitIdsBySlot = {};
    }
    if (!Array.isArray(cfg.excludedTraitIdsBySlot[slot])) cfg.excludedTraitIdsBySlot[slot] = [];
    var s = new Set(cfg.excludedTraitIdsBySlot[slot].map(String));
    if (trait.selected === false) s.add(String(id));
    else s.delete(String(id));
    cfg.excludedTraitIdsBySlot[slot] = Array.from(s);
    cfg.lastSyncedAt = new Date().toISOString();
    if (typeof window.__loCbSaveConfigQuiet === 'function') {
      window.__loCbSaveConfigQuiet(cfg, 'sync_from_creator_trait', { applyToCreator: false });
    } else {
      localStorage.setItem('lo_collection_builder_config_v1', JSON.stringify(cfg));
    }
  } catch (e) {}
}

function loSyncCreatorSlotToCollectionBuilder(slot) {
  loSyncCreatorSelectionToCollectionBuilder({ slot: slot, reason: 'sync_from_creator_slot' });
}

window.loSyncCreatorSelectionToCollectionBuilder = loSyncCreatorSelectionToCollectionBuilder;
window.loApplyCollectionExclusionsToCreator = loApplyCollectionExclusionsToCreator;
window.loApplySavedTraitSelectionOrDefaults = loApplySavedTraitSelectionOrDefaults;
window.loSetCreatorTraitSelected = loSetCreatorTraitSelected;
window.loSyncCreatorTraitToCollectionBuilder = loSyncCreatorTraitToCollectionBuilder;
window.loSyncCreatorSlotToCollectionBuilder = loSyncCreatorSlotToCollectionBuilder;

if (!window.__loTraitSelectionPersistWired) {
  window.__loTraitSelectionPersistWired = true;
  window.addEventListener('beforeunload', function () {
    try {
      if (window.__loTraitsReady && typeof loSyncCreatorSelectionToCollectionBuilder === 'function') {
        loSyncCreatorSelectionToCollectionBuilder({ reason: 'beforeunload' });
      }
    } catch (e) {}
  });
}

/** True if this trait combination is BLOCKED by Trait Manager rules (all category pairs). */
function creatorIsBlockedCombo(paths) {
  if (!paths) return false;
  if (paths.accessories && !(window.LOTraitRegistry && LOTraitRegistry.isBlankTrait(paths.accessories))) {
    var store = loGetCreatorCompatStore();
    if (store) {
      var glassesId = creatorTraitIdFromPath(paths.accessories);
      if (glassesId) {
        if (paths.hair) {
          var hairEntry = getCreatorHairCompatEntry(creatorTraitIdFromPath(paths.hair), glassesId);
          if (creatorCompatIsBlocked(hairEntry)) return true;
        }
        if (creatorPathIsActiveHat(paths.hat)) {
          var hatEntry = getCreatorHatCompatEntry(paths.hat, glassesId);
          if (creatorCompatIsBlocked(hatEntry)) return true;
        }
      }
    }
  }
  if (typeof window.loCreatorCompatBlockedForPaths === 'function' && window.loCreatorCompatBlockedForPaths(paths)) {
    return true;
  }
  return false;
}

function creatorFilterTraitsForCompat(traitList, hairPath, hatPath) {
  return (traitList || []).filter(function (t) {
    var p = loTraitPath(t);
    if (!p) return false;
    return !creatorIsBlockedCombo({ hair: hairPath || '', accessories: p, hat: hatPath || '' });
  });
}

function creatorPickRandomGlasses(accList, hairPath, hatPath) {
  var allowed = creatorFilterTraitsForCompat(accList, hairPath, hatPath);
  return allowed.length ? pickRandomTraitFromList(allowed) : null;
}

/** Match Trait Manager resolveLayerMode — swap status uses inverted stack, not DOM default. */
function creatorResolveLayerMode(entry, pairKind) {
  if (!entry || creatorCompatIsBlocked(entry)) return null;
  var status = String(entry.status || '').toLowerCase().trim();
  var hairDefault = 'glasses_above_hair';
  var hairSwap = 'hair_above_glasses';
  var hatDefault = 'hat_above_glasses';
  var hatSwap = 'glasses_above_hat';
  var def = pairKind === 'hair' ? hairDefault : hatDefault;
  var swap = pairKind === 'hair' ? hairSwap : hatSwap;
  var m = String(entry.layerMode || '').trim().toLowerCase();

  if (status === 'swap') return swap;

  if (m === 'glasses_above_hair' || m === 'hair_above_glasses' ||
      m === 'hat_above_glasses' || m === 'glasses_above_hat') {
    return m;
  }
  if (status === 'allowed' || status === 'offset' || status === 'skipped') return def;
  return m || def;
}

var CREATOR_HAND_SLOTS = ['ball', 'hand', 'ball2', 'hand2'];
var CREATOR_ABOVE_HEAD_SLOTS = ['goo'];
var CREATOR_STACK_SLOTS = ['hair', 'accessories', 'hat'];
var CREATOR_Z_BASE = 10;
var CREATOR_Z_STACK = 72;
var CREATOR_Z_HOODIE = 90;
var CREATOR_Z_ABOVE_HEAD = 100;
var CREATOR_Z_HAND = 120;

function creatorSlotEl(slot) {
  var id = window.__loGenCollectionOffscreen ? 'off_' + slot : slot;
  return document.getElementById(id);
}

function isCreatorSlotVisible(el) {
  if (!el) return false;
  if (el.style.visibility === 'hidden') return false;
  var src = el.getAttribute('src') || el.src || '';
  return !!src;
}

function creatorTraitIsHeadphones(pathOrTrait) {
  var name = '';
  if (pathOrTrait && typeof pathOrTrait === 'object') {
    name = (pathOrTrait.normalizedName || pathOrTrait.traitName || pathOrTrait.name || '').toLowerCase();
  } else if (pathOrTrait) {
    var t = window.LOTraitRegistry && LOTraitRegistry.getTraitByPath(pathOrTrait);
    if (t) name = (t.normalizedName || t.traitName || '').toLowerCase();
    else name = String(pathOrTrait).toLowerCase();
  }
  return name === 'headphones' || name.indexOf('headphone') >= 0;
}

function creatorGetMouthZIndex() {
  if (typeof displaySlotOrder === 'undefined') return CREATOR_Z_BASE + 12;
  var mouthIdx = displaySlotOrder.indexOf('mouth');
  if (mouthIdx < 0) mouthIdx = 6;
  return CREATOR_Z_BASE + mouthIdx * 2;
}

/** Accessories headphones must sit under the mouth (beards). */
function ensureCreatorAccessoriesLayer() {
  var el = creatorSlotEl('accessories');
  if (!el || !isCreatorSlotVisible(el)) return;
  var path = getTraitPathFromDisplayImg(el);
  if (creatorTraitIsHeadphones(path)) {
    el.style.zIndex = String(creatorGetMouthZIndex() - 2);
  }
}

/** Above-head (goo): Headphones sit under mouth; other goo traits stay above hair/headwear. */
function ensureCreatorGooLayer() {
  var prefix = window.__loGenCollectionOffscreen ? 'off_' : '';
  var el = document.getElementById(prefix + 'goo');
  if (!el || !isCreatorSlotVisible(el)) return;
  var path = getTraitPathFromDisplayImg(el);
  if (creatorTraitIsHeadphones(path)) {
    el.style.zIndex = String(creatorGetMouthZIndex() - 2);
  } else {
    el.style.zIndex = String(CREATOR_Z_ABOVE_HEAD);
  }
}

function ensureCreatorAboveHeadOnTop() {
  ensureCreatorGooLayer();
}

/** Hoodies sit above hair/headwear stack but below goo and hands. */
function ensureCreatorHoodieLayer() {
  var el = creatorSlotEl('hoodies');
  if (!el || !isCreatorSlotVisible(el)) return;
  el.style.zIndex = String(CREATOR_Z_HOODIE);
}

/** Hands + held items always on the very top. */
function ensureCreatorHandsOnTop() {
  var prefix = window.__loGenCollectionOffscreen ? 'off_' : '';
  CREATOR_HAND_SLOTS.forEach(function (slot, i) {
    var el = document.getElementById(prefix + slot);
    if (!el || !isCreatorSlotVisible(el)) return;
    el.style.zIndex = String(CREATOR_Z_HAND + i * 2);
  });
}

function ensureCreatorTopLayers() {
  ensureCreatorAccessoriesLayer();
  ensureCreatorHoodieLayer();
  ensureCreatorAboveHeadOnTop();
  ensureCreatorHandsOnTop();
}

function creatorTraitPathFromTraits(traits, slot) {
  if (!traits) return '';
  var tid = traits[slot];
  if (!tid) return '';
  if (window.LOCandidateEngine && typeof window.LOCandidateEngine.traitPathById === 'function') {
    var p = window.LOCandidateEngine.traitPathById(tid);
    if (p) return p;
  }
  if (window.LOTraitRegistry && LOTraitRegistry.getTraitById) {
    var t = LOTraitRegistry.getTraitById(String(tid));
    if (t) return t.path || t.image || '';
  }
  return '';
}

function creatorTraitPathIsActive(path) {
  if (!path) return false;
  if (window.LOTraitRegistry && LOTraitRegistry.isBlankTrait(path)) return false;
  return true;
}

/** Path-based z-index map for previews (grid thumbs, exports) — mirrors creator + compat rules. */
function computeCreatorLayerZMapForTraits(traits) {
  traits = traits || {};
  var zMap = {};
  var order = (typeof displaySlotOrder !== 'undefined' && Array.isArray(displaySlotOrder) && displaySlotOrder.length)
    ? displaySlotOrder
    : ['background', 'backgroundblur', 'behindback', 'skin', 'eyes', 'clothing', 'mouth', 'hair', 'accessories', 'hat', 'hoodies', 'goo', 'ball', 'hand', 'ball2', 'hand2'];

  order.forEach(function (slot, idx) {
    if (CREATOR_HAND_SLOTS.indexOf(slot) >= 0) {
      zMap[slot] = CREATOR_Z_HAND + CREATOR_HAND_SLOTS.indexOf(slot) * 2;
    } else if (CREATOR_ABOVE_HEAD_SLOTS.indexOf(slot) >= 0) {
      zMap[slot] = CREATOR_Z_ABOVE_HEAD + CREATOR_ABOVE_HEAD_SLOTS.indexOf(slot) * 2;
    } else if (CREATOR_STACK_SLOTS.indexOf(slot) >= 0) {
      zMap[slot] = CREATOR_Z_STACK + CREATOR_STACK_SLOTS.indexOf(slot) * 2;
    } else if (slot === 'hoodies') {
      zMap[slot] = CREATOR_Z_HOODIE;
    } else {
      zMap[slot] = CREATOR_Z_BASE + idx * 2;
    }
  });

  if (window.__loCreatorCompat) {
    var hairPath = creatorTraitPathFromTraits(traits, 'hair');
    var accPath = creatorTraitPathFromTraits(traits, 'accessories');
    var hatPath = creatorTraitPathFromTraits(traits, 'hat');
    var hasHair = creatorTraitPathIsActive(hairPath);
    var hasAcc = creatorTraitPathIsActive(accPath);
    var hasHat = creatorPathIsActiveHat(hatPath);
    var hairId = creatorTraitIdFromPath(hairPath);
    var glassesId = creatorTraitIdFromPath(accPath);
    var hairLayerMode = null;
    var hatLayerMode = null;

    if (hasHair && hasAcc) {
      var hairEntry = getCreatorHairCompatEntry(hairId, glassesId);
      if (!creatorCompatIsBlocked(hairEntry)) {
        hairLayerMode = creatorResolveLayerMode(hairEntry, 'hair');
      }
    }
    if (hasHat && hasAcc) {
      var hatEntry = getCreatorHatCompatEntry(hatPath, glassesId);
      if (!creatorCompatIsBlocked(hatEntry)) {
        hatLayerMode = creatorResolveLayerMode(hatEntry, 'hat');
      }
    }

    var ranks = buildCreatorLayerRanks(
      hasHair && hasAcc && !!hairLayerMode,
      hasAcc,
      hasHat && hasAcc && !!hatLayerMode,
      hairLayerMode,
      hatLayerMode
    );
    Object.keys(ranks).forEach(function (slot) {
      zMap[slot] = ranks[slot];
    });
  }

  var accPath2 = creatorTraitPathFromTraits(traits, 'accessories');
  if (accPath2 && creatorTraitIsHeadphones(accPath2)) {
    zMap.accessories = creatorGetMouthZIndex() - 2;
  }
  var gooPath = creatorTraitPathFromTraits(traits, 'goo');
  if (gooPath && creatorTraitPathIsActive(gooPath)) {
    if (creatorTraitIsHeadphones(gooPath)) {
      zMap.goo = creatorGetMouthZIndex() - 2;
    } else {
      zMap.goo = CREATOR_Z_ABOVE_HEAD;
    }
  }
  CREATOR_HAND_SLOTS.forEach(function (slot, i) {
    var p = creatorTraitPathFromTraits(traits, slot);
    if (creatorTraitPathIsActive(p)) {
      zMap[slot] = CREATOR_Z_HAND + i * 2;
    }
  });

  return zMap;
}

window.computeCreatorLayerZMapForTraits = computeCreatorLayerZMapForTraits;

function creatorResetDisplayZIndex() {
  if (typeof displaySlotOrder === 'undefined') return;
  displaySlotOrder.forEach(function (slot, idx) {
    var el = creatorSlotEl(slot);
    if (!el) return;
    if (CREATOR_HAND_SLOTS.indexOf(slot) >= 0) {
      el.style.zIndex = String(CREATOR_Z_HAND + CREATOR_HAND_SLOTS.indexOf(slot) * 2);
    } else if (CREATOR_ABOVE_HEAD_SLOTS.indexOf(slot) >= 0) {
      el.style.zIndex = String(CREATOR_Z_ABOVE_HEAD + CREATOR_ABOVE_HEAD_SLOTS.indexOf(slot) * 2);
    } else if (CREATOR_STACK_SLOTS.indexOf(slot) >= 0) {
      el.style.zIndex = String(CREATOR_Z_STACK + CREATOR_STACK_SLOTS.indexOf(slot) * 2);
    } else if (slot === 'hoodies') {
      el.style.zIndex = String(CREATOR_Z_HOODIE);
    } else {
      el.style.zIndex = String(CREATOR_Z_BASE + idx * 2);
    }
  });
}

/** Build front-to-back ranks; higher number = drawn on top. */
function buildCreatorLayerRanks(hasHair, hasAcc, hasHat, hairLayerMode, hatLayerMode) {
  var nodes = [];
  if (hasHair) nodes.push('hair');
  if (hasAcc) nodes.push('accessories');
  if (hasHat) nodes.push('hat');
  if (!nodes.length) return {};

  var rank = {};
  nodes.forEach(function (n, i) { rank[n] = i; });

  var edges = [];
  if (hasHair && hasAcc && hairLayerMode) {
    if (hairLayerMode === 'hair_above_glasses') {
      edges.push(['hair', 'accessories']);
    } else {
      edges.push(['accessories', 'hair']);
    }
  }
  if (hasHat && hasAcc && hatLayerMode) {
    if (hatLayerMode === 'hat_above_glasses') {
      edges.push(['hat', 'accessories']);
    } else {
      edges.push(['accessories', 'hat']);
    }
  }

  var guard = 0;
  var changed = true;
  while (changed && guard++ < 24) {
    changed = false;
    edges.forEach(function (pair) {
      var front = pair[0];
      var back = pair[1];
      if (rank[front] <= rank[back]) {
        rank[front] = rank[back] + 1;
        changed = true;
      }
    });
    nodes.slice().sort(function (a, b) { return rank[a] - rank[b]; }).forEach(function (n, i) {
      rank[n] = i;
    });
  }

  var z = {};
  nodes.forEach(function (n) {
    z[n] = CREATOR_Z_STACK + rank[n] * 4;
  });
  return z;
}

function setCreatorBlockedOverlay(isBlocked) {
  if (window.__loGenCollectionOffscreen) return;
  var el = document.getElementById('creatorBlockedOverlay');
  if (!el) return;
  el.classList.toggle('is-visible', !!isBlocked);
  el.setAttribute('aria-hidden', isBlocked ? 'false' : 'true');
}

function applyCreatorCompatLayers() {
  if (!window.__loCreatorCompat) return;

  reconcileCreatorHairHatState();
  creatorResetDisplayZIndex();

  var hairEl = creatorSlotEl('hair');
  var accEl = creatorSlotEl('accessories');
  var hatEl = creatorSlotEl('hat');
  var hairPath = hairEl ? getTraitPathFromDisplayImg(hairEl) : '';
  var accPath = accEl ? getTraitPathFromDisplayImg(accEl) : '';
  var hasHair = !!hairPath;
  var hasAcc = !!accPath && !(window.LOTraitRegistry && LOTraitRegistry.isBlankTrait(accPath));
  var hatPathLive = hatEl ? getTraitPathFromDisplayImg(hatEl) : '';
  var hasHat = !!hatPathLive;

  var hairId = creatorTraitIdFromPath(hairPath);
  var glassesId = creatorTraitIdFromPath(accPath);

  var blocked = false;
  var hairLayerMode = null;
  var hatLayerMode = null;

  if (hasHair && hasAcc) {
    var hairEntry = getCreatorHairCompatEntry(hairId, glassesId);
    if (creatorCompatIsBlocked(hairEntry)) blocked = true;
    else hairLayerMode = creatorResolveLayerMode(hairEntry, 'hair');
  }

  if (hasHat && hasAcc) {
    var hatEntry = getCreatorHatCompatEntry(hatPathLive, glassesId);
    if (creatorCompatIsBlocked(hatEntry)) blocked = true;
    else hatLayerMode = creatorResolveLayerMode(hatEntry, 'hat');
  }

  if (blocked) {
    setCreatorBlockedOverlay(false);
    if (hasAcc) selectTrait('accessories', '', true);
    ensureCreatorTopLayers();
    return;
  }

  var ranks = buildCreatorLayerRanks(
    hasHair && hasAcc && !!hairLayerMode,
    hasAcc,
    hasHat && hasAcc && !!hatLayerMode,
    hairLayerMode,
    hatLayerMode
  );

  Object.keys(ranks).forEach(function (slot) {
    var el = creatorSlotEl(slot);
    if (el) el.style.zIndex = String(ranks[slot]);
  });

  setCreatorBlockedOverlay(blocked);
  ensureCreatorTopLayers();
}

window.applyCreatorCompatLayers = applyCreatorCompatLayers;
window.loadCreatorCompatData = loadCreatorCompatData;

loBootstrapApp();

function syncHandsToCurrentSkin() {
  if (!window.LOTraitRegistry) return;
  var skinEl = document.getElementById(window.__loGenCollectionOffscreen ? 'off_skin' : 'skin');
  var skinPath = skinEl ? getTraitPathFromDisplayImg(skinEl) : '';
  var skinTrait = skinPath ? LOTraitRegistry.getTraitByPath(skinPath) : null;
  if (!skinTrait) return;
  ['hand', 'hand2', 'ball', 'ball2'].forEach(function (slot) {
    var el = document.getElementById(window.__loGenCollectionOffscreen ? 'off_' + slot : slot);
    var p = el ? getTraitPathFromDisplayImg(el) : '';
    if (!p) return;
    var t = LOTraitRegistry.getTraitByPath(p);
    if (t && !LOTraitRegistry.traitMatchesSkin(t, skinTrait)) {
      selectTrait(slot, '', true);
    }
  });
  loEnforceHandItemPairsOnDisplay('skin');
}

/** Hand + Item generation rules: 60% none, 40% paired; Hand1+Item1 or Hand2+Item2 only. */
window.LO_HAND_ITEM_RULES = {
  noHandItemRate: 0.60,
  handItemRate: 0.40,
  grip1Rate: 0.5
};

window.LO_HAND_ITEM_GRIPS = {
  grip1: { hand: 'hand', item: 'ball' },
  grip2: { hand: 'hand2', item: 'ball2' }
};

function loRng01(rng) {
  if (typeof rng === 'function') return rng();
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    var buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

function loIsBlankHandTrait(t) {
  if (!t) return true;
  if (window.LOTraitRegistry) return LOTraitRegistry.isBlankTrait(t);
  var path = t.image || t.path || '';
  var u = (path + '').toUpperCase();
  return !path || u.indexOf('NO HAND') >= 0 || u.endsWith('/AA.PNG') || u.endsWith('/AAA.PNG');
}

function loClearHandItemSlots() {
  window.__loHandItemComboLock = true;
  selectTrait('hand', '', true);
  selectTrait('hand2', '', true);
  selectTrait('ball', '', true);
  selectTrait('ball2', '', true);
  window.__loHandItemComboLock = false;
  loEnforceHandItemPairsOnDisplay('hand');
}

function loCandidateHasHandItemCombo(traits) {
  if (!traits) return false;
  return !!(traits.hand && traits.ball) || !!(traits.hand2 && traits.ball2);
}
window.loCandidateHasHandItemCombo = loCandidateHasHandItemCombo;

function loRollHandItemPresence(rng, opts) {
  opts = opts || {};
  var rate = (window.LO_HAND_ITEM_RULES && window.LO_HAND_ITEM_RULES.handItemRate) || 0.40;
  if (opts.quota && isFinite(opts.quota.batchQty)) {
    var wantWith = opts.quota.wantWith != null
      ? Math.max(0, Math.round(opts.quota.wantWith))
      : Math.round(opts.quota.batchQty * rate);
    var wantWithout = opts.quota.wantWithout != null
      ? Math.max(0, Math.round(opts.quota.wantWithout))
      : Math.max(0, opts.quota.batchQty - wantWith);
    var needWith = wantWith - (opts.quota.with || 0);
    var needWithout = wantWithout - (opts.quota.without || 0);
    if (needWith <= 0) return false;
    if (needWithout <= 0) return true;
    return loRng01(rng) < (needWith / (needWith + needWithout));
  }
  return loRng01(rng) < rate;
}

function loRollHandGripStyle(rng, opts) {
  opts = opts || {};
  var stats = opts.gripStats || null;
  if (stats) {
    var g1 = stats.grip1 || 0;
    var g2 = stats.grip2 || 0;
    if (g1 < g2) return 'grip1';
    if (g2 < g1) return 'grip2';
  }
  return loRng01(rng) < window.LO_HAND_ITEM_RULES.grip1Rate ? 'grip1' : 'grip2';
}

function loGetSkinMatchedTraits(pool, skinTrait) {
  if (!pool || !pool.length) return [];
  return pool.filter(function (t) {
    if (!t || loIsBlankHandTrait(t)) return false;
    if (!window.__loGenCollectionOffscreen && t.selected === false) return false;
    if (skinTrait && window.LOTraitRegistry && LOTraitRegistry.traitMatchesSkin) {
      return LOTraitRegistry.traitMatchesSkin(t, skinTrait);
    }
    return true;
  });
}

function loPickMatchingHandTrait(pool, skinTrait, skinIndex, legacyHands) {
  if (!pool || !pool.length || !skinTrait) return null;
  var compatible = loGetSkinMatchedTraits(pool, skinTrait);
  if (!compatible.length) return null;
  if (legacyHands && skinIndex > 0) {
    var legacy = compatible.find(function (t) {
      var path = loTraitPath(t);
      if (!path) return false;
      var match = path.match(/(\d+)\.PNG$/i) || path.match(/(\d+)/);
      if (!match) return false;
      return parseInt(match[1], 10) === skinIndex;
    });
    if (legacy) return legacy;
  }
  if (window.LOTraitRegistry && LOTraitRegistry.findMatchingHandTrait) {
    return LOTraitRegistry.findMatchingHandTrait(compatible, skinTrait);
  }
  return pickRandomTraitFromList(compatible);
}

function loPickItemTrait(pool, skinTrait) {
  if (!pool || !pool.length) return null;
  var compatible = loGetSkinMatchedTraits(pool, skinTrait);
  if (!compatible.length) {
    compatible = pool.filter(function (t) { return t && !loIsBlankHandTrait(t) && (window.__loGenCollectionOffscreen || t.selected !== false); });
  }
  if (!compatible.length) return null;
  if (window.__loGenCollectionOffscreen && typeof window.__loTraitPickFn === 'function') {
    return window.__loTraitPickFn(compatible);
  }
  return pickRandomTraitFromList(compatible);
}

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

function loSetHandItemSlotDirect(slot, filename) {
  filename = resolveCreatorTraitPath(filename);
  var id = window.__loGenCollectionOffscreen ? 'off_' + slot : slot;
  var el = document.getElementById(id);
  if (!el) return;
  if (filename) {
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
  }
}

function loApplyHandItemPair(gripKey, handTrait, itemTrait) {
  var grips = window.LO_HAND_ITEM_GRIPS || {};
  var grip = grips[gripKey];
  if (!grip || !handTrait || !itemTrait) return false;
  window.__loHandItemComboLock = true;
  loSetHandItemSlotDirect('hand', '');
  loSetHandItemSlotDirect('hand2', '');
  loSetHandItemSlotDirect('ball', '');
  loSetHandItemSlotDirect('ball2', '');
  loSetHandItemSlotDirect(grip.hand, loTraitPath(handTrait));
  loSetHandItemSlotDirect(grip.item, loTraitPath(itemTrait));
  window.__loHandItemComboLock = false;
  loEnforceHandItemPairsOnDisplay(grip.hand);
  return true;
}

function loApplyHandItemCombo(skinTrait, skinIndex, opts) {
  opts = opts || {};
  var rng = opts.rng;
  var legacyHands = loUsesLegacyNumericTraits();
  loClearHandItemSlots();

  var wantHandItem = (typeof opts.wantHandItem === 'boolean')
    ? opts.wantHandItem
    : loRollHandItemPresence(rng, opts);
  if (!wantHandItem) return { ok: true, hasHandItem: false };

  if (!skinTrait) {
    return { ok: !opts.requireHandItem, hasHandItem: false, code: 'missing_skin' };
  }

  var handList = getSelectedTraits('hand').filter(function (t) { return !loIsBlankHandTrait(t); });
  var hand2List = getSelectedTraits('hand2').filter(function (t) { return !loIsBlankHandTrait(t); });
  var ballList = getSelectedTraits('ball').filter(function (t) { return !loIsBlankHandTrait(t); });
  var ball2List = getSelectedTraits('ball2').filter(function (t) { return !loIsBlankHandTrait(t); });

  var gripOrder = [];
  var preferred = opts.gripStyle || loRollHandGripStyle(rng, { gripStats: opts.gripStats });
  gripOrder.push(preferred);
  gripOrder.push(preferred === 'grip1' ? 'grip2' : 'grip1');

  for (var gi = 0; gi < gripOrder.length; gi++) {
    var gripKey = gripOrder[gi];
    var handPool = gripKey === 'grip1' ? handList : hand2List;
    var itemPool = gripKey === 'grip1' ? ballList : ball2List;
    if (!handPool.length || !itemPool.length) continue;
    var handTrait = loPickMatchingHandTrait(handPool, skinTrait, skinIndex, legacyHands);
    if (!handTrait) continue;
    var itemTrait = loPickItemTrait(itemPool, skinTrait);
    if (!itemTrait) continue;
    if (loApplyHandItemPair(gripKey, handTrait, itemTrait)) {
      return { ok: true, hasHandItem: true, grip: gripKey };
    }
  }

  loClearHandItemSlots();
  return {
    ok: !opts.requireHandItem,
    hasHandItem: false,
    code: 'hand_skin_unavailable',
    reason: 'No valid Hand + Item combo for this skin (matching hand and item required).'
  };
}

/** Validate hand/item pairing rules on trait IDs map. */
function loValidateHandItemTraits(traits) {
  if (!traits) return { ok: true, hasHandItem: false };
  var hasHand = !!traits.hand;
  var hasBall = !!traits.ball;
  var hasHand2 = !!traits.hand2;
  var hasBall2 = !!traits.ball2;
  if (hasHand !== hasBall) return { ok: false, code: 'hand_item_mismatch', reason: 'Hand1 and Item1 must appear together or not at all.' };
  if (hasHand2 !== hasBall2) return { ok: false, code: 'hand_item_mismatch', reason: 'Hand2 and Item2 must appear together or not at all.' };
  var active = (hasHand && hasBall ? 1 : 0) + (hasHand2 && hasBall2 ? 1 : 0);
  if (active > 1) return { ok: false, code: 'multiple_hand_groups', reason: 'Only one hand/item grip style allowed per NFT.' };
  return { ok: true, hasHandItem: active === 1 };
}
window.loValidateHandItemTraits = loValidateHandItemTraits;

function loEnforceHandItemPairsOnDisplay(changedSlot) {
  var prefix = window.__loGenCollectionOffscreen ? 'off_' : '';
  function path(slot) {
    var el = document.getElementById(prefix + slot);
    return el ? getTraitPathFromDisplayImg(el) : '';
  }
  var h1 = path('hand');
  var i1 = path('ball');
  var h2 = path('hand2');
  var i2 = path('ball2');

  if (!h1 && i1) selectTrait('ball', '', true);
  if (!h2 && i2) selectTrait('ball2', '', true);
  if (!i1 && h1) selectTrait('hand', '', true);
  if (!i2 && h2) selectTrait('hand2', '', true);

  h1 = path('hand'); i1 = path('ball'); h2 = path('hand2'); i2 = path('ball2');
  if (h1 && h2) {
    if (changedSlot === 'hand2' || changedSlot === 'ball2') {
      selectTrait('hand', '', true);
      selectTrait('ball', '', true);
    } else {
      selectTrait('hand2', '', true);
      selectTrait('ball2', '', true);
    }
  }
  if (i1 && i2) {
    if (changedSlot === 'ball2' || changedSlot === 'hand2') {
      selectTrait('ball', '', true);
      selectTrait('hand', '', true);
    } else {
      selectTrait('ball2', '', true);
      selectTrait('hand2', '', true);
    }
  }
}

window.loApplyHandItemCombo = loApplyHandItemCombo;
window.loRollHandItemPresence = loRollHandItemPresence;
window.loEnforceHandItemPairsOnDisplay = loEnforceHandItemPairsOnDisplay;

/** Category appearance rate defaults (probability category appears on an NFT). */
window.LO_CATEGORY_APPEARANCE_DEFAULTS = {
  background: 1,
  skin: 1,
  eyes: 1,
  mouth: 1,
  clothing: 1,
  hair: 0.65,
  hat: 0.35,
  accessories: 0.2,
  goo: 0.15,
  behindback: 0.2,
  backgroundblur: 0.1,
  hoodies: 0.1
};

/** Global rarity targets (% of category appearance pool). */
window.LO_TIER_RARITY_PCTS = {
  Common: 0.65,
  Uncommon: 0.25,
  Rare: 0.08,
  Epic: 0.015,
  Legendary: 0.005,
  Mythic: 0.005,
  Custom: 0.25
};

/** @deprecated Legacy relative weights — use LO_TIER_RARITY_PCTS for quantity calc. */
window.LO_TIER_WEIGHTS = {
  Common: 100,
  Uncommon: 50,
  Rare: 20,
  Epic: 5,
  Legendary: 1,
  Mythic: 1,
  Custom: 25
};

window.LO_DIST_TIER_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Custom'];

/** Slots that share one rarity distribution pool (Hand + Item). */
window.LO_RARITY_DIST_SLOT_GROUPS = {
  handitem: ['hand', 'hand2', 'ball', 'ball2']
};

function loGetTierRarityPct(tier) {
  var t = String(tier || 'Common');
  if (t.charAt(0) === t.charAt(0).toLowerCase()) {
    t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  if (window.LO_TIER_RARITY_PCTS && window.LO_TIER_RARITY_PCTS[t] != null) return window.LO_TIER_RARITY_PCTS[t];
  return window.LO_TIER_RARITY_PCTS ? window.LO_TIER_RARITY_PCTS.Common : 0.65;
}
window.loGetTierRarityPct = loGetTierRarityPct;

function loGetTierWeight(tier) {
  return Math.round(loGetTierRarityPct(tier) * 10000) / 100;
}
window.loGetTierWeight = loGetTierWeight;

function loNormalizeDistTier(tier) {
  var t = String(tier || 'Common');
  if (t.charAt(0) === t.charAt(0).toLowerCase()) {
    t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  if (window.LO_DIST_TIER_ORDER && window.LO_DIST_TIER_ORDER.indexOf(t) >= 0) return t;
  return 'Common';
}
window.loNormalizeDistTier = loNormalizeDistTier;

function loGetDistGroupKey(slot) {
  var groups = window.LO_RARITY_DIST_SLOT_GROUPS || {};
  var keys = Object.keys(groups);
  for (var i = 0; i < keys.length; i++) {
    if (groups[keys[i]].indexOf(slot) >= 0) return keys[i];
  }
  return 'slot:' + slot;
}
window.loGetDistGroupKey = loGetDistGroupKey;

function loGetDistGroupSlots(groupKey) {
  if (String(groupKey).indexOf('slot:') === 0) return [String(groupKey).slice(5)];
  var groups = window.LO_RARITY_DIST_SLOT_GROUPS || {};
  return groups[groupKey] ? groups[groupKey].slice() : [groupKey];
}
window.loGetDistGroupSlots = loGetDistGroupSlots;

function loAllocateByShares(total, items) {
  var out = {};
  total = Math.max(0, Math.round(total || 0));
  if (!items || !items.length || total <= 0) return out;
  var sumShare = items.reduce(function (n, it) { return n + Math.max(0, parseFloat(it.share) || 0); }, 0);
  if (sumShare <= 0) {
    var eq = Math.floor(total / items.length);
    var remEq = total - eq * items.length;
    items.forEach(function (it, idx) { out[it.key] = eq + (idx < remEq ? 1 : 0); });
    return out;
  }
  var rows = items.map(function (it) {
    var exact = (total * (parseFloat(it.share) || 0)) / sumShare;
    var fl = Math.floor(exact);
    return { key: it.key, floor: fl, frac: exact - fl };
  });
  var used = rows.reduce(function (n, r) { return n + r.floor; }, 0);
  var rem = total - used;
  rows.sort(function (a, b) { return b.frac - a.frac; });
  rows.forEach(function (r, idx) { out[r.key] = r.floor + (idx < rem ? 1 : 0); });
  return out;
}
window.loAllocateByShares = loAllocateByShares;

function loSplitEvenly(total, count) {
  total = Math.max(0, Math.round(total || 0));
  count = Math.max(0, parseInt(count, 10) || 0);
  if (!count) return [];
  var base = Math.floor(total / count);
  var rem = total - base * count;
  var out = [];
  for (var i = 0; i < count; i++) out.push(base + (i < rem ? 1 : 0));
  return out;
}
window.loSplitEvenly = loSplitEvenly;

/**
 * Auto quantity calculator:
 * category pool × tier rarity % → split evenly within each tier bucket.
 * Every enabled trait gets at least 1 when minOnePerTrait is true.
 */
function loCalculateAutoExpectedDistribution(entries, slotTarget, opts) {
  opts = opts || {};
  var minOne = opts.minOnePerTrait !== false;
  var autoBalance = opts.autoBalance !== false;
  var respectExact = opts.respectExact === true;
  var tierPcts = opts.tierPcts || window.LO_TIER_RARITY_PCTS || {};
  var tierOrder = window.LO_DIST_TIER_ORDER || ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Custom'];
  var expected = {};
  var active = [];
  slotTarget = Math.max(0, Math.round(slotTarget || 0));

  (entries || []).forEach(function (entry) {
    var id = String(entry.id);
    var mode = String(entry.mode || 'unlimited');
    if (mode === 'never') {
      expected[id] = 0;
      return;
    }
    if (respectExact && mode === 'exact') {
      expected[id] = Math.max(0, parseInt(entry.exactQty, 10) || 0);
      return;
    }
    active.push({
      id: id,
      tier: loNormalizeDistTier(entry.tier || 'Common'),
      maxCap: (mode === 'max' && entry.maxCap != null) ? Math.max(0, parseInt(entry.maxCap, 10) || 0) : null
    });
  });

  if (!active.length) return expected;

  if (minOne && slotTarget > 0 && slotTarget < active.length) {
    var rankedMin = active.slice().sort(function (a, b) {
      return loGetTierRarityPct(b.tier) - loGetTierRarityPct(a.tier);
    });
    rankedMin.forEach(function (it, idx) {
      expected[it.id] = idx < slotTarget ? 1 : 0;
    });
    return expected;
  }

  var byTier = {};
  active.forEach(function (it) {
    if (!byTier[it.tier]) byTier[it.tier] = [];
    byTier[it.tier].push(it);
  });

  var activeTiers = tierOrder.filter(function (t) { return byTier[t] && byTier[t].length; });
  var standardTiers = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  var tierShareItems = standardTiers.map(function (t) {
    return { key: t, share: tierPcts[t] != null ? tierPcts[t] : loGetTierRarityPct(t) };
  });
  if (byTier.Custom && byTier.Custom.length) {
    tierShareItems.push({ key: 'Custom', share: tierPcts.Custom != null ? tierPcts.Custom : loGetTierRarityPct('Custom') });
  }
  var fullTierPools = loAllocateByShares(slotTarget, tierShareItems);

  var totalAssigned = 0;
  activeTiers.forEach(function (tier) {
    var pool = fullTierPools[tier] || 0;
    var traits = byTier[tier];
    var splits = loSplitEvenly(pool, traits.length);
    traits.forEach(function (it, idx) {
      expected[it.id] = splits[idx] || 0;
      totalAssigned += expected[it.id];
    });
  });

  var leftover = slotTarget - totalAssigned;
  if (leftover > 0 && byTier.Common && byTier.Common.length) {
    var extra = loSplitEvenly(leftover, byTier.Common.length);
    byTier.Common.forEach(function (it, idx) {
      expected[it.id] = (expected[it.id] || 0) + (extra[idx] || 0);
      totalAssigned += extra[idx] || 0;
    });
  } else if (leftover > 0) {
    var spread = active.slice().sort(function (a, b) {
      return loGetTierRarityPct(a.tier) - loGetTierRarityPct(b.tier);
    });
    for (var li = 0; li < leftover && spread.length; li++) {
      var pick = spread[li % spread.length];
      expected[pick.id] = (expected[pick.id] || 0) + 1;
      totalAssigned++;
    }
  }

  if (minOne && slotTarget >= active.length) {
    active.forEach(function (it) {
      if ((expected[it.id] || 0) < 1) expected[it.id] = 1;
    });
  }

  active.forEach(function (it) {
    if (it.maxCap != null && expected[it.id] > it.maxCap) expected[it.id] = it.maxCap;
  });

  if (autoBalance && slotTarget > 0 && active.length) {
    var ids = active.map(function (it) { return it.id; });
    var minFloor = (minOne && slotTarget >= active.length) ? 1 : 0;
    function tierOf(id) {
      var it = active.find(function (x) { return x.id === id; });
      return it ? it.tier : 'Common';
    }
    function maxFor(id) {
      var it = active.find(function (x) { return x.id === id; });
      return it && it.maxCap != null ? it.maxCap : null;
    }
    var total = ids.reduce(function (n, id) { return n + (expected[id] || 0); }, 0);
    while (total > slotTarget) {
      var reducible = ids.filter(function (id) { return (expected[id] || 0) > minFloor; }).sort(function (a, b) {
        var ea = expected[a] || 0;
        var eb = expected[b] || 0;
        if (eb !== ea) return eb - ea;
        return loGetTierRarityPct(tierOf(a)) - loGetTierRarityPct(tierOf(b));
      });
      if (!reducible.length) break;
      expected[reducible[0]]--;
      total--;
    }
    // Do not inflate lower tiers when higher-tier buckets are empty — leftover is handled above.
  }

  return expected;
}
window.loCalculateAutoExpectedDistribution = loCalculateAutoExpectedDistribution;

window.LO_ALWAYS_ON_CATEGORIES = ['background', 'skin', 'eyes', 'mouth'];

function loGetCategoryAppearanceConfig() {
  var defaults = window.LO_CATEGORY_APPEARANCE_DEFAULTS || {};
  var rm = null;
  try { rm = JSON.parse(localStorage.getItem('lo_rarity_manager_config_v1') || 'null'); } catch (eRm) { rm = null; }
  if (rm && rm.categoryAppearanceRates && typeof rm.categoryAppearanceRates === 'object') {
    return Object.assign({}, defaults, rm.categoryAppearanceRates);
  }
  var proj = null;
  try { proj = JSON.parse(localStorage.getItem('lo_creator_suite_project_v1') || 'null'); } catch (eP) { proj = null; }
  if (proj && proj.rarityConfig && proj.rarityConfig.categoryAppearanceRates) {
    return Object.assign({}, defaults, proj.rarityConfig.categoryAppearanceRates);
  }
  return Object.assign({}, defaults);
}

function loGetCategoryAppearanceRate(slot) {
  if (window.LO_ALWAYS_ON_CATEGORIES.indexOf(slot) >= 0) return 1;
  if (slot === 'hand' || slot === 'hand2' || slot === 'ball' || slot === 'ball2') {
    return (window.LO_HAND_ITEM_RULES && window.LO_HAND_ITEM_RULES.handItemRate) || 0.40;
  }
  var rates = loGetCategoryAppearanceConfig();
  var rate = rates[slot];
  if (rate == null) return 0;
  return Math.max(0, Math.min(1, parseFloat(rate) || 0));
}

function loHandItemSlotPoolSize(collectionSize, slot) {
  var rules = window.LO_HAND_ITEM_RULES || {};
  var rate = rules.handItemRate != null ? rules.handItemRate : 0.40;
  var grip1 = rules.grip1Rate != null ? rules.grip1Rate : 0.5;
  var base = (collectionSize || 0) * rate;
  if (slot === 'hand' || slot === 'ball') return Math.round(base * grip1);
  if (slot === 'hand2' || slot === 'ball2') return Math.round(base * (1 - grip1));
  return Math.round(base);
}
window.loHandItemSlotPoolSize = loHandItemSlotPoolSize;

function loHairHatPoolSize(collectionSize, slot, rates) {
  rates = rates || loGetCategoryAppearanceConfig();
  var hairRate = rates.hair != null ? parseFloat(rates.hair) : 0.65;
  var hatRate = rates.hat != null ? parseFloat(rates.hat) : 0.35;
  var sum = Math.max(0.0001, hairRate + hatRate);
  var frac = slot === 'hair' ? (hairRate / sum) : (hatRate / sum);
  return Math.round((collectionSize || 0) * frac);
}

function loCategoryPoolSize(collectionSize, slot) {
  if (slot === 'hand' || slot === 'hand2' || slot === 'ball' || slot === 'ball2') {
    return Math.round((collectionSize || 0) * ((window.LO_HAND_ITEM_RULES && window.LO_HAND_ITEM_RULES.handItemRate) || 0.40));
  }
  if (slot === 'hair' || slot === 'hat') {
    return loHairHatPoolSize(collectionSize, slot);
  }
  return Math.round((collectionSize || 0) * loGetCategoryAppearanceRate(slot));
}

function loGetGenRng() {
  var pol = window.__loGenAppearancePolicy;
  if (pol && pol.rng) return pol.rng;
  var hp = window.__loGenHandItemPolicy;
  if (hp && hp.rng) return hp.rng;
  return null;
}

function loRollCategoryPresenceQuota(slot, quota, rng, rates) {
  rates = rates || loGetCategoryAppearanceConfig();
  var batchQty = quota.batchQty;
  var rate = loGetCategoryAppearanceRate(slot);
  if (rates[slot] != null) rate = Math.max(0, Math.min(1, parseFloat(rates[slot]) || 0));
  var wantWith = Math.round(batchQty * rate);
  var stats = (quota.categoryCounts && quota.categoryCounts[slot]) ? quota.categoryCounts[slot] : { with: 0, without: 0 };
  var needWith = wantWith - (stats.with || 0);
  var needWithout = (batchQty - wantWith) - (stats.without || 0);
  if (needWith <= 0) return false;
  if (needWithout <= 0) return true;
  return loRng01(rng) < (needWith / (needWith + needWithout));
}

function loShouldIncludeCategory(slot, opts) {
  opts = opts || {};
  if (window.LO_ALWAYS_ON_CATEGORIES.indexOf(slot) >= 0) return true;
  if (slot === 'hand' || slot === 'hand2' || slot === 'ball' || slot === 'ball2') return false;
  if (slot === 'hair' || slot === 'hat') return false;
  var rng = opts.rng != null ? opts.rng : loGetGenRng();
  if (opts.quota && opts.quota.batchQty && opts.quota.categoryCounts) {
    return loRollCategoryPresenceQuota(slot, opts.quota, rng);
  }
  return loRng01(rng) < loGetCategoryAppearanceRate(slot);
}

function loRollHairOrHeadwear(rng, opts) {
  opts = opts || {};
  var rates = loGetCategoryAppearanceConfig();
  var hairRate = rates.hair != null ? parseFloat(rates.hair) : 0.6;
  var hatRate = rates.hat != null ? parseFloat(rates.hat) : 0.4;
  if (opts.quota && opts.quota.batchQty && opts.quota.headwear) {
    var batchQty = opts.quota.batchQty;
    var wantHair = Math.round(batchQty * (hairRate / Math.max(0.0001, hairRate + hatRate)));
    var stats = opts.quota.headwear;
    var needHair = wantHair - (stats.hair || 0);
    var needHat = (batchQty - wantHair) - (stats.hat || 0);
    if (needHair <= 0) return 'hat';
    if (needHat <= 0) return 'hair';
    return loRng01(rng) < (needHair / (needHair + needHat)) ? 'hair' : 'hat';
  }
  var sum = Math.max(0.0001, hairRate + hatRate);
  return loRng01(rng) < (hairRate / sum) ? 'hair' : 'hat';
}

function loTrackCategoryStatsFromTraits(traits, stats) {
  stats = stats || {};
  ['accessories', 'goo', 'behindback', 'backgroundblur', 'hoodies', 'clothing'].forEach(function (slot) {
    if (!stats[slot]) stats[slot] = { with: 0, without: 0 };
    if (traits && traits[slot]) stats[slot].with++;
    else stats[slot].without++;
  });
  if (!stats.headwear) stats.headwear = { hair: 0, hat: 0 };
  if (traits && traits.hat) stats.headwear.hat++;
  else if (traits && traits.hair) stats.headwear.hair++;
  return stats;
}

window.loGetCategoryAppearanceConfig = loGetCategoryAppearanceConfig;
window.loGetCategoryAppearanceRate = loGetCategoryAppearanceRate;
window.loCategoryPoolSize = loCategoryPoolSize;
window.loShouldIncludeCategory = loShouldIncludeCategory;
window.loRollHairOrHeadwear = loRollHairOrHeadwear;
window.loTrackCategoryStatsFromTraits = loTrackCategoryStatsFromTraits;

function selectTrait(category, filename, skipSkinSync, skipHairHatSync) {
  filename = resolveCreatorTraitPath(filename);
  if (!window.__loGenCollectionOffscreen && window.selectedGender === 'female' &&
      category === 'hair' && !filename &&
      typeof window.__loFemaleEnforceHair === 'function') {
    window.__loFemaleEnforceHair();
    return;
  }
  if (!window.__loGenCollectionOffscreen && filename &&
      (category === 'hair' || category === 'accessories' || category === 'hat')) {
    if (creatorIsBlockedCombo(creatorPathsAfterSelect(category, filename))) {
      return;
    }
  }
  if (!window.__loGenCollectionOffscreen && category === 'hat' && filename) {
    if (creatorHasHoodieSelected() && !creatorHatCompatibleWithHoodie(filename)) return;
    if (!creatorHasHoodieSelected() && creatorHatIsHoodieOnlyBeanie(filename)) return;
  }
  if (!window.__loGenCollectionOffscreen && category === 'hair' && filename && creatorHasHoodieSelected()) {
    return;
  }
  if (!window.__loGenCollectionOffscreen && (category === 'goo' || category === 'accessories') &&
      filename && creatorHasHoodieSelected() && creatorTraitIsHeadphones(filename)) {
    return;
  }
  var id = category;
  if (window.__loGenCollectionOffscreen) {
    id = 'off_' + category;
  }
  var el = document.getElementById(id);
  if (!el) return;
  if (filename) {
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
  }
  if (!skipSkinSync && category === 'skin' && filename) {
    syncHandsToCurrentSkin();
  } else if (!window.__loHandItemComboLock && (category === 'hand' || category === 'hand2' || category === 'ball' || category === 'ball2')) {
    loEnforceHandItemPairsOnDisplay(category);
  }
  if (!window.__loGenCollectionOffscreen) {
    if (!skipHairHatSync) {
      enforceCreatorHairHatMutualExclusion(category, filename);
    } else if (category === 'hair' || category === 'hat') {
      reconcileCreatorHairHatState();
    }
    enforceCreatorClothingHoodieMutualExclusion(category, filename);
    enforceCreatorHoodieHatRules(category, filename);
  }
  if (!window.__loGenCollectionOffscreen) {
    if (category === 'hair' || category === 'hat') {
      if (window.selectedGender === 'female' && typeof window.__loFemaleEnforceHair === 'function' &&
          !window.__loFemaleEnforceLock) {
        window.__loFemaleEnforceHair();
      } else if (!window.__loFemaleEnforceLock) {
        applyCreatorCompatLayers();
      }
    } else if (category === 'accessories') {
      applyCreatorCompatLayers();
    } else if (category === 'clothing' || category === 'hoodies') {
      ensureCreatorHoodieLayer();
      enforceCreatorHoodieHatRules(category, filename);
      ensureCreatorHandsOnTop();
    } else if (category === 'hat') {
      ensureCreatorHoodieLayer();
      ensureCreatorHandsOnTop();
    } else if (category === 'goo' || category === 'mouth') {
      ensureCreatorTopLayers();
    } else {
      ensureCreatorHandsOnTop();
    }
    if (typeof updateOnCharacterList === 'function') {
      updateOnCharacterList();
    }
  }
}

function showCategory(categoryId) {
  document.querySelectorAll('.trait-category').forEach(function (c) { c.classList.remove('active'); });
  var el = document.getElementById(categoryId);
  if (el) el.classList.add('active');
  document.getElementById('traitPictures').style.display = 'flex';
  document.querySelectorAll('.category-button[data-category-id]').forEach(function (btn) {
    btn.classList.toggle('active-tab', btn.getAttribute('data-category-id') === categoryId);
  });
}

/* =========================
   TRAIT CULLING (selected = in randomizer)
   ========================= */

var categoryDisplayNames = {
  backgroundCategory: 'Backgrounds',
  backgroundblurCategory: 'Background Blur',
  skinCategory: 'Skin Tone',
  eyesCategory: 'Eyes',
  mouthCategory: 'Mouth',
  hairCategory: 'Hairstyles',
  clothingCategory: 'Clothing',
  accessoriesCategory: 'Sunglasses',
  behindbackCategory: 'Behind Back',
  hatCategory: 'Headwear',
  hoodiesCategory: 'Hoodies',
  gooCategory: 'Above Head',
  handCategory: 'Hand Gestures 1',
  hand2Category: 'Hand Gestures 2',
  ballCategory: 'Balls 1',
  ball2Category: 'Balls 2'
};

var slotToDisplayName = {
  background: 'Background',
  backgroundblur: 'Bg Blur',
  behindback: 'Behind Back',
  skin: 'Skin',
  eyes: 'Eyes',
  clothing: 'Clothing',
  mouth: 'Mouth',
  hair: 'Hair',
  accessories: 'Glasses',
  hat: 'Headwear',
  hoodies: 'Hoodies',
  goo: 'Accessories',
  ball: 'Balls 1',
  hand: 'Hand 1',
  ball2: 'Balls 2',
  hand2: 'Hand 2'
};

function loFormatTraitLabel(path) {
  if (!path) return '';
  if (window.LOTraitRegistry) {
    var t = LOTraitRegistry.getTraitByPath(path);
    if (t && t.traitName) return t.traitName;
    return LOTraitRegistry.formatTraitDisplayName(path);
  }
  var file = path.split('/').pop() || path;
  return file.replace(/\.(png|PNG)$/i, '').replace(/_/g, ' ');
}

var slotToCategoryId = {};
Object.keys(categoryIdToSlot).forEach(function (catId) {
  slotToCategoryId[categoryIdToSlot[catId]] = catId;
});

function normalizeTraitPath(path) {
  if (!path) return '';
  var s = path.replace(/\\/g, '/');
  var parts = s.split('/').filter(function (p) { return p; });
  if (parts.length >= 2) return (parts[parts.length - 2] + '/' + parts[parts.length - 1]).toUpperCase();
  if (parts.length === 1) return parts[0].toUpperCase();
  return s.toUpperCase();
}

function findAndHighlightTrait(slot, imagePath) {
  var categoryId = slotToCategoryId[slot];
  if (!categoryId) return;
  showCategory(categoryId);
  var wantPath = normalizeTraitPath(imagePath);
  var wantFile = wantPath.split('/').pop() || wantPath;
  setTimeout(function () {
    var cat = document.getElementById(categoryId);
    if (!cat) return;
    var wraps = cat.querySelectorAll('.trait-thumb-wrap');
    var found = null;
    wraps.forEach(function (wrap) {
      var img = wrap.querySelector('img');
      if (!img || !img.dataset.src) return;
      var traitPath = normalizeTraitPath(img.dataset.src);
      var traitFile = traitPath.split('/').pop() || traitPath;
      var match = (traitPath === wantPath) || (traitPath.endsWith(wantPath)) || (wantPath.endsWith(traitPath)) || (traitFile === wantFile);
      if (match) found = wrap;
    });
    if (found) {
      found.classList.add('highlight-trait');
      found.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () {
        found.classList.remove('highlight-trait');
      }, 9000); // Keep glowing for 9 seconds
    }
  }, 150);
}

function loCleanTraitAssetPath(path) {
  if (!path) return '';
  var p = String(path).trim().split('#')[0].split('?')[0];
  var marker = 'assets/traits/';
  var idx = p.indexOf(marker);
  if (idx >= 0) return p.slice(idx);
  return p;
}

function getTraitPathFromDisplayImg(img) {
  var src = img.getAttribute('src') || img.src || '';
  if (!src || src === window.location.href) return '';
  try {
    var decoded = decodeURIComponent(src);
    var marker = 'assets/traits/';
    var idx = decoded.indexOf(marker);
    if (idx >= 0) return loCleanTraitAssetPath(decoded.slice(idx));
    if (src.indexOf('http') === 0 || src.indexOf('file') === 0) {
      var url = new URL(src);
      var pathParts = url.pathname.split('/').filter(function (p) { return p; });
      if (pathParts.length >= 2) return loCleanTraitAssetPath(pathParts[pathParts.length - 2] + '/' + pathParts[pathParts.length - 1]);
      if (pathParts.length === 1) return loCleanTraitAssetPath(pathParts[0]);
    }
    var slash = decoded.lastIndexOf('/');
    if (slash >= 0) return loCleanTraitAssetPath(decoded.slice(slash + 1));
    return loCleanTraitAssetPath(decoded);
  } catch (err) {
    return loCleanTraitAssetPath(src.split('/').slice(-2).join('/') || src);
  }
}

var displaySlotOrder = ['background', 'backgroundblur', 'behindback', 'skin', 'eyes', 'clothing', 'mouth', 'hair', 'accessories', 'hat', 'hoodies', 'goo', 'ball', 'hand', 'ball2', 'hand2'];

function updateOnCharacterList() {
  var container = document.getElementById('onCharacterListItems');
  if (!container) return;
  if (!document.getElementById('characterDisplay')) return;
  container.innerHTML = '';
  displaySlotOrder.forEach(function (slot) {
    var img = document.getElementById(slot);
    var path = img ? getTraitPathFromDisplayImg(img) : '';
    var label = slotToDisplayName[slot] || slot;
    var displayVal = path ? loFormatTraitLabel(path) : 'None selected';
    var li = document.createElement('li');
    li.dataset.slot = slot;
    li.dataset.path = path || '';
    if (!path) li.classList.add('is-empty');
    li.innerHTML = '<span class="trait-name">' + label + '</span><span class="trait-value">' + displayVal + '</span>';
    li.addEventListener('click', function () {
      if (li.dataset.path) {
        findAndHighlightTrait(slot, li.dataset.path);
      } else {
        var catId = slotToCategoryId[slot];
        if (catId) showCategory(catId);
      }
    });
    container.appendChild(li);
  });
}

function openTraitSelectionNamesModal() {
  updateOnCharacterList();
  var modal = document.getElementById('traitSelectionNamesModal');
  if (!modal) return;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeTraitSelectionNamesModal() {
  var modal = document.getElementById('traitSelectionNamesModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

window.openTraitSelectionNamesModal = openTraitSelectionNamesModal;
window.closeTraitSelectionNamesModal = closeTraitSelectionNamesModal;

function initCharacterCanvasClicks() {
  updateOnCharacterList();
}

function applyStartupDeselectedSlots() {
  loCreatorApplyDefaultTraitSelection();
  if (typeof loRefreshAllCreatorTraitUi === 'function') loRefreshAllCreatorTraitUi();
  if (typeof loSyncCreatorSlotToCollectionBuilder === 'function') {
    loSyncCreatorSlotToCollectionBuilder('hoodies');
    loSyncCreatorSlotToCollectionBuilder('backgroundblur');
  }
  try { selectTrait('backgroundblur', '', true); } catch (eBg) {}
}

function initTraitCulling() {
  if (window.LOTraitRegistry && (!TRAIT_DATA || !Object.keys(TRAIT_DATA).length)) {
    TRAIT_DATA = window.LOTraitRegistry.TRAIT_DATA;
  }

  document.querySelectorAll('.trait-category').forEach(function (catEl) {
    var categoryId = catEl.id;
    var slot = categoryIdToSlot[categoryId];
    if (!slot) return;
    if (!catEl.querySelector('.category-header')) {
      var title = categoryDisplayNames[categoryId] || categoryId;
      var header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = '<span class="category-title">' + title + '</span>' +
        '<span class="category-count"></span>' +
        '<div class="select-all-btns">' +
        '<button type="button" class="btn-select-all">SELECT ALL</button>' +
        '<button type="button" class="btn-deselect-all">DESELECT ALL</button>' +
        '</div>';
      catEl.insertBefore(header, catEl.firstChild);
    }

    var list = TRAIT_DATA[slot] || [];
    catEl.querySelectorAll('.trait-options img').forEach(function (img) {
      var path = img.dataset.src || getTraitPathFromDisplayImg(img) || '';
      var imgSlot = img.dataset.slot || slot;
      var t = (window.LOTraitRegistry && LOTraitRegistry.getTraitByPath(path)) ||
        (TRAIT_DATA[imgSlot] || []).find(function (x) { return x.path === path || x.image === path; }) ||
        list.find(function (x) { return x.path === path || x.image === path; });
      if (t) {
        if (!(slot === 'clothing' && imgSlot === 'hoodies')) {
          img.dataset.slot = slot;
        }
        img.dataset.src = t.path || t.image || path;
        img.dataset.traitName = t.traitName || img.dataset.traitName || '';
        img.title = t.traitName || img.title;
        img.alt = t.traitName || img.alt;
        if (window.LOTraitRegistry && typeof LOTraitRegistry.traitImageUrl === 'function') {
          img.src = LOTraitRegistry.traitImageUrl(t);
        }
      }
      var wrap = img.closest('.trait-thumb-wrap');
      if (wrap) {
        var cb = wrap.querySelector('.trait-checkbox');
        if (cb && t && !cb.dataset.loWired) {
          cb.dataset.loWired = '1';
          cb.addEventListener('change', function () {
            setTraitSelected(img, cb.checked);
            t.selected = cb.checked;
            updateCategoryCounter(categoryId);
            if (typeof loSyncCreatorTraitToCollectionBuilder === 'function') {
              loSyncCreatorTraitToCollectionBuilder(imgSlot, t);
            }
            if (!cb.checked) {
              var live = document.getElementById(imgSlot);
              var livePath = live ? getTraitPathFromDisplayImg(live) : '';
              var traitPath = t.path || t.image || path;
              if (livePath && traitPath && livePath.toLowerCase() === traitPath.toLowerCase()) {
                selectTrait(imgSlot, '', true);
              }
            }
            if (imgSlot === 'hair' || imgSlot === 'accessories' || imgSlot === 'hat') {
              applyCreatorCompatLayers();
            }
          });
        }
      }
    });
  });

  updateAllCategoryCounters();

  if (window.__loTraitPicturesClickAttached) return;
  window.__loTraitPicturesClickAttached = true;
  document.getElementById('traitPictures').addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-select-all');
    if (btn) {
      var cat = e.target.closest('.trait-category');
      if (cat) selectAllCategory(cat.id);
      return;
    }
    btn = e.target.closest('.btn-deselect-all');
    if (btn) {
      var cat = e.target.closest('.trait-category');
      if (cat) deselectAllCategory(cat.id);
      return;
    }
    if (e.target.closest('.trait-checkbox')) return;
    var img = e.target.closest('.trait-options img');
    if (img && img.dataset.slot) {
      var wrap = img.closest('.trait-thumb-wrap');
      if (wrap && wrap.classList.contains('trait-disabled')) return;
      var slot = img.dataset.slot;
      var path = img.dataset.src || '';
      var trait = findTraitInSlotByPath(slot, path) || (slot === 'clothing' ? findTraitInSlotByPath('hoodies', path) : null);
      if (trait && trait.selected === false) return;
      if (slot === 'hat' && path) {
        if (creatorHasHoodieSelected() && !creatorHatCompatibleWithHoodie(path)) return;
        if (!creatorHasHoodieSelected() && creatorHatIsHoodieOnlyBeanie(path)) return;
      }
      if (slot === 'hair' && path && creatorHasHoodieSelected()) return;
      if ((slot === 'goo' || slot === 'accessories') && path &&
          creatorHasHoodieSelected() && creatorTraitIsHeadphones(path)) return;
      if (creatorIsBlockedCombo(creatorPathsAfterSelect(slot, path))) return;
      selectTrait(slot, path);
    }
  });
}

function toggleTrait(img) {
  var selected = img.dataset.selected !== 'true';
  setTraitSelected(img, selected);
  var slot = img.dataset.slot;
  var path = img.dataset.src;
  var t = findTraitInSlotByPath(slot, path);
  if (t) {
    t.selected = selected;
    if (typeof loSyncCreatorTraitToCollectionBuilder === 'function') {
      loSyncCreatorTraitToCollectionBuilder(slot, t);
    }
  }
  var cat = img.closest('.trait-category');
  if (cat) updateCategoryCounter(cat.id);
}

function setTraitSelected(img, selected) {
  img.dataset.selected = selected ? 'true' : 'false';
  if (selected) img.classList.remove('trait-deselected');
  else img.classList.add('trait-deselected');
  var wrap = img.closest('.trait-thumb-wrap');
  if (wrap) {
    var cb = wrap.querySelector('.trait-checkbox');
    if (cb) cb.checked = selected;
  }
}

function updateCategoryCounter(categoryId) {
  var slot = categoryIdToSlot[categoryId];
  if (!slot) return;
  var list = TRAIT_DATA[slot];
  if (!list) return;
  var n = list.filter(function (t) { return t && !t.isRemove && t.selected !== false; }).length;
  var total = list.filter(function (t) { return t && !t.isRemove; }).length;
  var cat = document.getElementById(categoryId);
  if (cat) {
    var span = cat.querySelector('.category-count');
    if (span) span.textContent = '(' + n + ' selected / ' + total + ' total)';
  }
  updateTabCounts();
}

function loCountTraitsInSlot(slot) {
  var list = TRAIT_DATA[slot];
  if ((!list || !list.length) && window.LOTraitRegistry && LOTraitRegistry.TRAIT_DATA) {
    list = LOTraitRegistry.TRAIT_DATA[slot];
  }
  if (!list) return 0;
  return list.filter(function (t) { return t && !t.isRemove; }).length;
}

function updateTabCounts() {
  var container = document.getElementById('traitSelection');
  if (!container) return;
  container.querySelectorAll('.category-button[data-category-id]').forEach(function (btn) {
    var categoryId = btn.getAttribute('data-category-id');
    var label = btn.getAttribute('data-label');
    if (!label) {
      label = (btn.textContent || '').replace(/\s*\(\d+\)\s*$/, '').trim();
    }
    var slot = categoryIdToSlot[categoryId];
    var total = slot ? loCountTraitsInSlot(slot) : 0;
    btn.textContent = label + ' (' + total + ')';
  });
}

function updateAllCategoryCounters() {
  Object.keys(categoryIdToSlot).forEach(updateCategoryCounter);
}

function selectAllCategory(categoryId) {
  var slot = categoryIdToSlot[categoryId];
  if (!slot) return;
  loSyncTraitDataFromRegistry();
  var list = TRAIT_DATA[slot];
  if (!list) return;
  list.forEach(function (t) {
    if (!t || t.isRemove) return;
    t.selected = true;
  });
  loRefreshCreatorTraitUiForSlot(slot);
  updateCategoryCounter(categoryId);
  if (slot === 'hair' || slot === 'accessories' || slot === 'hat') {
    if (window.selectedGender === 'female' && (slot === 'hair' || slot === 'hat') &&
        typeof window.__loFemaleEnforceHair === 'function') {
      window.__loFemaleEnforceHair();
    } else {
      applyCreatorCompatLayers();
    }
  }
  if (typeof loSyncCreatorSlotToCollectionBuilder === 'function') loSyncCreatorSlotToCollectionBuilder(slot);
}

function deselectAllCategory(categoryId) {
  var slot = categoryIdToSlot[categoryId];
  if (!slot) return;
  loSyncTraitDataFromRegistry();
  var list = TRAIT_DATA[slot];
  if (!list) return;
  list.forEach(function (t) {
    if (!t || t.isRemove) return;
    t.selected = false;
  });
  loRefreshCreatorTraitUiForSlot(slot);
  if (slot === 'hair' || slot === 'accessories' || slot === 'hat' || slot === 'backgroundblur') {
    selectTrait(slot, '', true);
    applyCreatorCompatLayers();
  }
  updateCategoryCounter(categoryId);
  if (typeof loSyncCreatorSlotToCollectionBuilder === 'function') loSyncCreatorSlotToCollectionBuilder(slot);
}

function loSyncTraitDataFromRegistry() {
  if (window.LOTraitRegistry && window.LOTraitRegistry.TRAIT_DATA) {
    TRAIT_DATA = window.LOTraitRegistry.TRAIT_DATA;
  }
}

function getSelectedTraits(slot) {
  loSyncTraitDataFromRegistry();
  var list = TRAIT_DATA[slot];
  if (!list || !list.length) return [];
  return list.filter(function (t) {
    return t && !t.isRemove && t.selected !== false;
  });
}

function findTraitInSlotByPath(slot, path) {
  if (!path || !TRAIT_DATA[slot]) return null;
  var norm = path.toLowerCase();
  return TRAIT_DATA[slot].find(function (t) {
    if (!t) return false;
    var p = (t.path || t.image || '').toLowerCase();
    return p === norm;
  }) || null;
}

function pickRandomIndex(n) {
  if (n <= 0) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    var buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

function pickRandomFrom(list) {
  if (!list || list.length === 0) return null;
  return list[pickRandomIndex(list.length)];
}

function loTraitPath(trait) {
  if (!trait) return '';
  return trait.image || trait.path || '';
}

var LO_RANDOM_BG_BLUR_FILES = { '1.png': true, '2.png': true };

function isRandomizableBgBlurTrait(trait) {
  if (!trait || trait.isRemove) return false;
  var file = (trait.file || trait.filename || '').toLowerCase();
  if (LO_RANDOM_BG_BLUR_FILES[file]) return true;
  var path = (trait.path || trait.image || '').toLowerCase();
  return /\/bg blur\/(1|2)\.png$/i.test(path);
}

function getRandomizableBgBlurTraits(list) {
  return (list || []).filter(isRandomizableBgBlurTrait);
}

function getRandomIndex(max) {
  return Math.floor(Math.random() * max) + 1;
}
function getImagePath(folder, index) {
  return String(folder) + '/' + String(index) + '.PNG';
}

function pickRandomTraitFromList(list) {
  if (!list || !list.length) return null;
  if (window.__loGenCollectionOffscreen && typeof window.__loTraitPickFn === 'function') {
    var weighted = window.__loTraitPickFn(list);
    if (weighted) return weighted;
  }
  return pickRandomFrom(list);
}

function randomizeCharacter() {
  function runRandomize() {
    loSyncTraitDataFromRegistry();
    if (!TRAIT_DATA || !Object.keys(TRAIT_DATA).length) {
      console.warn('[Randomize] trait data not ready');
      return;
    }

  // ---- BASE TRAITS (only from selected) ---- //
  var bgList = getSelectedTraits('background');
  if (bgList.length) selectTrait('background', loTraitPath(pickRandomTraitFromList(bgList)));
  else selectTrait('background', '');

  selectTrait('backgroundblur', '');

  var skinList = getSelectedTraits('skin');
  var skinTrait = null;
  if (skinList && skinList.length) {
    if (window.__loGenCollectionOffscreen && typeof window.__loTraitPickFn === 'function') {
      skinTrait = window.__loTraitPickFn(skinList);
    } else if (window.__loGenCollectionOffscreen && typeof window.__loSkinPickFn === 'function') {
      skinTrait = window.__loSkinPickFn(skinList);
    }
    if (!skinTrait) skinTrait = pickRandomTraitFromList(skinList);
  }
  var skinIndex = 0;
  if (skinTrait && loUsesLegacyNumericTraits()) {
    skinIndex = parseInt((loTraitPath(skinTrait).match(/(\d+)/) || [0, 0])[1], 10) || 0;
  }
  if (skinTrait) selectTrait('skin', loTraitPath(skinTrait), true);
  else selectTrait('skin', '', true);

  var eyesList = getSelectedTraits('eyes');
  if (eyesList.length) selectTrait('eyes', loTraitPath(pickRandomTraitFromList(eyesList)));
  else selectTrait('eyes', '');

  var mouthList = getSelectedTraits('mouth');
  if (mouthList.length) selectTrait('mouth', loTraitPath(pickRandomTraitFromList(mouthList)));
  else selectTrait('mouth', '');

  var appearOpts = {
    rng: loGetGenRng(),
    quota: (window.__loGenAppearancePolicy && window.__loGenAppearancePolicy.quota) ? window.__loGenAppearancePolicy.quota : null
  };

  // ---- CLOTHING / HOODIE (mutually exclusive; hoodie renders above headwear) ---- //
  selectTrait('clothing', '');
  selectTrait('hoodies', '');
  var clothingList = getSelectedTraits('clothing');
  var hoodiesList = getSelectedTraits('hoodies');
  if (loShouldIncludeCategory('hoodies', appearOpts) && hoodiesList.length) {
    selectTrait('hoodies', loTraitPath(pickRandomTraitFromList(hoodiesList)), true, true);
  } else if (loShouldIncludeCategory('clothing', appearOpts) && clothingList.length) {
    selectTrait('clothing', loTraitPath(pickRandomTraitFromList(clothingList)), true, true);
  }

  // ---- HAIR / HEADWEAR (65% hair / 35% headwear; mutually exclusive slot) ---- //
  var hairList = getSelectedTraits('hair');
  var hatList = getSelectedTraits('hat');
  var hasHoodie = creatorHasHoodieSelected();
  hatList = filterCreatorHatsForHoodieState(hatList, hasHoodie);
  var mulletHairList = creatorFilterMulletHairList(hairList);
  selectTrait('hair', '', true, true);
  selectTrait('hat', '', true, true);

  if (hasHoodie) {
    // Hoodies never pair with hair — only optional compatible hats (under the hoodie).
    if (hatList.length > 0) {
      selectTrait('hat', loTraitPath(pickRandomTraitFromList(hatList)), true, true);
    }
  } else {
  var headChoice = loRollHairOrHeadwear(appearOpts.rng, appearOpts);

  if (window.selectedGender !== 'female') {
    if (headChoice === 'hair' && hairList.length > 0) {
      selectTrait('hair', loTraitPath(pickRandomTraitFromList(hairList)), true, true);
    } else if (headChoice === 'hat' && hatList.length > 0) {
      selectTrait('hat', loTraitPath(pickRandomTraitFromList(hatList)), true, true);
      if (mulletHairList.length > 0 && creatorRollHatMulletHairPair()) {
        selectTrait('hair', loTraitPath(pickRandomTraitFromList(mulletHairList)), true, true);
      }
    } else if (hairList.length > 0) {
      selectTrait('hair', loTraitPath(pickRandomTraitFromList(hairList)), true, true);
    } else if (hatList.length > 0) {
      selectTrait('hat', loTraitPath(pickRandomTraitFromList(hatList)), true, true);
    }
  } else {
    var allHair = TRAIT_DATA.hair || hairList;
    var femaleHatHairList = creatorFilterFemaleHatHairList(allHair);
    var femaleNoHatHairList = creatorFilterFemaleNoHatHairList(allHair);
    if (headChoice === 'hat' && hatList.length > 0) {
      selectTrait('hat', loTraitPath(pickRandomTraitFromList(hatList)), true, true);
      if (femaleHatHairList.length > 0) {
        selectTrait('hair', loTraitPath(pickRandomTraitFromList(femaleHatHairList)), true, true);
      }
    } else if (femaleNoHatHairList.length > 0) {
      selectTrait('hair', loTraitPath(pickRandomTraitFromList(femaleNoHatHairList)), true, true);
    } else if (hairList.length > 0) {
      selectTrait('hair', loTraitPath(pickRandomTraitFromList(hairList)), true, true);
    } else if (hatList.length > 0) {
      selectTrait('hat', loTraitPath(pickRandomTraitFromList(hatList)), true, true);
    }
    if (typeof window.__loFemaleEnforceHair === 'function') window.__loFemaleEnforceHair();
  }
  }
  reconcileCreatorHairHatState();

  // ---- OPTIONAL TRAITS (category appearance rate, then rarity within category) ---- //
  var accList = getSelectedTraits('accessories');
  var randHairPath = creatorGetSlotPath('hair');
  var randHatPath = creatorGetSlotPath('hat');
  var randHasHoodie = creatorHasHoodieSelected();
  if (randHasHoodie) {
    accList = accList.filter(function (t) { return !creatorTraitIsHeadphones(loTraitPath(t)); });
  }
  selectTrait('accessories', '');
  if (loShouldIncludeCategory('accessories', appearOpts) && accList.length) {
    var pickedGlasses = creatorPickRandomGlasses(accList, randHairPath, randHatPath);
    if (pickedGlasses) selectTrait('accessories', loTraitPath(pickedGlasses));
  }
  var behindList = getSelectedTraits('behindback');
  selectTrait('behindback', '');
  if (loShouldIncludeCategory('behindback', appearOpts) && behindList.length) {
    selectTrait('behindback', loTraitPath(pickRandomTraitFromList(behindList)));
  }
  var gooList = getSelectedTraits('goo');
  if (randHasHoodie) {
    gooList = gooList.filter(function (t) { return !creatorTraitIsHeadphones(loTraitPath(t)); });
  }
  selectTrait('goo', '');
  if (loShouldIncludeCategory('goo', appearOpts) && gooList.length) {
    selectTrait('goo', loTraitPath(pickRandomTraitFromList(gooList)));
  }
  var bgBlurList = getRandomizableBgBlurTraits(getSelectedTraits('backgroundblur'));
  if (loShouldIncludeCategory('backgroundblur', appearOpts) && bgBlurList.length) {
    selectTrait('backgroundblur', loTraitPath(pickRandomTraitFromList(bgBlurList)));
  }

  // ---- HAND + ITEM (60% none, 40% paired: Hand1+Item1 OR Hand2+Item2) ---- //
  var handPolicy = window.__loGenHandItemPolicy || null;
  var handComboOpts = {
    rng: handPolicy && handPolicy.rng ? handPolicy.rng : null,
    wantHandItem: handPolicy && typeof handPolicy.wantHandItem === 'boolean' ? handPolicy.wantHandItem : undefined,
    requireHandItem: !!(handPolicy && handPolicy.requireHandItem),
    gripStyle: handPolicy && handPolicy.gripStyle ? handPolicy.gripStyle : undefined,
    quota: handPolicy && handPolicy.quota ? handPolicy.quota : undefined,
    gripStats: handPolicy && handPolicy.gripStats ? handPolicy.gripStats : undefined
  };
  loApplyHandItemCombo(skinTrait, skinIndex, handComboOpts);

  if (typeof updateOnCharacterList === 'function') updateOnCharacterList();
  applyCreatorCompatLayers();
  }

  if (!window.__loTraitsReady) {
    return (window.__loBootstrapPromise || loBootstrapApp()).then(runRandomize);
  }
  runRandomize();
}

// Safari inline onclick handlers resolve globals via window.*
window.showCategory = showCategory;
window.selectTrait = selectTrait;
window.randomizeCharacter = randomizeCharacter;
window.startNewBlankCharacter = startNewBlankCharacter;
window.exportSelectionState = exportSelectionState;
window.importSelectionState = importSelectionState;

(function initRandomizeButton() {
  function attach() {
    var btn = document.getElementById('randomButton');
    if (!btn || btn.dataset.loRandomWired) return;
    btn.dataset.loRandomWired = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      randomizeCharacter();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();

function exportSelectionState() {
  var exportData = {};

  Object.keys(TRAIT_DATA).forEach(function (slot) {
    exportData[slot] = TRAIT_DATA[slot].map(function (trait) {
      return {
        image: trait.image || trait.path,
        traitName: trait.traitName || loFormatTraitLabel(trait.image || ''),
        selected: !!trait.selected
      };
    });
  });

  var dataStr = JSON.stringify(exportData, null, 2);
  var blob = new Blob([dataStr], { type: "application/json" });
  var url = URL.createObjectURL(blob);

  var a = document.createElement("a");
  a.href = url;
  a.download = "LO-trait-selection.json";
  a.click();

  URL.revokeObjectURL(url);
}

function importSelectionState(file) {
  var reader = new FileReader();

  reader.onload = function (e) {
    try {
      var importedData = JSON.parse(e.target.result);
      loSyncTraitDataFromRegistry();

      // Collection Setup format (excludedTraitIdsBySlot)
      if (importedData.excludedTraitIdsBySlot && typeof importedData.excludedTraitIdsBySlot === 'object') {
        var cfgCb = loLoadCollectionBuilderConfigRaw() || {
          schemaVersion: 1,
          collectionName: 'Collection 1',
          targetSupply: 5555,
          excludedTraitIdsBySlot: {}
        };
        cfgCb.excludedTraitIdsBySlot = importedData.excludedTraitIdsBySlot;
        if (importedData.targetSupply) cfgCb.targetSupply = importedData.targetSupply;
        if (importedData.collectionName) cfgCb.collectionName = importedData.collectionName;
        cfgCb.lastSyncedAt = new Date().toISOString();
        if (typeof window.__loCbSaveConfigQuiet === 'function') {
          window.__loCbSaveConfigQuiet(cfgCb, 'import_collection_setup', { applyToCreator: true });
        } else {
          try { localStorage.setItem('lo_collection_builder_config_v1', JSON.stringify(cfgCb)); } catch (eLs) {}
          if (typeof loApplyCollectionExclusionsToCreator === 'function') loApplyCollectionExclusionsToCreator(cfgCb);
        }
        if (typeof alert === 'function') alert('Collection setup loaded successfully.');
        return;
      }

      function findLocalTrait(slot, importedTrait) {
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

      var matched = 0;
      Object.keys(importedData).forEach(function (slot) {
        if (!TRAIT_DATA[slot] || !Array.isArray(importedData[slot])) return;
        importedData[slot].forEach(function (importedTrait) {
          var localTrait = findLocalTrait(slot, importedTrait);
          if (localTrait) {
            localTrait.selected = !!importedTrait.selected;
            matched++;
          }
        });
      });

      if (!matched) {
        if (typeof alert === 'function') alert('No matching traits found in this file. Check that paths match the current trait library.');
        return;
      }

      if (typeof loSyncCreatorSelectionToCollectionBuilder === 'function') {
        loSyncCreatorSelectionToCollectionBuilder({ reason: 'import_trait_selection' });
      }
      if (typeof loRefreshAllCreatorTraitUi === 'function') loRefreshAllCreatorTraitUi();
      else refreshTraitUI();
      if (typeof alert === 'function') alert('Selection loaded successfully (' + matched + ' traits matched).');

    } catch (err) {
      if (typeof alert === 'function') alert('Invalid selection file.');
      console.error(err);
    }
  };

  reader.readAsText(file);
}

function refreshTraitUI() {
  Object.keys(TRAIT_DATA).forEach(function (slot) {
    TRAIT_DATA[slot].forEach(function (trait) {
      // Find image by matching data-src attribute
      var images = document.querySelectorAll('img[data-src]');
      for (var i = 0; i < images.length; i++) {
        var img = images[i];
        if (img.dataset.src === trait.image || img.dataset.src === trait.path ||
            (trait.path && img.dataset.src && img.dataset.src.toLowerCase() === trait.path.toLowerCase())) {
          setTraitSelected(img, trait.selected);
          break;
        }
      }
    });
  });
  updateAllCategoryCounters();
}

/* Build closing tags without literal "</tag>" in source — browsers treat that as end of <script>. */
function loHtmlEndTag(tag) {
  return '<' + '/' + tag + '>';
}

function exportTraitList() {
  var slotOrder = ['background', 'backgroundblur', 'skin', 'eyes', 'mouth', 'hair', 'clothing', 'accessories', 'behindback', 'hat', 'hoodies', 'goo', 'hand', 'hand2', 'ball', 'ball2'];
  var dateStr = new Date().toLocaleDateString(undefined, { dateStyle: 'medium' });
  
  // Collect all selected traits by category
  var categories = [];
  slotOrder.forEach(function (slot) {
    var list = TRAIT_DATA[slot];
    if (!list) return;
    var selected = list.filter(function (t) { return t.selected; });
    if (selected.length === 0) return;
    var categoryName = slotToDisplayName[slot] || slot;
    var filenames = selected.map(function (t) {
      return t.traitName || loFormatTraitLabel(t.image || t.path || '') || t.name;
    });
    categories.push({ name: categoryName, count: selected.length, items: filenames });
  });
  
  if (categories.length === 0) {
    if (typeof alert === 'function') alert('NO TRAITS SELECTED — CHECK SOME BOXES AND TRY AGAIN!');
    return;
  }
  
  // Generate HTML
  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '<title>Little Ollie - Selected Traits</title>\n';
  html += '<link href="https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap" rel="stylesheet">\n';
  html += '<style>\n';
  html += '* { margin: 0; padding: 0; box-sizing: border-box; }\n';
  html += 'body { font-family: \'Fredoka One\', cursive; background: linear-gradient(to right, #89f7fe, #66a6ff); min-height: 100vh; padding: 20px; color: #333; }\n';
  html += '.container { max-width: 1200px; margin: 0 auto; background: rgba(255,255,255,0.95); border-radius: 20px; padding: 30px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }\n';
  html += '.header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #66a6ff; }\n';
  html += '.header-logos { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 15px; flex-wrap: wrap; }\n';
  html += '.header-logos img { height: 120px; width: auto; object-fit: contain; }\n';
  html += '.header h1 { font-size: 32px; color: #66a6ff; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); margin-bottom: 10px; text-transform: uppercase; }\n';
  html += '.header .subtitle { font-size: 18px; color: #555; margin-bottom: 10px; }\n';
  html += '.header .date { font-size: 14px; color: #888; }\n';
  html += '.traits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin-top: 30px; }\n';
  html += '@media (max-width: 900px) { .traits-grid { grid-template-columns: repeat(2, 1fr); } }\n';
  html += '@media (max-width: 600px) { .traits-grid { grid-template-columns: 1fr; } }\n';
  html += '.category { background: linear-gradient(to bottom, #89f7fe, #66a6ff); border-radius: 15px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }\n';
  html += '.category-title { font-size: 20px; color: #fff; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); margin-bottom: 12px; text-transform: uppercase; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 8px; }\n';
  html += '.category-count { font-size: 12px; color: rgba(255,255,255,0.9); margin-bottom: 15px; display: block; }\n';
  html += '.items-list { display: flex; flex-wrap: wrap; gap: 8px; }\n';
  html += '.item { background: rgba(255,255,255,0.95); padding: 6px 12px; border-radius: 8px; font-size: 11px; color: #333; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; }\n';
  html += loHtmlEndTag('style') + '\n' + loHtmlEndTag('head') + '\n<body>\n';
  html += '<div class="container">\n';
  html += '<div class="header">\n';
  html += '<div class="header-logos">\n';
  html += '<img src="websitelogo3.png" alt="Little Ollie Logo" onerror="this.style.display=\'none\'">\n';
  html += '<img src="LO.png" alt="LO" onerror="this.style.display=\'none\'">\n';
  html += '</div>\n';
  html += '<h1>🎨 LITTLE OLLIE 🎨</h1>\n';
  html += '<div class="subtitle">CHARACTER CREATOR</div>\n';
  html += '<div class="subtitle">MY SELECTED TRAITS LIST</div>\n';
  html += '<div class="date">(THESE ARE IN MY RANDOMIZER)</div>\n';
  html += '<div class="date">SAVED ON: ' + dateStr + '</div>\n';
  html += '</div>\n';
  html += '<div class="traits-grid">\n';
  
  categories.forEach(function (cat) {
    html += '<div class="category">\n';
    html += '<div class="category-title">' + cat.name + '</div>\n';
    html += '<span class="category-count">(' + cat.count + ' SELECTED)</span>\n';
    html += '<div class="items-list">\n';
    cat.items.forEach(function (item) {
      html += '<span class="item">' + item + '</span>\n';
    });
    html += '</div>\n';
    html += '</div>\n';
  });
  
  html += '</div>\n';
  html += '</div>\n';
  html += loHtmlEndTag('body') + '\n' + loHtmlEndTag('html');
  
  // Create a temporary container to render the HTML
  var tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '1200px';
  tempDiv.innerHTML = html;
  document.body.appendChild(tempDiv);
  
  // Wait for images to load, then generate PDF
  var images = tempDiv.querySelectorAll('img');
  var imagesToLoad = images.length;
  var imagesLoaded = 0;
  var pdfGenerated = false;
  
  // Timeout fallback (5 seconds)
  var timeout = setTimeout(function() {
    if (!pdfGenerated) {
      pdfGenerated = true;
      generatePDF();
    }
  }, 5000);
  
  function checkAndGenerate() {
    if (!pdfGenerated && imagesLoaded === imagesToLoad) {
      pdfGenerated = true;
      clearTimeout(timeout);
      generatePDF();
    }
  }
  
  if (imagesToLoad === 0) {
    generatePDF();
  } else {
    images.forEach(function(img) {
      if (img.complete) {
        imagesLoaded++;
        checkAndGenerate();
      } else {
        img.onload = function() {
          imagesLoaded++;
          checkAndGenerate();
        };
        img.onerror = function() {
          imagesLoaded++;
          checkAndGenerate();
        };
      }
    });
  }
  
  function generatePDF() {
    if (typeof html2pdf === 'undefined') {
      // Fallback to HTML if PDF library not loaded
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.download = 'little-ollie-selected-traits.html';
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      document.body.removeChild(tempDiv);
      return;
    }
    
    var element = tempDiv.querySelector('.container');
    var opt = {
      margin: 0.5,
      filename: 'little-ollie-selected-traits.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save().then(function() {
      if (tempDiv && tempDiv.parentNode) {
        document.body.removeChild(tempDiv);
      }
    }).catch(function(err) {
      console.error('PDF generation error:', err);
      // Fallback to HTML
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.download = 'little-ollie-selected-traits.html';
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (tempDiv && tempDiv.parentNode) {
        document.body.removeChild(tempDiv);
      }
    });
  }
}

document.getElementById('exportTraitListBtn').addEventListener('click', exportTraitList);

var SAVES_KEY = 'littleOllieSaves';
var OLD_SAVE_KEY = 'littleOllieSaved';

function getAllSaves() {
  try {
    var raw = localStorage.getItem(SAVES_KEY);
    var saves = raw ? JSON.parse(raw) : {};
    var oldRaw = localStorage.getItem(OLD_SAVE_KEY);
    if (oldRaw && Object.keys(saves).length === 0) {
      try {
        saves['Previous save'] = JSON.parse(oldRaw);
        localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
        localStorage.removeItem(OLD_SAVE_KEY);
      } catch (e) {}
    }
    return saves;
  } catch (e) {
    return {};
  }
}

function saveCharacterToStorage() {
  var name = typeof prompt === 'function' ? prompt('Name this save:', '') : '';
  if (name == null) return;
  name = (name || '').trim();
  if (!name) name = 'Unnamed ' + new Date().toLocaleDateString();
  var character = {};
  displaySlotOrder.forEach(function (slot) {
    var img = document.getElementById(slot);
    var path = img ? getTraitPathFromDisplayImg(img) : '';
    character[slot] = path || '';
  });
  var selections = {};
  Object.keys(TRAIT_DATA).forEach(function (slot) {
    var list = TRAIT_DATA[slot];
    if (!list) return;
    selections[slot] = list.filter(function (t) { return t.selected; }).map(function (t) { return t.image; });
  });
  try {
    var saves = getAllSaves();
    saves[name] = { character: character, selections: selections };
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    if (typeof alert === 'function') alert('Saved as "' + name + '". Load it anytime from Load.');
  } catch (e) {
    if (typeof alert === 'function') alert('Could not save: ' + e.message);
  }
}

function applyLoadedData(data) {
  var character = data.character || {};
  displaySlotOrder.forEach(function (slot) {
    selectTrait(slot, character[slot] || '');
  });
  var selections = data.selections || {};
  Object.keys(TRAIT_DATA).forEach(function (slot) {
    var selectedPaths = selections[slot];
    if (!Array.isArray(selectedPaths)) return;
    var list = TRAIT_DATA[slot];
    if (!list) return;
    list.forEach(function (t) {
      var p = t.image || t.path;
      t.selected = selectedPaths.indexOf(p) !== -1 || selectedPaths.indexOf(t.path) !== -1;
    });
    var catId = slotToCategoryId[slot];
    if (!catId) return;
    var cat = document.getElementById(catId);
    if (cat) {
      cat.querySelectorAll('.trait-thumb-wrap').forEach(function (wrap) {
        var img = wrap.querySelector('img');
        if (!img || !img.dataset.src) return;
        var sel = selectedPaths.indexOf(img.dataset.src) !== -1;
        if (!sel && window.LOTraitRegistry) {
          var tr = LOTraitRegistry.getTraitByPath(img.dataset.src);
          sel = selectedPaths.some(function (p) {
            return tr && (p === tr.path || p === tr.image);
          });
        }
        setTraitSelected(img, sel);
        var cb = wrap.querySelector('.trait-checkbox');
        if (cb) cb.checked = sel;
      });
    }
  });
  updateAllCategoryCounters();
  updateTabCounts();
  if (typeof updateOnCharacterList === 'function') updateOnCharacterList();
}

function loadCharacterFromStorage() {
  var saves = getAllSaves();
  var names = Object.keys(saves);
  if (names.length === 0) {
    if (typeof alert === 'function') alert('No saved characters. Save one first!');
    return;
  }
  var modal = document.getElementById('loadModal');
  var select = document.getElementById('loadModalSelect');
  if (!modal || !select) return;
  select.innerHTML = '';
  names.forEach(function (n) {
    var opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    select.appendChild(opt);
  });
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeLoadModal() {
  var modal = document.getElementById('loadModal');
  if (modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function doLoadSelected() {
  var select = document.getElementById('loadModalSelect');
  var saves = getAllSaves();
  var name = select && select.value;
  if (!name || !saves[name]) return;
  try {
    applyLoadedData(saves[name]);
    closeLoadModal();
    if (typeof alert === 'function') alert('Loaded "' + name + '"!');
  } catch (e) {
    if (typeof alert === 'function') alert('Could not load: ' + e.message);
  }
}

document.getElementById('loadModalCancel').addEventListener('click', closeLoadModal);
document.getElementById('loadModalLoad').addEventListener('click', doLoadSelected);
document.getElementById('loadModal').addEventListener('click', function (e) {
  if (e.target === this) closeLoadModal();
});

function newCharacter() {
  displaySlotOrder.forEach(function (slot) {
    selectTrait(slot, '');
  });
  Object.keys(TRAIT_DATA).forEach(function (slot) {
    var list = TRAIT_DATA[slot];
    if (!list) return;
    list.forEach(function (t) { t.selected = true; });
    var catId = slotToCategoryId[slot];
    if (!catId) return;
    var cat = document.getElementById(catId);
    if (cat) {
      cat.querySelectorAll('.trait-thumb-wrap').forEach(function (wrap) {
        var img = wrap.querySelector('img');
        if (img) setTraitSelected(img, true);
        var cb = wrap.querySelector('.trait-checkbox');
        if (cb) cb.checked = true;
      });
    }
  });
  updateAllCategoryCounters();
  updateTabCounts();
  if (typeof updateOnCharacterList === 'function') updateOnCharacterList();
  if (typeof alert === 'function') alert('New character started. All traits are selected for randomizer.');
}

function startNewBlankCharacter() {
  displaySlotOrder.forEach(function (slot) {
    selectTrait(slot, '');
  });
  if (typeof updateOnCharacterList === 'function') updateOnCharacterList();
}

document.getElementById('saveCharacterBtn').addEventListener('click', saveCharacterToStorage);
document.getElementById('loadCharacterBtn').addEventListener('click', loadCharacterFromStorage);
document.getElementById('newCharacterBtn').addEventListener('click', newCharacter);

function preloadAllImages() {
  var preloaderBar = document.getElementById('preloaderBar');
  var preloaderText = document.getElementById('preloaderText');
  if (!preloaderBar || !preloaderText) return;
  
  setTimeout(function() {
    // Collect all unique image paths from TRAIT_DATA
    var allImages = new Set();
    Object.keys(TRAIT_DATA).forEach(function (slot) {
      var list = TRAIT_DATA[slot];
      if (!list) return;
      list.forEach(function (t) {
        if (t && t.image) allImages.add(t.image);
      });
    });
    
    var allArr = Array.from(allImages);
    var totalAll = allArr.length;
    var preloadCap = 48;
    var imageArray = allArr.slice(0, preloadCap);
    var total = imageArray.length;
    var loaded = 0;
    var failed = 0;
    
    if (totalAll === 0) return;
    
    function updateProgress() {
      var percent = Math.floor(((loaded + failed) / total) * 100);
      preloaderBar.style.width = percent + '%';
      
      if (loaded + failed >= total) {
        preloaderBar.style.width = '100%';
      }
    }
    
    var batchSize = 8;
    var currentBatch = 0;
    
    function loadBatch() {
      var start = currentBatch * batchSize;
      var end = Math.min(start + batchSize, total);
      
      for (var i = start; i < end; i++) {
        var img = new Image();
        img.onload = function () {
          loaded++;
          updateProgress();
        };
        img.onerror = function () {
          failed++;
          updateProgress();
        };
        img.src = (window.LOTraitRegistry && typeof LOTraitRegistry.traitImageUrl === 'function')
          ? LOTraitRegistry.traitImageUrl(imageArray[i])
          : imageArray[i];
      }
      
      currentBatch++;
      if (end < total) {
        setTimeout(loadBatch, 50); // Small delay between batches
      }
    }
    
    loadBatch();
  }, 300); // Wait 300ms for TRAIT_DATA to be populated
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    var maleBtn = document.getElementById('chooseMaleBtn');
    var femaleBtn = document.getElementById('chooseFemaleBtn');
    if (maleBtn) maleBtn.addEventListener('click', function () { setGender('male'); });
    if (femaleBtn) femaleBtn.addEventListener('click', function () { setGender('female'); });
  });
} else {
  var maleBtn = document.getElementById('chooseMaleBtn');
  var femaleBtn = document.getElementById('chooseFemaleBtn');
  if (maleBtn) maleBtn.addEventListener('click', function () { setGender('male'); });
  if (femaleBtn) femaleBtn.addEventListener('click', function () { setGender('female'); });
}

/* Canvas export (collage, export image) fails on file:// — browsers throw SecurityError ("operation is insecure"). */
function loIsFileProtocol() {
  return window.location.protocol === 'file:';
}
function loLocalServerHelpMessage() {
  return 'Your browser is blocking image export because this page was opened as a file (the address bar shows file://…).\n\n' +
    'That is normal browser security — it is not a bug in Character Creator.\n\n' +
    'To generate collages and export images, run a tiny web server from your LOCC2-main folder, then open the site with http://\n\n' +
    'Example (Terminal):\n' +
    '  cd path/to/LOCC2-main\n' +
    '  python3 -m http.server 8080\n\n' +
    'Then in your browser go to:\n' +
    '  http://localhost:8080\n\n' +
    'Collages and exports work there.';
}

