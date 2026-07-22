import { readConfig } from "./config.js";
import { getGoogleAccessToken } from "./googleAuth.js";

function buildUrl(path) {
    const { baseUrl } = readConfig();
    if (!baseUrl) {
        throw new Error("API Base URL fehlt. Bitte in den Einstellungen eintragen.");
    }
    return `${baseUrl}${path}`;
}

function isSheetMode() {
    const { dataSource } = readConfig();
    return dataSource !== "backend";
}

function isAppsScriptBackend() {
    const { baseUrl } = readConfig();
    return String(baseUrl || "").includes("script.google.com/macros/s/");
}

async function requestAppsScript(action, params = {}) {
    const { baseUrl, appToken } = readConfig();
    if (!baseUrl) {
        throw new Error("API Base URL fehlt. Bitte in den Einstellungen eintragen.");
    }

    const query = new URLSearchParams({ action, ...params });
    if (appToken) {
        query.set("appToken", appToken);
    }
    const url = `${String(baseUrl).replace(/\/$/, "")}?${query.toString()}`;
    const headers = { Accept: "application/json" };

    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            headers,
        });
    } catch (error) {
        throw new Error(buildFetchNetworkErrorMessage("backend", error));
    }

    if (!response.ok) {
        throw new Error(`Apps Script Request fehlgeschlagen (${response.status})`);
    }

    const payload = await response.json();
    const data = payload?.data || payload;
    if (data?.ok === false) {
        throw new Error(data.error || "Apps Script Fehler");
    }
    return data?.result !== undefined ? data.result : data;
}

async function requestAppsScriptPost(action, body = {}) {
    const { baseUrl, appToken } = readConfig();
    if (!baseUrl) {
        throw new Error("API Base URL fehlt. Bitte in den Einstellungen eintragen.");
    }

    const headers = {
        "Content-Type": "text/plain;charset=utf-8",
        Accept: "application/json",
    };

    let response;
    try {
        response = await fetch(String(baseUrl).replace(/\/$/, ""), {
            method: "POST",
            headers,
            body: JSON.stringify({ action, appToken, ...body }),
        });
    } catch (error) {
        throw new Error(buildFetchNetworkErrorMessage("backend", error));
    }

    if (!response.ok) {
        throw new Error(`Apps Script POST fehlgeschlagen (${response.status})`);
    }

    const payload = await response.json();
    const data = payload?.data || payload;
    if (data?.ok === false) {
        throw new Error(data.error || "Apps Script Fehler");
    }
    return data?.result !== undefined ? data.result : data;
}

async function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const hasBody = options.body !== undefined && options.body !== null;
    const { appToken } = readConfig();
    const headers = {
        Accept: "application/json",
        ...options.headers,
    };

    if (hasBody && method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (appToken) {
        headers.APP_TOKEN = appToken;
    }

    let response;
    try {
        response = await fetch(buildUrl(path), {
            ...options,
            headers,
        });
    } catch (error) {
        throw new Error(buildFetchNetworkErrorMessage("backend", error));
    }

    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const payload = await response.json();
            message = payload?.error || payload?.message || message;
        } catch {
            const text = await response.text();
            if (text) message = text;
        }
        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        return response.json();
    }
    return response.text();
}

