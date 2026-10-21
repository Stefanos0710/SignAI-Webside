# SignAI Website

This repository contains the source files for the public website of SignAI, a web frontend for the SignAI project. It includes static assets under `static/`, HTML templates under `templates/`, and a small Python-based server launcher in `main.py` used for local development and testing.

Product website: https://signai.dev

Original repository: https://github.com/Stefanos0710/SignAI

<a href="https://www.seobility.net/de/seocheck/check?url=https%3A%2F%2Fwww.signai.dev%2F"><img src="https://app.seobility.net/widget/widget.png?url=https%3A%2F%2Fwww.signai.dev%2F" alt="Seobility Score für signai.dev"></a>

## What is in this repo
- `main.py` — Flask app: localized page routes, the sign-up endpoint (`POST /api/subscribe`), `robots.txt`, `sitemap.xml` (with hreflang alternates), web manifest, legacy redirects and security headers
- `i18n/` — all website text, one file per language: `en.json`, `de.json`, `fr.json`, `es.json`
- `templates/` — Jinja templates shared by all languages
  - `base.html` — layout: SEO meta tags, hreflang, Open Graph/Twitter cards, JSON-LD structured data, analytics
  - `home.html`, `technology.html`, `download.html`, `404.html`
  - `partials/` — navigation (with language switcher), footer, sign-up form, language banner, icons, FAQ/structured-data macros and the keypoint illustration (`_signer.svg`)
- `static/css/site.css` — the complete stylesheet (design tokens at the top)
- `static/js/main.js` — header, mobile menu, language banner, FAQ, sign-up form and scroll-reveal behavior
- `static/fonts/` — self-hosted Inter, Instrument Serif and JetBrains Mono (SIL OFL), so no third-party font requests
- `static/img/` — logo sizes, favicons, apple-touch icon and one Open Graph image per language (`og-signai-<lang>.png`, 1200×630)

## Languages and URLs
| Page | English | Deutsch | Français | Español |
|---|---|---|---|---|
| Home | `/` | `/de/` | `/fr/` | `/es/` |
| Technology | `/technology` | `/de/technologie` | `/fr/technologie` | `/es/tecnologia` |
| Download | `/download` | `/de/download` | `/fr/telechargement` | `/es/descarga` |

English is the default (`x-default`). Visitors are never redirected automatically; if their browser prefers another available language, a small banner offers it.

To add a language: copy `i18n/en.json` to `i18n/<code>.json`, translate it, add the code to `LANGS` and its paths to `ROUTES` in `main.py`, and create `static/img/og-signai-<code>.png`.

## Sign-ups ("Notify me")
The form posts to `/api/subscribe`, which stores the email address in Supabase. Without configuration the form still works: it opens the visitor's email app with a pre-filled message to hello@signai.dev.

1. Create the table (Supabase SQL editor):
   ```sql
   create table public.signai_subscribers (
     id bigint generated always as identity primary key,
     email text not null unique,
     interest text not null default 'updates',  -- 'all' or a comma list, e.g. 'press,research'
     lang text not null default 'en',
     source text,
     consented_at timestamptz not null,
     created_at timestamptz not null default now()
   );
   -- No policies: only the server-side service role key can read or write.
   alter table public.signai_subscribers enable row level security;
   ```
2. Set the environment variables on the server (e.g. in Vercel): `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Optional: `SIGNAI_SIGNUP_TABLE`.

## Configuration
- `SIGNAI_SITE_URL` — canonical origin used for canonical links, hreflang, Open Graph URLs, structured data and the sitemap (default `https://www.signai.dev`, the host production serves; `signai.dev` redirects there).
- `FLASK_DEBUG=1` — enables debug mode and template auto-reload for local development.
- `ASSET_VERSION` in `main.py` — bump it after changing CSS/JS so browsers fetch the new files.
- `LAST_UPDATED` in `main.py` — date used for `lastmod` in the sitemap and `dateModified` in structured data.

## Notes
- Public downloads are paused: the download pages explain that the first-generation desktop app is retired. The old `/download/instructions` URL permanently redirects to `/download`.
- Adding a page: create the template, add its texts to every file in `i18n/`, add its paths to `ROUTES` and an entry to `SITEMAP` in `main.py`.

## Technologies
- Python 3
- Flask web framework (app is implemented with Flask)
- HTML / CSS / JavaScript for the frontend

## Details from the code
- `main.py` creates a Flask `app` and, when run directly, calls:
  app.run(host='0.0.0.0', port=5000, debug=True)

  That means the development server listens on port 5000 on all interfaces and Flask debug mode is enabled. Do not use this configuration in production.

## Quick start (Windows — cmd.exe)
1) Create and activate a virtual environment:
```cmd
python -m venv venv
venv\Scripts\activate
```

2) Install dependencies:
```cmd
pip install -r requirements.txt
```

3) Start the development server (same as the code in `main.py`):
```cmd
python main.py
```

4) Open the website in your browser:
- Visit http://127.0.0.1:5000 or http://localhost:5000

## Production notes
- The built-in Flask server (used by `python main.py`) is for development only. Turn off debug mode before deploying:
  - In `main.py`, set `debug=False` or remove the `app.run(..., debug=True)` flag.
- For production use a WSGI server. Example (Linux):

```sh
# run from the repository root (example)
# gunicorn requires a Unix-like environment; not for Windows
gunicorn -w 4 -b 0.0.0.0:5000 main:app
```

## Troubleshooting
- ModuleNotFoundError / missing packages: make sure the virtual environment is active and run `pip install -r requirements.txt`.
- Port already in use: change the port in `main.py` or stop the process using the port.
- If the site looks broken: check the browser console for missing assets or JavaScript errors and ensure files in `static/` are present.

## How to contribute
- Make changes locally, test them, and open a pull request in this repository or the original repository linked above.
- For content fixes and small UI tweaks, a short PR is fine.
- For larger features, open an issue first describing the planned change.

## Links & contact
- Website: https://signai.dev
- Original repo: https://github.com/Stefanos0710/SignAI
