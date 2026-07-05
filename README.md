# FeWo Manager PWA

Progressive Web App fuer die Verwaltung einer privaten Ferienwohnung.

## Features

- Dashboard mit Einnahmen, Ausgaben, Gewinn, offenen Zahlungen
- Ausgaben erfassen (Kategorie, Betrag, Steuer, optional Beleg)
- Buchungen inkl. Detailansicht (Gebuehren, Netto, Auszahlung)
- Buchungen je Typ bearbeiten: Fixkosten, Manuelle Buchungen, Umbuchungen
- Reports (Monat/Jahr) und CSV Export fuer WISO EUEr
- Installierbare PWA mit Offline-Fallback
- Strikte Trennung: UI, State, API-Layer

## Architektur

- Frontend: statisch (HTML/CSS/JS), GitHub Pages
- Backend: externes Google Apps Script REST API
- Keine Secrets im Frontend
- Authentifizierung ueber APP_TOKEN Header

## API Endpoints (Backend)

- GET /health
- GET /bookings
- GET /bookings/{id}
- POST /expenses
- PUT /expenses/{id}
- DELETE /expenses/{id}
- GET /payments
- GET /summary
- GET /euer
- GET /export/csv
- POST /lodgify/import

## Setup

1. Repository pushen.
2. In GitHub unter Settings > Pages die Source auf GitHub Actions stellen.
3. App oeffnen und in Einstellungen eintragen:
   - Datenquelle: Google Sheet (direkt) oder Apps Script API
   - Spreadsheet ID oder komplette Google-Sheets-URL (bei Sheet-Modus)
   - API Base URL (bei Backend-Modus)
   - APP_TOKEN (optional)
4. In den Einstellungen auf "Verbindung testen" klicken, um Freigabe/Erreichbarkeit vor dem Speichern zu pruefen.

## Google-Sheet-Modus

Die App kann direkt aus Google Sheets lesen, ohne zusaetzliche Backend-Endpunkte.

- Verwendete Sheets:
  - AlleBuchungenPlan
  - Monatswerte
- Dashboard/Reports werden aus Monatswerte aggregiert.
- Buchungen/Ausgaben werden aus AlleBuchungenPlan gelesen.
- CSV Export verwendet Monatswerte als Quelle.

Hinweis: Im reinen Sheet-Modus sind Schreiboperationen fuer Ausgaben nicht verfuegbar. Dafuer ist ein Apps-Script-Schreibendpunkt noetig.
Hinweis: Fuer private Sheets wird Google OAuth benoetigt. Trage die Google OAuth Client ID ein und klicke auf "Google Auth starten".
Hinweis: Buchungsbearbeitung (Fixkosten/Manuell/Umbuchung) funktioniert im Sheet-Modus direkt ueber die Google Sheets API mit OAuth-Schreibrecht.

## Buchungen bearbeiten

- Die Buchungsbearbeitung nutzt Quell-Sheets, damit die bestehende Logik stabil bleibt:
  - Fixkosten
  - Manuelle_Buchungen
  - Umbuchungen
- Nach Speichern werden die abgeleiteten Sheets automatisch neu erzeugt:
  - AlleBuchungenPlan
  - Monatswerte
- Fuer Bearbeitung bitte Datenquelle "Apps Script API" verwenden.

## Auth und Zugriff

- Sheet-Modus: Zugriff erfolgt ueber Google OAuth (Sheets API) mit dem angemeldeten Benutzer.
- Backend-Modus: Zugriff laeuft ueber Apps Script URL. Optional kann APP_TOKEN als Header gesendet werden. Dieser Modus funktioniert auch mit privaten Sheets, weil nur Apps Script auf das Sheet zugreift.
- Wenn "Failed to fetch" erscheint, ist es fast immer ein Zugriffs-/CORS-/Freigabeproblem und kein Datenformatfehler.

Hinweis: Die App unterstuetzt im Backend-Modus sowohl klassische REST-Pfade als auch Apps-Script-Action-Requests (z. B. ?action=getSummary).

## Lokaler Start

Static Server verwenden, zum Beispiel:

- npx serve .
- oder python -m http.server 8080

Danach auf http://localhost:8080 oeffnen.

## Struktur

- index.html
- manifest.webmanifest
- sw.js
- offline.html
- assets/
- js/
  - api.js
  - config.js
  - state.js
  - router.js
  - views/
  - utils/