async function requestSheetJson(sheetName) {
    const { spreadsheetId } = readConfig();
    if (!spreadsheetId) {
        throw new Error("Spreadsheet ID fehlt. Bitte in den Einstellungen eintragen.");
    }

    if (!/^[a-zA-Z0-9-_]{20,}$/.test(spreadsheetId)) {
        throw new Error("Spreadsheet ID wirkt ungueltig. Bitte komplette Google-Sheets-URL oder reine ID eintragen.");
    }

    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
        throw new Error("Google Auth erforderlich. Bitte in den Einstellungen auf Google Auth starten klicken.");
    }

    const range = `${sheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        });
    } catch (error) {
        throw new Error(buildFetchNetworkErrorMessage("sheet", error));
    }
    if (!response.ok) {
        let hint = "";
        if (response.status === 403) {
            hint = " Zugriff verweigert. Bitte OAuth-Berechtigung und Spreadsheet-Rechte des angemeldeten Kontos pruefen.";
        }
        throw new Error(`Sheet ${sheetName} konnte nicht geladen werden (HTTP ${response.status}).${hint}`);
    }

    const payload = await response.json();
    return valuesToRows(payload?.values || []);
}

function buildFetchNetworkErrorMessage(sourceType, error) {
    const base = "Netzwerkfehler (Failed to fetch).";

    if (sourceType === "sheet") {
        return `${base} Zugriff auf Google Sheets API nicht moeglich. Bitte Google Auth starten und pruefen, ob die OAuth-Client-ID korrekt konfiguriert ist.`;
    }

    return `${base} Backend nicht erreichbar. Bitte pruefe API Base URL, Deployment-Freigabe des Apps-Script-Web-Apps und HTTPS.`;
}

function normalizeSpreadsheetIdFromInput(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";

    const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];

    return raw;
}

function normalizeBaseUrlFromInput(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";

    return raw
        .replace(/^https:\/\/script\.google\.com\/a\/macros\/[^/]+\/s\//, "https://script.google.com/macros/s/")
        .replace(/\/$/, "");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function testSheetAccess(spreadsheetId, sheetName) {
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
        return {
            ok: false,
            message: "Google Auth fehlt. Bitte zuerst Google Auth starten.",
        };
    }

    const range = `${sheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;

    let response;
    try {
        response = await fetchWithTimeout(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        });
    } catch {
        return {
            ok: false,
            message: `Request fuer ${sheetName} konnte nicht gestartet werden (Failed to fetch).`,
        };
    }

    if (!response.ok) {
        return {
            ok: false,
            message: `Sheet ${sheetName} nicht erreichbar (HTTP ${response.status}).`,
        };
    }

    return {
        ok: true,
        message: `Sheet ${sheetName} erreichbar.`,
    };
}

function buildBackendCandidateUrls(baseUrl) {
    const trimmed = String(baseUrl || "").trim().replace(/\/$/, "");
    if (!trimmed) return [];

    const isScript = trimmed.includes("script.google.com/macros/s/");
    const urls = [];
    if (isScript) {
        urls.push(`${trimmed}?action=ping`);
        urls.push(`${trimmed}?action=health`);
        return Array.from(new Set(urls));
    }

    urls.push(`${trimmed}/health`);
    urls.push(`${trimmed}?action=ping`);
    urls.push(`${trimmed}?action=lodgifyHealth`);
    return Array.from(new Set(urls));
}

async function testBackendAccess(baseUrl, appToken) {
    const candidates = buildBackendCandidateUrls(baseUrl);
    const isScript = String(baseUrl || "").includes("script.google.com/macros/s/");
    if (!candidates.length) {
        return {
            ok: false,
            message: "API Base URL fehlt.",
        };
    }

    const failures = [];

    for (const url of candidates) {
        const target = new URL(url);
        if (appToken) {
            target.searchParams.set("appToken", appToken);
        }
        try {
            const response = await fetchWithTimeout(String(target), {
                method: "GET",
                headers: { Accept: "application/json" },
            });
            if (response.ok) {
                return {
                    ok: true,
                    message: `Backend erreichbar ueber ${target}`,
                };
            }
            failures.push(`${target} -> HTTP ${response.status}`);
        } catch {
            failures.push(`${target} -> Failed to fetch`);
        }
    }

    const allFailedToFetch = failures.length > 0 && failures.every((entry) => entry.endsWith("-> Failed to fetch"));
    if (isScript && allFailedToFetch) {
        return {
            ok: false,
            message: "Backend nicht erreichbar. Die Apps-Script-Web-App ist sehr wahrscheinlich nicht oeffentlich freigegeben und leitet auf Google-Login um. Stelle im Deployment ein: Execute as = Me, Who has access = Anyone.",
        };
    }

    return {
        ok: false,
        message: `Backend nicht erreichbar. Geprueft: ${failures.join(" | ")}`,
    };
}

