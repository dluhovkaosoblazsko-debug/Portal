import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// DOPLŇ svoje hodnoty ze Supabase > Project Settings > API
const SUPABASE_URL = 'https://mqknxtloygnqbhjukhgt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DMe6KD4N6NbYT1ebAngfBg_xeOUbInv';

const apps = [
  {
    name: 'Aplikace 1',
    description: 'Sem vlož první pracovní aplikaci.',
    url: 'https://example.com',
    host: 'GitHub / Render'
  },
  {
    name: 'Aplikace 2',
    description: 'Sem vlož druhou pracovní aplikaci.',
    url: 'https://example.com',
    host: 'GitHub / Render'
  },
  {
    name: 'Dokumentace',
    description: 'Návody, postupy a interní informace.',
    url: 'https://example.com',
    host: 'GitHub / Render'
  }
];

const emailInput = document.getElementById('emailInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statusMessage = document.getElementById('statusMessage');
const appsSection = document.getElementById('appsSection');
const welcomeText = document.getElementById('welcomeText');
const appsGrid = document.getElementById('appsGrid');

const redirectUrl = `${window.location.origin}${window.location.pathname}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

function setStatus(message, type = 'default') {
  statusMessage.textContent = message;
  statusMessage.classList.remove('is-error', 'is-success');

  if (type === 'error') {
    statusMessage.classList.add('is-error');
  }

  if (type === 'success') {
    statusMessage.classList.add('is-success');
  }
}

function renderApps() {
  appsGrid.innerHTML = '';

  apps.forEach((app) => {
    const article = document.createElement('article');
    article.className = 'app-card';

    article.innerHTML = `
      <h3>${app.name}</h3>
      <p>${app.description}</p>
      <div class="app-meta">Umístění: ${app.host}</div>
      <a class="app-link" href="${app.url}" target="_blank" rel="noopener noreferrer">Otevřít aplikaci →</a>
    `;

    appsGrid.appendChild(article);
  });
}

function showLoggedInState(user) {
  renderApps();
  appsSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  loginBtn.classList.add('hidden');
  emailInput.classList.add('hidden');
  welcomeText.textContent = `Přihlášený uživatel: ${user.email}`;
  setStatus('Přihlášení proběhlo úspěšně.', 'success');
}

function showLoggedOutState() {
  appsSection.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  loginBtn.classList.remove('hidden');
  emailInput.classList.remove('hidden');
  welcomeText.textContent = 'Přihlas se pracovním e-mailem. Po úspěšném přihlášení se zobrazí dostupné aplikace.';
  setStatus('Přihlášení funguje jen pro uživatele, kteří už jsou vytvořeni v Supabase Authentication.');
}

async function restoreSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    setStatus(`Chyba při načítání session: ${error.message}`, 'error');
    return;
  }

  if (data.session?.user) {
    showLoggedInState(data.session.user);
  } else {
    showLoggedOutState();
  }
}

async function handleLogin() {
  const email = emailInput.value.trim();

  if (!email) {
    setStatus('Zadej e-mail.', 'error');
    return;
  }

  setStatus('Odesílám Magic Link…');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectUrl
    }
  });

  if (error) {
    setStatus(`Přihlášení se nezdařilo: ${error.message}`, 'error');
    return;
  }

  setStatus('Magic Link byl odeslán. Otevři e-mail a klikni na přihlašovací odkaz.', 'success');
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus(`Odhlášení se nezdařilo: ${error.message}`, 'error');
    return;
  }

  emailInput.value = '';
  showLoggedOutState();
}

loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    showLoggedInState(session.user);
  } else if (event === 'SIGNED_OUT') {
    showLoggedOutState();
  }
});

restoreSession();
