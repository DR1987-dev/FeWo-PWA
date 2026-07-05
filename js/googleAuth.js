import { readConfig } from "./config.js";

const TOKEN_STORAGE_KEY = "fewo.google.oauth";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

let tokenClient = null;
let authReady = false;
let tokenState = readTokenState();

export function initGoogleAuth() {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
        authReady = false;
        return false;
    }

    const { googleClientId } = readConfig();
    if (!googleClientId) {
        authReady = false;
        tokenClient = null;
        return false;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: SHEETS_SCOPE,
        callback: (response) => {
            if (!response || !response.access_token) {
                return;
            }
            tokenState = {
                accessToken: response.access_token,
                expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
            };
            writeTokenState(tokenState);
        },
    });

    authReady = true;
    return true;
}

export function isGoogleAuthReady() {
    return authReady;
}

export function hasGoogleAccessToken() {
    return Boolean(getGoogleAccessToken());
}

export function getGoogleAccessToken() {
    if (!tokenState || !tokenState.accessToken) {
        return "";
    }
    if (Number(tokenState.expiresAt || 0) <= Date.now()) {
        clearGoogleAccessToken();
        return "";
    }
    return tokenState.accessToken;
}

export function clearGoogleAccessToken() {
    tokenState = { accessToken: "", expiresAt: 0 };
    writeTokenState(tokenState);
}

export function requestGoogleAccessToken(prompt = "consent") {
    if (!tokenClient || !authReady) {
        throw new Error("Google Auth ist nicht initialisiert. Bitte Google Client ID eintragen.");
    }

    return new Promise((resolve, reject) => {
        const originalCallback = tokenClient.callback;
        tokenClient.callback = (response) => {
            tokenClient.callback = originalCallback;
            if (!response || response.error) {
                reject(new Error(response?.error_description || response?.error || "Google Auth fehlgeschlagen."));
                return;
            }
            if (!response.access_token) {
                reject(new Error("Google Auth lieferte kein Access Token."));
                return;
            }
            tokenState = {
                accessToken: response.access_token,
                expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
            };
            writeTokenState(tokenState);
            resolve(tokenState.accessToken);
        };

        tokenClient.requestAccessToken({ prompt });
    });
}

function readTokenState() {
    try {
        const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
        if (!raw) return { accessToken: "", expiresAt: 0 };
        const parsed = JSON.parse(raw);
        return {
            accessToken: String(parsed.accessToken || ""),
            expiresAt: Number(parsed.expiresAt || 0),
        };
    } catch {
        return { accessToken: "", expiresAt: 0 };
    }
}

function writeTokenState(next) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(next));
}