export async function testConnection(input = {}) {
    const cfg = readConfig();
    const dataSource = input.dataSource || cfg.dataSource || "sheet";
    const spreadsheetId = normalizeSpreadsheetIdFromInput(input.spreadsheetId || cfg.spreadsheetId);
    const baseUrl = normalizeBaseUrlFromInput(input.baseUrl || cfg.baseUrl || "");
    const appToken = String(input.appToken || cfg.appToken || "").trim();

    if (dataSource === "sheet") {
        if (!spreadsheetId) {
            return {
                ok: false,
                message: "Spreadsheet ID fehlt.",
            };
        }

        if (!/^[a-zA-Z0-9-_]{20,}$/.test(spreadsheetId)) {
            return {
                ok: false,
                message: "Spreadsheet ID sieht ungueltig aus.",
            };
        }

        const requiredSheets = ["Fixkosten", "Manuelle_Buchungen", "Umbuchungen", "Monatswerte"];
        const results = await Promise.all(requiredSheets.map((name) => testSheetAccess(spreadsheetId, name)));
        const failed = results.find((result) => !result.ok);
        if (failed) {
            return {
                ok: false,
                message: `${failed.message} Bitte Google Auth pruefen oder auf Backend-Modus wechseln.`,
            };
        }

        return {
            ok: true,
            message: "Sheet-Verbindung erfolgreich. Quell-Sheets sind erreichbar.",
        };
    }

    return testBackendAccess(baseUrl, appToken);
}

function parseGvizResponse(text) {
    const start = text.indexOf("(");
    const end = text.lastIndexOf(")");
    if (start < 0 || end < 0 || end <= start + 1) {
        throw new Error("Ungueltige Google Sheets Antwort. Bitte Freigabe pruefen.");
    }

    const payload = JSON.parse(text.slice(start + 1, end));
    if (!payload || !payload.table) {
        throw new Error("Google Sheets Daten konnten nicht gelesen werden.");
    }
    return payload.table;
}

function valuesToRows(values) {
    if (!Array.isArray(values) || values.length < 2) {
        return [];
    }

    const header = values[0].map((col, idx) => {
        const label = String(col || "").trim();
        return label || `col_${idx}`;
    });

    return values.slice(1).map((row, idx) => {
        const out = { __row: idx + 2 };
        header.forEach((key, idx) => {
            out[key] = row[idx] ?? null;
        });
        return out;
    });
}

function tableToRows(table) {
    const headers = (table.cols || []).map((col, idx) => {
        const label = String(col?.label || "").trim();
        return label || `col_${idx}`;
    });

    return (table.rows || []).map((row) => {
        const cells = row.c || [];
        const mapped = {};

        headers.forEach((header, idx) => {
            const cell = cells[idx];
            mapped[header] = normalizeSheetCell(cell);
        });

        return mapped;
    });
}

function normalizeSheetCell(cell) {
    if (!cell) return null;
    if (cell.v === null || cell.v === undefined) return null;

    if (typeof cell.v === "string" && /^Date\(/.test(cell.v)) {
        return cell.f || cell.v;
    }

    return cell.v;
}

function toNumber(value) {
    if (typeof value === "number") return value;
    const parsed = Number(
        String(value ?? "")
            .replace(/\./g, "")
            .replace(",", "."),
    );
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateForInput(value) {
    if (value === null || value === undefined || value === "") return "";

    if (typeof value === "number" && Number.isFinite(value)) {
        const epoch = Date.UTC(1899, 11, 30);
        const date = new Date(epoch + value * 86400000);
        return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    }

    const raw = String(value).trim();
    const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (de) {
        const year = de[3].length === 2 ? `20${de[3]}` : de[3];
        const month = de[2].padStart(2, "0");
        const day = de[1].padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
        return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    }

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
    }

    return "";
}

function toDateString(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString().slice(0, 10);
}

function currentYearMonth() {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
    };
}

