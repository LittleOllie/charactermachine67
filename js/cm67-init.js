/* CharacterMachine67 — standalone bootstrap (does not modify Creator Suite). */
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

  function warnIfFileProtocol() {
    if (window.location.protocol !== 'file:') return;
    var bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px 14px;background:#c0392b;color:#fff;font:700 13px/1.35 Nunito,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.25);';
    bar.textContent = 'Character Machine 67 must be run over http://localhost (not file://). Trait images may not load from a file link.';
    document.body.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      wireGenderButtons();
      warnIfFileProtocol();
    });
  } else {
    wireGenderButtons();
    warnIfFileProtocol();
  }
})();
