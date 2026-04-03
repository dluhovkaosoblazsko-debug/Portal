const SUPABASE_URL = "https://mqknxtloygnqbhjukhgt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DMe6KD4N6NbYT1ebAngfBg_xeOUbInv";
const ATTENDANCE_URL = "dochazka.html";
const CLIENT_ENTRY_URL = "novy-klient.html";
const METHODOLOGY_URL = "metodika.html";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCurrentDate();
  initActiveAppsCount();
  initNavHighlight();
  initAttendanceLinks();
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

async function initAuth() {
  if (isTrustedBypassHost()) {
    updateAuthUI({
      user: {
        email: "lokalni.test@portal.local"
      }
    });
    setAuthMessage("Přihlášení je pro tuto adresu dočasně vypnuto.");
    return;
  }

  const loginBtn = document.getElementById("loginBtn");
  const heroLoginBtn = document.getElementById("heroLoginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userEmail = document.getElementById("userEmail");

  if (!loginBtn || !heroLoginBtn || !logoutBtn || !userEmail) return;

  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleLogin();
  });

  heroLoginBtn.addEventListener("click", async (e) => {
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
    setAuthMessage("Nepodařilo se odeslat přihlašovací e-mail: " + error.message);
    alert("Nepodařilo se odeslat přihlašovací e-mail: " + error.message);
    return;
  }

  setAuthMessage("Na e-mail byl odeslán přihlašovací odkaz. Otevři schránku a klikni na něj.");
  alert("Na e-mail byl odeslán přihlašovací odkaz. Otevři schránku a klikni na něj.");
}

async function handleLogout() {
  const { error } = await sb.auth.signOut();

  if (error) {
    console.error(error);
    alert("Odhlášení selhalo: " + error.message);
    return;
  }

  setAuthMessage("Přihlašování probíhá přes e-mailový odkaz.");
  alert("Byl jsi odhlášen.");
}

function updateAuthUI(session) {
  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userEmail = document.getElementById("userEmail");

  if (!loginView || !appView || !loginBtn || !logoutBtn || !userEmail) return;

  if (session && session.user) {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userEmail.classList.remove("hidden");
    userEmail.textContent = session.user.email || "Přihlášený uživatel";
  } else {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userEmail.classList.add("hidden");
    userEmail.textContent = "";
  }
}

function setAuthMessage(message) {
  const authMessage = document.getElementById("authMessage");
  if (authMessage) authMessage.textContent = message;
}

function isTrustedBypassHost() {
  return ["localhost", "127.0.0.1", "portal-040d.onrender.com"].includes(window.location.hostname);
}
