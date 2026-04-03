const ATTENDANCE_URL = "dochazka.html";
const CLIENT_ENTRY_URL = "novy-klient.html";
const METHODOLOGY_URL = "metodika.html";

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCurrentDate();
  initActiveAppsCount();
  initNavHighlight();
  initAttendanceLinks();
  initPortalView();
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
  dateEl.textContent = now.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
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

function initAttendanceLinks() {
  const attendanceLinks = document.querySelectorAll("[data-attendance-link]");
  attendanceLinks.forEach((link) => {
    link.setAttribute("href", ATTENDANCE_URL);
  });

  const clientEntryLinks = document.querySelectorAll("[data-client-entry-link]");
  clientEntryLinks.forEach((link) => {
    link.setAttribute("href", CLIENT_ENTRY_URL);
  });

  const methodologyLinks = document.querySelectorAll("[data-methodology-link]");
  methodologyLinks.forEach((link) => {
    link.setAttribute("href", METHODOLOGY_URL);
  });

  const attendancePeriod = document.getElementById("attendancePeriod");
  if (!attendancePeriod) return;

  const now = new Date();
  attendancePeriod.textContent = now.toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric"
  });
}

function initPortalView() {
  const appView = document.getElementById("appView");
  if (!appView) return;
  appView.classList.remove("hidden");
}