function normalizeAlleBuchungenRows(rows) {
    return rows.map((row, index) => {
        const id = `${toDateString(row.Datum)}-${row.Kostenart || "buchung"}-${index}`;
        const amount = toNumber(row.Betrag);
        return {
            id,
            guest_name: String(row.Kostenart || "Buchung"),
            checkin: toDateString(row.Datum),
            checkout: toDateString(row.Datum),
            gross_amount: Math.abs(amount),
            fees_total: 0,
            net_amount: amount,
            payout_amount: amount,
            category: String(row.Kostenart || ""),
            date: toDateString(row.Datum),
            amount,
            note: String(row.Buchungskonto || ""),
            account: String(row.Buchungskonto || ""),
            cumulative: toNumber(row.Kumuliert),
        };
    });
}

function buildSummaryFromMonatswerte(monatRows, alleBuchungen) {
    const { year, month } = currentYearMonth();

    const thisMonth = monatRows.filter((row) => {
        return Number(row.Jahr) === year && Number(row.Monat) === month;
    });

    const month_income = thisMonth.reduce((sum, row) => sum + toNumber(row.Einnahmen), 0);
    const month_expenses = thisMonth.reduce((sum, row) => sum + toNumber(row.Ausgaben), 0);
    const month_profit = thisMonth.reduce((sum, row) => sum + toNumber(row.Monatsdifferenz), 0);

    const expenses = alleBuchungen
        .filter((row) => toNumber(row.amount) < 0)
        .map((row) => ({
            id: row.id,
            category: row.category,
            date: row.date,
            amount: Math.abs(toNumber(row.amount)),
            note: row.note,
        }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return {
        month_income,
        month_expenses,
        month_profit,
        open_payments: 0,
        expenses,
    };
}

function buildEuerFromMonatswerte(monatRows) {
    const { year, month } = currentYearMonth();
    const monthRows = monatRows.filter((row) => Number(row.Jahr) === year && Number(row.Monat) === month);
    const yearRows = monatRows.filter((row) => Number(row.Jahr) === year);

    return {
        month_income: monthRows.reduce((sum, row) => sum + toNumber(row.Einnahmen), 0),
        month_expenses: monthRows.reduce((sum, row) => sum + toNumber(row.Ausgaben), 0),
        month_profit: monthRows.reduce((sum, row) => sum + toNumber(row.Monatsdifferenz), 0),
        year_income: yearRows.reduce((sum, row) => sum + toNumber(row.Einnahmen), 0),
        year_expenses: yearRows.reduce((sum, row) => sum + toNumber(row.Ausgaben), 0),
        year_profit: yearRows.reduce((sum, row) => sum + toNumber(row.Monatsdifferenz), 0),
    };
}

function asQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            query.set(key, String(value));
        }
    });
    const encoded = query.toString();
    return encoded ? `?${encoded}` : "";
}

export function health() {
    if (isSheetMode()) {
        return requestSheetJson("Monatswerte").then(() => ({ ok: true }));
    }
    if (isAppsScriptBackend()) {
        return requestAppsScript("health");
    }
    return request("/health");
}

export async function getBookings(params = {}) {
    if (isSheetMode()) {
        return getEditableBookingsFromSourceSheets();
    }
    if (isAppsScriptBackend()) {
        const rows = await requestAppsScript("getEditableBookings", params);
        return Array.isArray(rows) ? rows : [];
    }
    return request(`/bookings${asQuery(params)}`);
}

export async function updateBooking(booking) {
    if (isSheetMode()) {
        return updateBookingInSourceSheet(booking);
    }
    if (isAppsScriptBackend()) {
        return requestAppsScriptPost("updateEditableBooking", { booking });
    }
    throw new Error("Buchungsbearbeitung wird fuer dieses Backend nicht unterstuetzt.");
}

