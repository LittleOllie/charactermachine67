/* Little Ollie — Dynamic Trait Registry */
(function (global) {
  'use strict';

  var TRAIT_REGISTRY = [];
  var TRAIT_DATA = {};
  var TRAIT_BY_PATH = {};
  var TRAIT_DEBUG = false;
  var MANIFEST_URL = 'assets/traits-manifest.json';
  var REMOVE_THUMB = 'assets/traits/HATS/REMOVE.png';

  var SKIN_KEYWORDS = ['TAN', 'LIGHT', 'DARK', 'BROWN', 'PALE', 'BLACK', 'GINGER', 'BLONDE', 'WHITE', 'CHROME'];

  function logDebug() {
    if (!TRAIT_DEBUG) return;
    try { console.log.apply(console, arguments); } catch (e) {}
  }

  function traitNameFromFile(filename) {
    if (!filename) return '';
    var name = filename.replace(/\.(png|PNG)$/i, '');
    return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function formatTraitDisplayName(trait) {
    if (!trait) return '';
    if (typeof trait === 'string') return traitNameFromFile(trait.split('/').pop());
    return trait.traitName || traitNameFromFile((trait.file || trait.image || '').split('/').pop());
  }

  function extractSkinTone(text) {
    if (!text) return null;
    var upper = String(text).toUpperCase();
    var i, kw;
    for (i = 0; i < SKIN_KEYWORDS.length; i++) {
      kw = SKIN_KEYWORDS[i];
      if (new RegExp('\\b' + kw + '\\b').test(upper)) {
        return kw.charAt(0) + kw.slice(1).toLowerCase();
      }
    }
    return null;
  }

  function getSkinLabelFromTrait(trait) {
    if (!trait) return null;
    if (trait.skinTone) return trait.skinTone;
    var name = trait.traitName || traitNameFromFile(trait.file || '');
    return extractSkinTone(name) || name;
  }

  function normalizeMatchText(text) {
    return String(text || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  /** Key used to pair SKIN/Groovy with Open Hand - Groovy, Closed Hand - Brown with skin Brown, etc. */
  function getSkinMatchKey(skinTrait) {
    if (!skinTrait) return '';
    if (skinTrait.skinTone) return normalizeMatchText(skinTrait.skinTone);
    var tone = extractSkinTone(skinTrait.traitName || '');
    if (tone) return normalizeMatchText(tone);
    return normalizeMatchText(skinTrait.traitName || traitNameFromFile(skinTrait.file || ''));
  }

  function getHandVariantPart(trait) {
    if (!trait) return '';
    if (trait.skinTone) return normalizeMatchText(trait.skinTone);
    var name = trait.traitName || traitNameFromFile(trait.file || '');
    var prefix = name.match(/^(?:Open Hand|Closed Hand)\s*-\s*(.+)$/i);
    if (prefix) return normalizeMatchText(prefix[1]);
    var dash = name.split(' - ');
    if (dash.length > 1) return normalizeMatchText(dash.slice(1).join(' - '));
    return normalizeMatchText(name);
  }

  function variantNamesMatch(handPart, skinKey) {
    if (!handPart || !skinKey) return false;
    if (handPart === skinKey) return true;
    if (handPart.indexOf(skinKey) >= 0 || skinKey.indexOf(handPart) >= 0) return true;
    return false;
  }

  function enrichTrait(entry) {
    var t = Object.assign({}, entry);
    t.image = t.path;
    t.name = t.traitName;
    t.id = t.slot + '_' + t.normalizedName;
    t.selected = t.slot !== 'hoodies' && t.slot !== 'backgroundblur';
    if (t.isRemove) t.isBlank = true;
    return t;
  }

  function buildRegistryFromManifest(manifest) {
    TRAIT_REGISTRY = (manifest.traits || []).map(enrichTrait);
    TRAIT_BY_PATH = {};
    // Reuse the same TRAIT_DATA object so LOTraitRegistry.TRAIT_DATA stays in sync.
    Object.keys(TRAIT_DATA).forEach(function (slot) {
      delete TRAIT_DATA[slot];
    });
    TRAIT_REGISTRY.forEach(function (t) {
      if (!TRAIT_DATA[t.slot]) TRAIT_DATA[t.slot] = [];
      TRAIT_DATA[t.slot].push(t);
      TRAIT_BY_PATH[t.path] = t;
      TRAIT_BY_PATH[t.path.toLowerCase()] = t;
    });
    logDebug('[Trait Registry] loaded', TRAIT_REGISTRY.length, 'traits');
    return TRAIT_REGISTRY;
  }

  function loadTraitManifest(url) {
    var manifestPath = url || MANIFEST_URL;
    var bust = manifestPath + (manifestPath.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now();
    return fetch(bust).then(function (res) {
      if (!res.ok) throw new Error('Failed to load trait manifest: ' + res.status);
      return res.json();
    }).then(function (manifest) {
      buildRegistryFromManifest(manifest);
      return manifest;
    }).catch(function (err) {
      console.warn('[Trait Registry] load failed:', err);
      throw err;
    });
  }

  function getTraitByPath(path) {
    if (!path) return null;
    return TRAIT_BY_PATH[path] || TRAIT_BY_PATH[path.toLowerCase()] || null;
  }

  function isBlankTrait(traitOrPath) {
    var t = typeof traitOrPath === 'object' ? traitOrPath : getTraitByPath(traitOrPath);
    if (t && t.isRemove) return true;
    var path = (t && t.path) || traitOrPath || '';
    var name = (t && t.traitName) || '';
    var u = (path + ' ' + name).toUpperCase();
    return !path || u.indexOf('NO HAND') >= 0 || /\/(AA|AAA)\.PNG$/i.test(path);
  }

  function traitMatchesSkin(trait, skinTrait) {
    if (!trait || isBlankTrait(trait)) return false;
    if (!skinTrait || isBlankTrait(skinTrait)) return true;

    var skinKey = getSkinMatchKey(skinTrait);

    if (trait.slot === 'hand' || trait.slot === 'hand2') {
      return variantNamesMatch(getHandVariantPart(trait), skinKey);
    }

    if (trait.slot === 'ball' || trait.slot === 'ball2') {
      var itemTone = trait.skinTone || extractSkinTone(trait.traitName);
      if (!itemTone) return true;
      var skinTone = skinTrait.skinTone || extractSkinTone(skinTrait.traitName);
      if (skinTone) return normalizeMatchText(itemTone) === normalizeMatchText(skinTone);
      return variantNamesMatch(normalizeMatchText(itemTone), skinKey);
    }

    var skinLabel = getSkinLabelFromTrait(skinTrait);
    if (!skinLabel) return true;
    var skinUpper = skinLabel.toUpperCase();
    var traitName = (trait.traitName || '').toUpperCase();
    if (traitName.indexOf(skinUpper) >= 0) return true;
    var traitTone = trait.skinTone || extractSkinTone(trait.traitName);
    return traitTone && traitTone.toUpperCase() === skinUpper;
  }

  function getCompatibleTraits(skinTrait, pool) {
    pool = pool || [];
    var compatible = pool.filter(function (t) {
      return t && t.selected !== false && !isBlankTrait(t) && traitMatchesSkin(t, skinTrait);
    });
    logDebug('[Skin Match]', {
      currentSkin: formatTraitDisplayName(skinTrait),
      poolSize: pool.length,
      compatibleCount: compatible.length
    });
    return compatible;
  }

  function pickRandomFrom(list) {
    if (!list || !list.length) return null;
    var i;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      i = buf[0] % list.length;
    } else {
      i = Math.floor(Math.random() * list.length);
    }
    return list[i];
  }

  function findMatchingHandTrait(pool, skinTrait) {
    var compatible = getCompatibleTraits(skinTrait, pool);
    if (!compatible.length) return null;
    var skinKey = getSkinMatchKey(skinTrait);
    var exact = compatible.filter(function (t) {
      return getHandVariantPart(t) === skinKey;
    });
    if (exact.length) return pickRandomFrom(exact);
    return pickRandomFrom(compatible);
  }

  function buildTraitThumbnail(trait, slot) {
    var sel = trait.selected !== false;
    var wrap = document.createElement('div');
    wrap.className = 'trait-thumb-wrap';
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = trait.traitName;
    img.title = trait.traitName;
    img.dataset.slot = slot;
    img.dataset.src = trait.path;
    img.dataset.traitName = trait.traitName;
    img.dataset.selected = sel ? 'true' : 'false';
    if (!sel) img.classList.add('trait-deselected');
    img.src = encodeURI(trait.path);
    wrap.appendChild(img);
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'trait-checkbox';
    cb.checked = sel;
    cb.title = 'Include in randomizer';
    cb.addEventListener('click', function (e) { e.stopPropagation(); });
    cb.addEventListener('change', function () {
      sel = cb.checked;
      trait.selected = sel;
      img.dataset.selected = sel ? 'true' : 'false';
      if (sel) img.classList.remove('trait-deselected');
      else img.classList.add('trait-deselected');
    });
    wrap.appendChild(cb);
    return wrap;
  }

  function buildRemoveThumbnail(slot, removePath) {
    var wrap = document.createElement('div');
    wrap.className = 'trait-thumb-wrap';
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = 'Remove';
    img.title = 'Remove';
    img.dataset.slot = slot;
    img.dataset.src = '';
    img.dataset.traitName = 'Remove';
    img.dataset.selected = 'true';
    img.src = encodeURI(removePath || 'assets/traits/HATS/REMOVE.png');
    wrap.appendChild(img);
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'trait-checkbox';
    cb.checked = true;
    cb.style.visibility = 'hidden';
    wrap.appendChild(cb);
    return wrap;
  }

  function populateTraitCategory(categoryId, slot, options, onDone) {
    var cat = document.getElementById(categoryId);
    if (!cat) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    var opts = cat.querySelector('.trait-options');
    if (!opts) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    opts.innerHTML = '';
    var list = (TRAIT_DATA[slot] || []).slice();
    list.sort(function (a, b) {
      return (a.traitName || '').localeCompare(b.traitName || '', undefined, { sensitivity: 'base' });
    });
    list = list.filter(function (trait) { return !trait.isRemove; });
    var removeSlots = { hoodies: true, goo: true, accessories: true, hat: true, behindback: true, backgroundblur: true };
    if (removeSlots[slot]) {
      opts.appendChild(buildRemoveThumbnail(slot, options && options.removeThumb));
    }
    var chunkSize = 36;
    var index = 0;
    function appendChunk() {
      var end = Math.min(index + chunkSize, list.length);
      for (; index < end; index++) {
        opts.appendChild(buildTraitThumbnail(list[index], slot));
      }
      if (index < list.length) {
        setTimeout(appendChunk, 0);
      } else if (typeof onDone === 'function') {
        onDone();
      }
    }
    appendChunk();
  }

  function populateAllTraitCategories(categoryIdToSlot, options, done) {
    var ids = Object.keys(categoryIdToSlot);
    var idx = 0;
    function step() {
      if (idx >= ids.length) {
        if (typeof done === 'function') done();
        return;
      }
      populateTraitCategory(ids[idx], categoryIdToSlot[ids[idx]], options, function () {
        idx++;
        setTimeout(step, 0);
      });
    }
    step();
  }

  global.LOTraitRegistry = {
    TRAIT_REGISTRY: TRAIT_REGISTRY,
    TRAIT_DATA: TRAIT_DATA,
    loadTraitManifest: loadTraitManifest,
    buildRegistryFromManifest: buildRegistryFromManifest,
    formatTraitDisplayName: formatTraitDisplayName,
    getTraitByPath: getTraitByPath,
    isBlankTrait: isBlankTrait,
    traitMatchesSkin: traitMatchesSkin,
    getCompatibleTraits: getCompatibleTraits,
    findMatchingHandTrait: findMatchingHandTrait,
    getSkinLabelFromTrait: getSkinLabelFromTrait,
    extractSkinTone: extractSkinTone,
    populateAllTraitCategories: populateAllTraitCategories,
    setDebug: function (on) { TRAIT_DEBUG = !!on; },
    REMOVE_THUMB: REMOVE_THUMB
  };
})(typeof window !== 'undefined' ? window : this);
