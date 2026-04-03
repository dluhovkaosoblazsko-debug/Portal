# Portal tymu

Jednoduchy vstupni portal pro pracovni tym.

## Obsah
- prihlaseni pres Supabase Magic Link
- pristup jen pro existujici uzivatele v Supabase Authentication
- rozcestnik aplikaci

## Technologie
- HTML
- CSS
- JavaScript
- Supabase Auth

## Zakladni konfigurace
V souboru `app.js` nastav:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

V Supabase nastav:
- `Authentication > URL Configuration > Site URL`
- `Authentication > URL Configuration > Redirect URLs`

## E.L.A.I MVP API kontrakty

Podstranka `elai-helper.html` pouziva tri endpointy:

1. `POST /api/legal-query`
- Ucel: pravni dotaz s RAG a povinnymi citacemi.
- Request JSON:
```json
{
  "question": "string",
  "context": "string",
  "outputType": "structured_answer|checklist|risk_review",
  "depth": "short|balanced|deep",
  "sources": [
    "CZ-IZ-182-2006",
    "CZ-OSR-99-1963",
    "CZ-ER-120-2001",
    "CZ-SOUBEZNE-VYKONY-119-2001",
    "CZ-NV-595-2006"
  ],
  "promptBlueprint": {}
}
```
- Response JSON (povinne):
```json
{
  "odpoved": "string",
  "pravniOpora": [
    { "zakon": "string", "paragraf": "string", "citace": "string" }
  ],
  "miraJistoty": 0.0,
  "chybejiciVstupy": ["string"]
}
```

2. `POST /api/ocr-payslip`
- Ucel: OCR/vision extrakce dat z vyplatnice.
- Request: `multipart/form-data` (`file`, `mode`).
- Response JSON:
```json
{
  "period": "2026-03",
  "employer": "Nazev zamestnavatele",
  "netIncome": 31250,
  "confidence": 0.93
}
```

3. `POST /api/calculate`
- Ucel: audit log deterministickeho vypoctu (volitelne).
- Request JSON:
```json
{
  "months": 3,
  "extraIncome": 0,
  "selectedIncomes": [30000, 31250, 29800],
  "note": "string"
}
```

Poznamky:
- Frontend vypocet je deterministicky v `elai-helper.js`.
- AI se pouziva pro pravni RAG a OCR extrakci, ne pro finalni matematicky vypocet.

## Spusteni backendu

Minimal backend je v `server.js` (bez externich zavislosti):

```bash
set GEMINI_API_KEY=tvuj_api_klic
node server.js
```

Volitelne:
- `GEMINI_MODEL` (default `gemini-2.5-flash`)
- `GEMINI_API_BASE` (default `https://generativelanguage.googleapis.com/v1beta`)

Server:
- servuje staticke soubory z rootu projektu
- validuje whitelist pro `POST /api/legal-query` proti `data/whitelist-merged.json`
- kontroluje povinne `always_on_source_ids`
- vraci validacni chybu `422`, pokud je zdroj mimo whitelist nebo chybi povinne pole
- vola Gemini API a prijme jen odpoved v JSON schema (`odpoved`, `pravniOpora`, `miraJistoty`, `chybejiciVstupy`)

## Nasazeni na Render

Projekt uz neni vhodny jako ciste `Static Site`, protoze frontend vola backend endpointy:
- `POST /api/legal-query`
- `POST /api/ocr-payslip`
- `POST /api/calculate`

Pro Render tedy pouzij `Web Service` nad `server.js`.

V repozitari je pripravene:
- `package.json` se start skriptem `npm start`
- `render.yaml` pro Render Blueprint

Na Render nastav:
- `GEMINI_API_KEY`
- pripadne ponech default `GEMINI_MODEL=gemini-2.5-flash`
- pripadne ponech default `GEMINI_API_BASE=https://generativelanguage.googleapis.com/v1beta`

Deploy flow:
1. pushnout repozitar na GitHub
2. v Render vytvorit `New + > Blueprint` nebo `New + > Web Service`
3. pokud zvolis Web Service rucne:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. do Environment Variables vlozit `GEMINI_API_KEY`

Pokud bys nasadil projekt znovu jako `Static Site`, budou fungovat jen HTML/CSS/JS stranky bez API logiky, ale OCR a pravni pomocnik nebudou fungovat.

## Zabezpeceni portalu jednim heslem

Portal podporuje `HTTP Basic Auth` primo v `server.js`.

Na Render nastav:
- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASSWORD`

Pokud jsou obe hodnoty nastavene, server pred zobrazenim stranek vyzada uzivatelske jmeno a heslo v prohlizeci.
Pokud nastavene nejsou, Basic Auth je vypnute.