async function getEditableBookingsFromSourceSheets() {
    const [fixRows, manualRows, transferRows] = await Promise.all([
        requestSheetJson("Fixkosten"),
        requestSheetJson("Manuelle_Buchungen"),
        requestSheetJson("Umbuchungen"),
    ]);

    const fix = fixRows.map((row) => {
        const amount = Math.abs(toNumber(getField(row, ["Betrag"])));
        const start = normalizeDateForInput(getField(row, ["Startdatum"]));
        const end = normalizeDateForInput(getField(row, ["Enddatum"])) || start;
        return {
            id: `fixkosten:${row.__row}`,
            booking_type: "fixkosten",
            source_sheet: "Fixkosten",
            source_row: row.__row,
            guest_name: String(getField(row, ["Kostenart"]) || "Fixkosten"),
            checkin: start,
            checkout: end,
            gross_amount: amount,
            fees_total: 0,
            net_amount: -amount,
            payout_amount: -amount,
            date: start,
            note: String(getField(row, ["Buchungstext-Abgleich", "BuchungstextAbgleich"]) || ""),
            account: String(getField(row, ["Buchungskonto"]) || ""),
            raw: {
                kostenart: String(getField(row, ["Kostenart"]) || ""),
                kategorie: String(getField(row, ["Kategorie"]) || ""),
                betrag: amount,
                startdatum: start,
                enddatum: end,
                buchungstextabgleich: String(getField(row, ["Buchungstext-Abgleich", "BuchungstextAbgleich"]) || ""),
                wertstellungstag: String(getField(row, ["Wertstellungstag"]) || ""),
                intervall: String(getField(row, ["Intervall"]) || ""),
                buchungskonto: String(getField(row, ["Buchungskonto"]) || ""),
            },
        };
    });

    const manual = manualRows.map((row) => {
        const date = normalizeDateForInput(getField(row, ["Datum"]));
        const amount = toNumber(getField(row, ["Betrag"]));
        return {
            id: `manual:${row.__row}`,
            booking_type: "manual",
            source_sheet: "Manuelle_Buchungen",
            source_row: row.__row,
            guest_name: String(getField(row, ["Kostenart"]) || "Manuelle Buchung"),
            checkin: date,
            checkout: date,
            gross_amount: Math.abs(amount),
            fees_total: 0,
            net_amount: amount,
            payout_amount: amount,
            date,
            note: String(getField(row, ["Buchungstext"]) || ""),
            account: String(getField(row, ["Buchungskonto"]) || ""),
            raw: {
                kostenart: String(getField(row, ["Kostenart"]) || ""),
                buchungstext: String(getField(row, ["Buchungstext"]) || ""),
                buchungskonto: String(getField(row, ["Buchungskonto"]) || ""),
                datum: date,
                betrag: amount,
            },
        };
    });

    const transfer = transferRows.map((row) => {
        const date = normalizeDateForInput(getField(row, ["Datum"]));
        const amount = Math.abs(toNumber(getField(row, ["Betrag"])));
        return {
            id: `transfer:${row.__row}`,
            booking_type: "transfer",
            source_sheet: "Umbuchungen",
            source_row: row.__row,
            guest_name: String(getField(row, ["Text"]) || "Umbuchung"),
            checkin: date,
            checkout: date,
            gross_amount: amount,
            fees_total: 0,
            net_amount: 0,
            payout_amount: 0,
            date,
            note: String(getField(row, ["Text"]) || ""),
            account: `${String(getField(row, ["Von"]) || "")} -> ${String(getField(row, ["Nach"]) || "")}`,
            raw: {
                datum: date,
                von: String(getField(row, ["Von"]) || ""),
                nach: String(getField(row, ["Nach"]) || ""),
                betrag: amount,
                text: String(getField(row, ["Text"]) || ""),
            },
        };
    });

    return [...fix, ...manual, ...transfer].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function getField(row, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            return row[key];
        }
    }
    return null;
}

