import hashlib
import http.client
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

from flask import Flask, Response, abort, jsonify, redirect, render_template, request, send_from_directory, url_for

app = Flask(__name__)

# Canonical origin used for canonical URLs, hreflang, Open Graph, structured data and the sitemap.
# Keep it independent of the request host so preview deployments never compete with production.
# Must be the host production actually serves: signai.dev redirects to www, so canonicals use www.
SITE_URL = os.environ.get("SIGNAI_SITE_URL", "https://www.signai.dev").rstrip("/")

# Bump to bust browser caches after changing CSS/JS.
ASSET_VERSION = "2026.10.114"

# Date used for sitemap <lastmod> and structured data dateModified.
LAST_UPDATED = date(2026, 10, 21)

# Sign-up storage (Supabase REST). Without these, the form falls back to a pre-filled email.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_TABLE = os.environ.get("SIGNAI_SIGNUP_TABLE", "signai_subscribers")
SIGNUP_WINDOW = timedelta(minutes=30)
SIGNUP_MAX = 2  # sign-ups per visitor per window
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
NOTIFY_TO = os.environ.get("SIGNAI_NOTIFY_TO", "hello@signai.dev")
NOTIFY_FROM = os.environ.get("SIGNAI_NOTIFY_FROM", "SignAI <noreply@signai.dev>")

app.config.update(
    DEBUG=os.environ.get("FLASK_DEBUG") == "1",
    TEMPLATES_AUTO_RELOAD=os.environ.get("FLASK_DEBUG") == "1",
    SEND_FILE_MAX_AGE_DEFAULT=60 * 60 * 24 * 7,
)

# ---------------------------------------------------------------------------
# Languages and localized URLs
# ---------------------------------------------------------------------------
DEFAULT_LANG = "en"
LANGS = ("en", "de", "fr", "es")

# page -> lang -> path
ROUTES = {
    "home": {"en": "/", "de": "/de/", "fr": "/fr/", "es": "/es/"},
    "technology": {"en": "/technology", "de": "/de/technologie", "fr": "/fr/technologie", "es": "/es/tecnologia"},
    "download": {"en": "/download", "de": "/de/download", "fr": "/fr/telechargement", "es": "/es/descarga"},
}

# Pages listed in the sitemap (Google ignores priority/changefreq, so only lastmod is emitted)
SITEMAP = ("home", "technology", "download")

I18N_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "i18n")


@lru_cache(maxsize=None)
def load_strings(lang):
    with open(os.path.join(I18N_DIR, f"{lang}.json"), encoding="utf-8") as f:
        return json.load(f)


def page_url(page, lang=DEFAULT_LANG):
    return ROUTES[page][lang]


def lang_from_path(path):
    first = path.strip("/").split("/", 1)[0]
    return first if first in LANGS and first != DEFAULT_LANG else DEFAULT_LANG


def render_page(page, lang, status=200):
    strings = load_strings(lang)
    alternates = [(code, SITE_URL + page_url(page, code)) for code in LANGS] if page in ROUTES else []
    return render_template(
        f"{page}.html",
        L=strings,
        lang=lang,
        page=page,
        alternates=alternates,
        languages=[(code, load_strings(code)["meta"]) for code in LANGS],
    ), status


def make_view(page, lang):
    def view():
        return render_page(page, lang)
    view.__name__ = f"{page}_{lang}"
    return view


for _page, _paths in ROUTES.items():
    for _lang, _path in _paths.items():
        app.add_url_rule(_path, endpoint=f"{_page}_{_lang}", view_func=make_view(_page, _lang))


@app.context_processor
def inject_globals():
    def asset(filename):
        return url_for("static", filename=filename, v=ASSET_VERSION)

    return {
        "SITE_URL": SITE_URL,
        "LANGS": LANGS,
        "page_url": page_url,
        "asset": asset,
        "current_year": date.today().year,
        "last_updated": LAST_UPDATED,
    }


# Legacy URLs: keep old links and search results working.
@app.route("/download/instructions")
def instructions():
    return redirect(page_url("download"), code=301)


# ---------------------------------------------------------------------------
# Sign-up ("notify me") endpoint
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,63}$")
INTERESTS = {"all", "updates", "research", "community", "organization", "press"}
# URLError/timeouts/resets are OSError; HTTPException covers truncated responses; ValueError bad JSON.
NETWORK_ERRORS = (OSError, http.client.HTTPException, ValueError)


