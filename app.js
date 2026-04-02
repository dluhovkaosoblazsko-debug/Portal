document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCurrentDate();
  initActiveAppsCount();
  initNavHighlight();
});

function initMobileMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  if (!menuToggle || !mainNav) return;

  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (event) => {
    const clickedInsideMenu = mainNav.contains(event.target);
    const clickedToggle = menuToggle.contains(event.target);

    if (!clickedInsideMenu && !clickedToggle) {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function initCurrentDate() {
  const dateEl = document.getElementById("currentDate");
  if (!dateEl) return;

  const now = new Date();
  const formatted = now.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  dateEl.textContent = formatted;
}

function initActiveAppsCount() {
  const countEl = document.getElementById("activeAppsCount");
  if (!countEl) return;

  const activeCards = document.querySelectorAll('[data-active="true"]');
  countEl.textContent = activeCards.length;
}

function initNavHighlight() {
  const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');
  const sections = Array.from(navLinks)
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!navLinks.length || !sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = `#${entry.target.id}`;
        const navLink = document.querySelector(`.main-nav a[href="${id}"]`);

        if (entry.isIntersecting) {
          navLinks.forEach((link) => link.classList.remove("is-current"));
          if (navLink) navLink.classList.add("is-current");
        }
      });
    },
    {
      rootMargin: "-35% 0px -50% 0px",
      threshold: 0.01
    }
  );

  sections.forEach((section) => observer.observe(section));
}