async function updateBookingInSourceSheet(booking) {
    const id = String(booking.id || "");
    const [type, rowText] = id.split(":");
    const row = Number(rowText);
    if (!type || !row || Number.isNaN(row) || row < 2) {
        throw new Error("Ungueltige Buchungs-ID fuer Bearbeitung.");
    }

    if (type === "fixkosten") {
        return updateSheetRow("Fixkosten", row, [
            String(booking.kostenart || ""),
            String(booking.kategorie || ""),
            Math.abs(toNumber(booking.betrag)),
            String(booking.startdatum || ""),
            String(booking.enddatum || ""),
            String(booking.buchungstextabgleich || ""),
            String(booking.wertstellungstag || ""),
            String(booking.intervall || ""),
            String(booking.buchungskonto || ""),
        ]);
    }

    if (type === "manual") {
        return updateSheetRow("Manuelle_Buchungen", row, [
            String(booking.kostenart || ""),
            String(booking.buchungstext || ""),
            String(booking.buchungskonto || ""),
            String(booking.datum || ""),
            toNumber(booking.betrag),
        ]);
    }

    if (type === "transfer") {
        return updateSheetRow("Umbuchungen", row, [
            String(booking.datum || ""),
            String(booking.von || ""),
            String(booking.nach || ""),
            Math.abs(toNumber(booking.betrag)),
            String(booking.text || ""),
        ]);
    }

    throw new Error("Diese Buchungsart kann nicht bearbeitet werden.");
}

async function updateSheetRow(sheetName, row, values) {
    const { spreadsheetId } = readConfig();
    const accessToken = getGoogleAccessToken();
    if (!spreadsheetId || !accessToken) {
        throw new Error("Spreadsheet ID oder Google Auth fehlen.");
    }

    const lastCol = String.fromCharCode("A".charCodeAt(0) + values.length - 1);
    const range = `${sheetName}!A${row}:${lastCol}${row}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            range,
            majorDimension: "ROWS",
            values: [values],
        }),
    });

    if (!response.ok) {
        let detail = "";
        try {
            const payload = await response.json();
            detail =
                payload?.error?.message ||
                payload?.error?.status ||
                "";
        } catch {
            try {
                detail = await response.text();
            } catch {
                detail = "";
            }
        }

        if (response.status === 403) {
            throw new Error(
                `Buchung konnte nicht gespeichert werden (HTTP 403). Bitte Google Auth erneut ausfuehren und Schreibrechte bestaetigen. ${detail}`.trim(),
            );
        }

        throw new Error(`Buchung konnte nicht gespeichert werden (HTTP ${response.status}). ${detail}`.trim());
    }

    return { ok: true };
}

export function getBookingById(id) {
    return request(`/bookings/${encodeURIComponent(id)}`);
}

export function createExpense(data) {
    if (isSheetMode()) {
        return createExpenseInSheet(data);
    }
    if (isAppsScriptBackend()) {
        return requestAppsScriptPost("createExpense", { expense: data });
    }
    return request("/expenses", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

async function createExpenseInSheet(data = {}) {
    const date = String(data.date || "").trim();
    const category = String(data.category || "").trim() || "Sonstiges";
    const note = String(data.note || "").trim();
    const amount = Math.abs(toNumber(data.amount));

    if (!date) {
        throw new Error("Bitte ein gueltiges Datum fuer die Ausgabe eingeben.");
    }
    if (!(amount > 0)) {
        throw new Error("Bitte einen gueltigen Betrag fuer die Ausgabe eingeben.");
    }

    return appendSheetRow("Manuelle_Buchungen", [
        category,
        note || `Ausgabe ${category}`,
        "Ausgaben",
        date,
        -amount,
    ]);
}

async function appendSheetRow(sheetName, values) {
    const { spreadsheetId } = readConfig();
    const accessToken = getGoogleAccessToken();
    if (!spreadsheetId || !accessToken) {
        throw new Error("Spreadsheet ID oder Google Auth fehlen.");
    }

    const range = `${sheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            range,
            majorDimension: "ROWS",
            values: [values],
        }),
    });

    if (!response.ok) {
        let detail = "";
        try {
            const payload = await response.json();
            detail =
                payload?.error?.message ||
                payload?.error?.status ||
                "";
        } catch {
            try {
                detail = await response.text();
            } catch {
                detail = "";
            }
        }

        if (response.status === 403) {
            throw new Error(
                `Ausgabe konnte nicht gespeichert werden (HTTP 403). Bitte Google Auth erneut ausfuehren und Schreibrechte bestaetigen. ${detail}`.trim(),
            );
        }

        throw new Error(`Ausgabe konnte nicht gespeichert werden (HTTP ${response.status}). ${detail}`.trim());
    }

    return { ok: true };
}

