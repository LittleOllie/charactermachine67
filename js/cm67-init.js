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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGenderButtons);
  } else {
    wireGenderButtons();
  }
})();