@app.route("/api/subscribe", methods=["POST"])
def subscribe():
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip().lower()
    # One or more topics: a JSON list, repeated form fields, or a single string
    picked = data.get("interest") if request.is_json else request.form.getlist("interest")
    if isinstance(picked, str):
        picked = [picked]
    if not isinstance(picked, list):
        picked = []
    picked = sorted({p for p in picked if isinstance(p, str) and p in INTERESTS})
    interest = "all" if "all" in picked else ",".join(picked) or "updates"
    lang = data.get("lang") if data.get("lang") in LANGS else DEFAULT_LANG

    # Honeypot field: real visitors never fill it in.
    if data.get("company"):
        return jsonify(ok=True)
    if not EMAIL_RE.match(email) or len(email) > 254:
        return jsonify(ok=False, error="invalid_email"), 400
    if str(data.get("consent")).lower() not in ("1", "true", "on", "yes"):
        return jsonify(ok=False, error="consent_required"), 400

    if not (SUPABASE_URL and SUPABASE_KEY):
        return jsonify(ok=False, error="not_configured"), 503

    # At most SIGNUP_MAX sign-ups per visitor (IP) per window; only a hash of the IP is stored.
    ip = (request.headers.get("X-Forwarded-For") or request.remote_addr or "").split(",")[0].strip()
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    cutoff = (datetime.now(timezone.utc) - SIGNUP_WINDOW).isoformat()
    try:
        recent = supabase("GET", "signai_signup_limits", query={"ip_hash": f"eq.{ip_hash}", "last_at": f"gt.{cutoff}", "select": "id"})
    except NETWORK_ERRORS as exc:
        # Fail open: a lost sign-up is worse than a missed rate limit.
        app.logger.warning("Rate-limit lookup failed: %s", exc)
        recent = []
    if len(recent) >= SIGNUP_MAX:
        return jsonify(ok=False, error="rate_limited"), 429

    row = {
        "email": email,
        "interest": interest,
        "lang": lang,
        "source": (data.get("source") or "")[:80],
        "consented_at": datetime.now(timezone.utc).isoformat(),
    }
    for attempt in range(2):  # the insert is idempotent, so one retry on a transient error is safe
        try:
            # representation: result is [] when the email already existed
            is_new = bool(supabase("POST", SUPABASE_TABLE, row, query={"on_conflict": "email"},
                                   prefer="resolution=ignore-duplicates,return=representation"))
            break
        except NETWORK_ERRORS as exc:
            app.logger.warning("Sign-up storage failed (attempt %d): %s", attempt + 1, exc)
    else:
        return jsonify(ok=False, error="storage_failed"), 502
    try:
        supabase("POST", "signai_signup_limits", {"ip_hash": ip_hash, "last_at": row["consented_at"]}, prefer="return=minimal")
    except NETWORK_ERRORS as exc:
        app.logger.warning("Rate-limit insert failed: %s", exc)
    if is_new:
        notify_signup(row)
    return jsonify(ok=True)


def supabase(method, table, body=None, query=None, prefer="return=representation"):
    """Call Supabase's REST API with the service key; returns the parsed JSON (or [])."""
    url = f"{SUPABASE_URL}/rest/v1/{table}" + ("?" + urllib.parse.urlencode(query) if query else "")
    req = urllib.request.Request(
        url, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "Prefer": prefer})
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read() or b"[]")


def notify_signup(row):
    """Email the team about a new sign-up via Resend. Best effort: the sign-up is already stored."""
    if not RESEND_API_KEY:
        return
    text = (f"New SignAI sign-up\n\nEmail: {row['email']}\nInterest: {row['interest']}\n"
            f"Language: {row['lang']}\nSource: {row['source'] or '-'}\nAt: {row['consented_at']}\n")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps({"from": NOTIFY_FROM, "to": [NOTIFY_TO],
                         "subject": f"New SignAI sign-up: {row['email']}", "text": text,
                         "reply_to": row["email"]}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=8).close()
    except NETWORK_ERRORS as exc:
        app.logger.warning("Sign-up notification failed: %s", exc)


# ---------------------------------------------------------------------------
# SEO files, icons, errors, headers
# ---------------------------------------------------------------------------
@app.route("/robots.txt")
def robots():
    body = "\n".join([
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "",
        f"Sitemap: {SITE_URL}/sitemap.xml",
        "",
    ])
    return Response(body, mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    urls = []
    for page in SITEMAP:
        links = "\n".join(
            f'    <xhtml:link rel="alternate" hreflang="{code}" href="{SITE_URL}{page_url(page, code)}"/>'
            for code in LANGS
        ) + f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE_URL}{page_url(page)}"/>'
        for code in LANGS:
            urls.append(
                "  <url>\n"
                f"    <loc>{SITE_URL}{page_url(page, code)}</loc>\n"
                f"    <lastmod>{LAST_UPDATED.isoformat()}</lastmod>\n"
                f"{links}\n"
                "  </url>"
            )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(body, mimetype="application/xml", headers={"Cache-Control": "public, max-age=3600"})


@app.route("/site.webmanifest")
def webmanifest():
    return send_from_directory(app.static_folder, "manifest.json", mimetype="application/manifest+json")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "favicon.ico", mimetype="image/vnd.microsoft.icon")


@app.route("/apple-touch-icon.png")
@app.route("/apple-touch-icon-precomposed.png")
def apple_touch_icon():
    return send_from_directory(app.static_folder, "img/apple-touch-icon.png", mimetype="image/png")


@app.errorhandler(404)
def page_not_found(error):
    if request.path.startswith("/api/"):
        return jsonify(ok=False, error="not_found"), 404
    return render_page("404", lang_from_path(request.path), status=404)


@app.errorhandler(405)
def method_not_allowed(error):
    if request.path.startswith("/api/"):
        return jsonify(ok=False, error="method_not_allowed"), 405
    abort(404)


@app.after_request
def set_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.path.startswith("/static/") and request.args.get("v"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Robots-Tag"] = "noindex"
    return response


# start the development server
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
