# SignAI Website

This repository contains the source files for the public website of SignAI, a web frontend for the SignAI project. It includes static assets under `static/`, HTML templates under `templates/`, and a small Python-based server launcher in `main.py` used for local development and testing.

Product website: https://signai.dev

Original repository: https://github.com/Stefanos0710/SignAI

## What is in this repo
- `static/` — CSS, JavaScript and images used by the site
- `templates/` — HTML templates for the pages
- `main.py` — entry point to run a local development web server (Flask)
- `requirements.txt` — Python dependencies

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
