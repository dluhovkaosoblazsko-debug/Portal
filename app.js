import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://mqknxtloygnqbhjukhgt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DMe6KD4N6NbYT1ebAngfBg_xeOUbInv';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const apps = [
  {
    name: 'Evidence',
    description: 'Pomůcka pro tvorbu záznamů.',
    url: 'https://e-l-a-i.onrender.com/',
    host: 'Render'
  },
  {
    name: 'Tvorba listin',
    description: 'Tvorba dokumentů, formulářů a dalších listin.',
    url: 'https://dokument-creator.onrender.com/',
    host: 'Render'
  },
  {
    name: 'Dokumenty',
    description: 'Přístup k formulářům, vzorům a interním šablonám.',
    url: '#',
    host: 'Připravuje se'
  }
];

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const enterPortalBtn = document.getElementById('enterPortalBtn');
const closePortalBtn = document.getElementById('closePortalBtn');
const authStatus = document.getElementById('authStatus');
const userEmail = document.getElementById('userEmail');
const appsSection = document.getElementById('appsSection');
const welcomeText = document.getElementById('welcomeText');
const appsGrid = document.getElementById('appsGrid');

let currentSession = null;

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await initAuth();
});

function bindEvents() {
  loginBtn?.addEventListener('click', async () => {
    await handleLogin();
  });

  logoutBtn?.addEventListener('click', async () => {
    await handleLogout();
  });

  enterPortalBtn?.addEventListener('click', async () => {
    if (!currentSession || !currentSession.user) {
      const wantsLogin = window.confirm('Pro vstup do portálu se nejdřív přihlas přes e-mailový odkaz. Přihlásit se teď?');
      if (wantsLogin) {
        await handleLogin();
      }
      return;
    }

    openPortal();
  });

  closePortalBtn?.addEventListener('click', closePortal);
}

async function initAuth() {
  sb.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    updateAuthUI(session);
  });

  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error('Chyba při načtení session:', error.message);
    updateAuthUI(null);
    return;
  }

  currentSession = data.session;
  updateAuthUI(data.session);
}

async function handleLogin() {
  const email = window.prompt('Zadej svůj e-mail pro přihlášení:');
  if (!email) return;

  const cleanEmail = email.trim();
  if (!cleanEmail.includes('@')) {
    alert('Zadaný e-mail nevypadá správně.');
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
    alert('Nepodařilo se odeslat přihlašovací e-mail: ' + error.message);
    return;
  }

  authStatus.textContent = 'Na e-mail byl odeslán přihlašovací odkaz. Otevři schránku a klikni na něj.';
  alert('Na e-mail byl odeslán přihlašovací odkaz. Otevři schránku a klikni na něj.');
}

async function handleLogout() {
  const { error } = await sb.auth.signOut();

  if (error) {
    console.error(error);
    alert('Odhlášení selhalo: ' + error.message);
    return;
  }

  closePortal();
  alert('Byl jsi odhlášen.');
}

function updateAuthUI(session) {
  if (session && session.user) {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    userEmail.classList.remove('hidden');
    userEmail.textContent = 'Přihlášený uživatel: ' + (session.user.email || '—');
    authStatus.textContent = 'Přihlášení je aktivní. Můžeš vstoupit do portálu.';
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userEmail.classList.add('hidden');
    userEmail.textContent = '';
    authStatus.textContent = 'Přihlašování probíhá přes e-mailový odkaz.';
  }
}

function renderApps() {
  appsGrid.innerHTML = '';

  apps.forEach((app) => {
    const article = document.createElement('article');
    article.className = 'app-card';

    const isPlaceholder = app.url === '#';
    const linkHtml = isPlaceholder
      ? '<span class="app-link">Brzy</span>'
      : `<a class="app-link" href="${app.url}" target="_blank" rel="noopener noreferrer">Otevřít aplikaci →</a>`;

    article.innerHTML = `
      <h3>${app.name}</h3>
      <p>${app.description}</p>
      <div class="app-meta">Umístění: ${app.host}</div>
      ${linkHtml}
    `;

    appsGrid.appendChild(article);
  });
}

function openPortal() {
  renderApps();
  appsSection.classList.remove('hidden');
  closePortalBtn.classList.remove('hidden');
  enterPortalBtn.classList.add('hidden');
  welcomeText.textContent = 'Portál je otevřený. Níže vidíš dostupné aplikace.';
}

function closePortal() {
  appsSection.classList.add('hidden');
  closePortalBtn.classList.add('hidden');
  enterPortalBtn.classList.remove('hidden');
  welcomeText.textContent = 'Tady bude později přihlášení a řízený přístup pro členy týmu.';
}
