const SUPABASE_URL = "https://mqknxtloygnqbhjukhgt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DMe6KD4N6NbYT1ebAngfBg_xeOUbInv";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCurrentDate();
  initActiveAppsCount();
  initNavHighlight();
  initAuth();
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

async function initAuth() {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userEmail = document.getElementById("userEmail");

  if (!loginBtn || !logoutBtn || !userEmail) return;

  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleLogin();
  });

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleLogout();
  });

  sb.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session);
  });

  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error("Chyba při načtení session:", error.message);
    updateAuthUI(null);
    return;
  }

  updateAuthUI(data.session);
}

async function handleLogin() {
  const email = window.prompt("Zadej svůj e-mail pro přihlášení:");
  if (!email) return;

  const cleanEmail = email.trim();

  if (!cleanEmail.includes("@")) {
    alert("Zadaný e-mail nevypadá správně.");
    return;
  }

  const { error } = await sb.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    console.error(error);
    alert("Nepodařilo se odeslat přihlašovací e-mail: " + error.message);
    return;
  }

  alert("Na e-mail byl odeslán přihlašovací odkaz. Otevři schránku a klikni na něj.");
}

async function handleLogout() {
  const { error } = await sb.auth.signOut();

  if (error) {
    console.error(error);
    alert("Odhlášení selhalo: " + error.message);
    return;
  }

  alert("Byl jsi odhlášen.");
}

function updateAuthUI(session) {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userEmail = document.getElementById("userEmail");

  if (!loginBtn || !logoutBtn || !userEmail) return;

  if (session && session.user) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userEmail.classList.remove("hidden");
    userEmail.textContent = session.user.email || "Přihlášený uživatel";
  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userEmail.classList.add("hidden");
    userEmail.textContent = "";
  }
}