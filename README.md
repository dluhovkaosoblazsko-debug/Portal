# Portál týmu

Jednoduchý vstupní portál pro pracovní tým.

## Obsah
- přihlášení přes Supabase Magic Link
- přístup jen pro existující uživatele v Supabase Authentication
- rozcestník aplikací

## Technologie
- HTML
- CSS
- JavaScript
- Supabase Auth

## Důležité
V souboru `app.js` doplň:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

A v Supabase nastav správně:
- Authentication > URL Configuration > Site URL
- Authentication > URL Configuration > Redirect URLs

Na produkci tam dej URL svého Render portálu.
