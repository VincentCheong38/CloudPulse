/**
 * Show/hide password via checkbox under each password field.
 */
(function () {
  function init() {
    document.querySelectorAll(".show-password-row").forEach((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      const targetId = checkbox?.getAttribute("data-target");
      const input = targetId ? document.getElementById(targetId) : null;
      if (!checkbox || !input || checkbox.dataset.bound === "1") return;
      checkbox.dataset.bound = "1";

      checkbox.addEventListener("change", () => {
        const show = checkbox.checked;
        input.type = show ? "text" : "password";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