export function updateExpense(id, data) {
    if (isSheetMode()) {
        throw new Error("Ausgaben aendern ist im reinen Sheet-Modus nicht verfuegbar.");
    }
    if (isAppsScriptBackend()) {
        throw new Error("Expense Update ist fuer Apps Script aktuell nicht implementiert.");
    }
    return request(`/expenses/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export function deleteExpense(id) {
    if (isSheetMode()) {
        throw new Error("Ausgaben loeschen ist im reinen Sheet-Modus nicht verfuegbar.");
    }
    if (isAppsScriptBackend()) {
        throw new Error("Expense Delete ist fuer Apps Script aktuell nicht implementiert.");
    }
    return request(`/expenses/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

export async function getPayments(params = {}) {
    if (isSheetMode()) {
        return [];
    }
    if (isAppsScriptBackend()) {
        return requestAppsScript("getPayments", params);
    }
    return request(`/payments${asQuery(params)}`);
}

export async function getSummary(params = {}) {
    if (isSheetMode()) {
        const [monatRows, buchungRows] = await Promise.all([
            requestSheetJson("Monatswerte"),
            requestSheetJson("AlleBuchungenPlan"),
        ]);
        const normalizedBuchungen = normalizeAlleBuchungenRows(buchungRows);
        return buildSummaryFromMonatswerte(monatRows, normalizedBuchungen);
    }
    if (isAppsScriptBackend()) {
        return requestAppsScript("getSummary", params);
    }
    return request(`/summary${asQuery(params)}`);
}

export async function getEuer(params = {}) {
    if (isSheetMode()) {
        const monatRows = await requestSheetJson("Monatswerte");
        return buildEuerFromMonatswerte(monatRows);
    }
    if (isAppsScriptBackend()) {
        return requestAppsScript("getEuer", params);
    }
    return request(`/euer${asQuery(params)}`);
}

export async function getMonatswerte(params = {}) {
    if (isSheetMode()) {
        return requestSheetJson("Monatswerte");
    }
    if (isAppsScriptBackend()) {
        return requestAppsScript("getMonatswerte", params);
    }
    return request(`/monatswerte${asQuery(params)}`);
}

export async function getMonthlyDetails(params = {}) {
    if (isSheetMode()) {
        const rows = await requestSheetJson("AlleBuchungenPlan");
        return normalizeAlleBuchungenRows(rows);
    }
    if (isAppsScriptBackend()) {
        try {
            const rows = await requestAppsScript("getAlleBuchungenPlan", params);
            if (Array.isArray(rows)) {
                return normalizeAlleBuchungenRows(rows);
            }
        } catch {
            const fallback = await requestAppsScript("getEditableBookings", params);
            return Array.isArray(fallback) ? fallback : [];
        }
    }
    return request(`/bookings${asQuery(params)}`);
}

export async function exportCsv(params = {}) {
    if (isSheetMode()) {
        const rows = await requestSheetJson("Monatswerte");
        if (!rows.length) {
            throw new Error("Spreadsheet ID fehlt. CSV Export nicht moeglich.");
        }

        const headers = Object.keys(rows[0]).filter((key) => key !== "__row");
        const csvLines = [
            headers.join(";"),
            ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(";")),
        ];
        return new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8" });
    }

    const { appToken } = readConfig();
    const headers = appToken ? { APP_TOKEN: appToken } : {};
    let response;
    try {
        response = await fetch(buildUrl(`/export/csv${asQuery(params)}`), { headers });
    } catch (error) {
        throw new Error(buildFetchNetworkErrorMessage("backend", error));
    }
    if (!response.ok) {
        throw new Error(`CSV Export fehlgeschlagen (${response.status})`);
    }
    return response.blob();
}

function csvCell(value) {
    const text = String(value ?? "");
    if (text.includes(";") || text.includes("\n") || text.includes('"')) {
        return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
}

export function importLodgify(data = {}) {
    return request("/lodgify/import", {
        method: "POST",
        body: JSON.stringify(data),
    });
}
