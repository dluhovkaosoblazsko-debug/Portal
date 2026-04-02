const apps = [
  {
    name: "Tvorba formulářů a listin",
    description: "Tvorba formulářů a listin",
    url: "https://dokument-creator.onrender.com/",
    host: "GitHub / Render"
  },
  {
    name: "E. L. A. I.",
    description: "Tvorba zápisů",
    url: "https://e-l-a-i.onrender.com",
    host: "GitHub / Render"
  },
  {
    name: "Dokumentace",
    description: "Návody, postupy a interní informace.",
    url: "https://example.com",
    host: "GitHub / Render"
  }
];

const enterPortalBtn = document.getElementById("enterPortalBtn");
const logoutBtn = document.getElementById("logoutBtn");
const appsSection = document.getElementById("appsSection");
const welcomeText = document.getElementById("welcomeText");
const appsGrid = document.getElementById("appsGrid");

function renderApps() {
  appsGrid.innerHTML = "";

  apps.forEach((app) => {
    const article = document.createElement("article");
    article.className = "app-card";

    article.innerHTML = `
      <h3>${app.name}</h3>
      <p>${app.description}</p>
      <div class="app-meta">Umístění: ${app.host}</div>
      <a class="app-link" href="${app.url}" target="_blank" rel="noopener noreferrer">Otevřít aplikaci →</a>
    `;

    appsGrid.appendChild(article);
  });
}

function openPortal() {
  renderApps();
  appsSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  enterPortalBtn.classList.add("hidden");
  welcomeText.textContent = "Portál je otevřený. Níže vidíš dostupné aplikace.";
}

function closePortal() {
  appsSection.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  enterPortalBtn.classList.remove("hidden");
  welcomeText.textContent = "Tady bude později přihlášení a řízený přístup pro členy týmu.";
}

enterPortalBtn.addEventListener("click", openPortal);
logoutBtn.addEventListener("click", closePortal);
