const STORAGE_KEY = "fewo.settings";

export const defaultConfig = {
    baseUrl: "",
    spreadsheetId: "",
    googleClientId: "",
    appToken: "",
    dataSource: "sheet",
    darkMode: false,
};

export function readConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultConfig };
        const parsed = JSON.parse(raw);
        const normalizedBaseUrl = normalizeBaseUrl(parsed.baseUrl);
        const normalizedSpreadsheetId = normalizeSpreadsheetId(parsed.spreadsheetId);
        return {
            ...defaultConfig,
            ...parsed,
            baseUrl: normalizedBaseUrl,
            spreadsheetId: normalizedSpreadsheetId,
            googleClientId: String(parsed.googleClientId || "").trim(),
        };
    } catch {
        return { ...defaultConfig };
    }
}

export function writeConfig(next) {
    const normalizedSpreadsheetId = normalizeSpreadsheetId(next.spreadsheetId);
    const normalizedBaseUrl = normalizeBaseUrl(next.baseUrl);

    const normalized = {
        ...defaultConfig,
        ...next,
        baseUrl: normalizedBaseUrl,
        spreadsheetId: normalizedSpreadsheetId,
        googleClientId: String(next.googleClientId || "").trim(),
        dataSource: next.dataSource === "backend" ? "backend" : "sheet",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}

function normalizeBaseUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const converted = raw.replace(
        /^https:\/\/script\.google\.com\/a\/macros\/[^/]+\/s\//,
        "https://script.google.com/macros/s/",
    );

    return converted.replace(/\/$/, "");
}

function normalizeSpreadsheetId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
    }

    const idLike = raw.match(/^[a-zA-Z0-9-_]{20,}$/);
    if (idLike) {
        return raw;
    }

    return raw;
}
