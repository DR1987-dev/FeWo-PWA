import {
    createExpense,
    exportCsv,
    getBookings,
    getEuer,
    getMonthlyDetails,
    getMonatswerte,
    getPayments,
    getSummary,
    testConnection,
    updateBooking,
} from "./api.js";
import { readConfig, writeConfig } from "./config.js";
import {
    hasGoogleAccessToken,
    initGoogleAuth,
    isGoogleAuthReady,
    requestGoogleAccessToken,
} from "./googleAuth.js";
import { initRouter } from "./router.js";
import { getState, patchState, subscribe } from "./state.js";
import { parseBookingEditForm, renderBookingDialogContent, renderBookings } from "./views/bookings.js";
import { renderDashboard } from "./views/dashboard.js";
import { parseExpenseForm, renderExpenses } from "./views/expenses.js";
import { renderReports } from "./views/reports.js";

const views = {
    dashboard: document.getElementById("view-dashboard"),
    expenses: document.getElementById("view-expenses"),
    bookings: document.getElementById("view-bookings"),
    reports: document.getElementById("view-reports"),
};

const settingsDialog = document.getElementById("settingsDialog");
const settingsForm = document.getElementById("settingsForm");
const networkBanner = document.getElementById("networkBanner");
const testConnectionBtn = document.getElementById("testConnectionBtn");
const connectionTestResult = document.getElementById("connectionTestResult");
const googleAuthBtn = document.getElementById("googleAuthBtn");
const googleAuthStatus = document.getElementById("googleAuthStatus");
const bookingDialog = document.getElementById("bookingDialog");
const bookingDialogBody = document.getElementById("bookingDialogBody");

function render(state) {
    renderDashboard(views.dashboard, state);
    renderExpenses(views.expenses, state);
    renderBookings(views.bookings, state);
    renderReports(views.reports, state);
    networkBanner.hidden = !state.ui.offline;
    bindDynamicEvents();
}

function bindDynamicEvents() {
    const expenseForm = document.getElementById("expenseForm");
    if (expenseForm) {
        expenseForm.addEventListener("submit", onExpenseSubmit, { once: true });
    }

    document.querySelectorAll("[data-booking-id]").forEach((button) => {
        button.addEventListener("click", () => {
            const bookingId = button.dataset.bookingId;
            patchState({ ui: { selectedBookingId: bookingId } });
            openBookingPopup(bookingId);
        });
    });

    const refreshDashboardBtn = document.getElementById("refreshDashboardBtn");
    if (refreshDashboardBtn) {
        refreshDashboardBtn.addEventListener("click", () => {
            loadDashboard().catch(showError);
        }, { once: true });
    }

    const dashboardYearFilter = document.getElementById("dashboardYearFilter");
    if (dashboardYearFilter) {
        dashboardYearFilter.addEventListener("change", () => {
            patchState({ ui: { dashboardYear: dashboardYearFilter.value } });
        });
    }

    const dashboardMonthFilter = document.getElementById("dashboardMonthFilter");
    if (dashboardMonthFilter) {
        dashboardMonthFilter.addEventListener("change", () => {
            patchState({ ui: { dashboardMonth: dashboardMonthFilter.value } });
        });
    }

    const dashboardAccountFilter = document.getElementById("dashboardAccountFilter");
    if (dashboardAccountFilter) {
        dashboardAccountFilter.addEventListener("change", () => {
            patchState({ ui: { dashboardAccount: dashboardAccountFilter.value } });
        });
    }

    const refreshBookingsBtn = document.getElementById("refreshBookingsBtn");
    if (refreshBookingsBtn) {
        refreshBookingsBtn.addEventListener("click", () => {
            loadBookings().catch(showError);
        }, { once: true });
    }

    const refreshReportsBtn = document.getElementById("refreshReportsBtn");
    if (refreshReportsBtn) {
        refreshReportsBtn.addEventListener("click", () => {
            loadReports().catch(showError);
        }, { once: true });
    }

    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", onExportCsv, { once: true });
    }
}

function openBookingPopup(bookingId) {
    if (!bookingDialog || !bookingDialogBody) return;

    const state = getState();
    const booking = (state.bookings || []).find((entry) => String(entry.id) === String(bookingId));
    if (!booking) return;

    bookingDialogBody.innerHTML = renderBookingDialogContent(booking);

    const closeBtn = document.getElementById("closeBookingDialogBtn");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => bookingDialog.close(), { once: true });
    }

    const bookingEditForm = document.getElementById("bookingEditForm");
    if (bookingEditForm && booking.booking_type) {
        bookingEditForm.addEventListener("submit", onBookingEditSubmit, { once: true });
    }

    bookingDialog.showModal();
}

async function onExpenseSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
        const payload = await parseExpenseForm(form);
        await createExpense(payload);
        form.reset();
        await Promise.all([loadDashboard(), loadExpenses()]);
    } catch (error) {
        showError(error);
    }
}

async function onExportCsv() {
    try {
        const blob = await exportCsv();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fewo-euer-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showError(error);
    }
}

async function onBookingEditSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
        const payload = parseBookingEditForm(form);
        await updateBooking(payload);
        if (bookingDialog) bookingDialog.close();
        await Promise.all([loadBookings(), loadDashboard(), loadReports(), loadExpenses()]);
    } catch (error) {
        showError(error);
    }
}

function showError(error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    patchState({ ui: { error: message } });
    alert(message);
}

async function loadDashboard() {
    const [summary, payments, monatswerte, monthlyDetails] = await Promise.all([
        getSummary(),
        getPayments(),
        getMonatswerte(),
        getMonthlyDetails(),
    ]);
    patchState({
        summary,
        payments,
        report: {
            monatswerte: Array.isArray(monatswerte) ? monatswerte : [],
            monthlyDetails: Array.isArray(monthlyDetails) ? monthlyDetails : [],
        },
    });
}

async function loadBookings() {
    const bookings = await getBookings();
    patchState({ bookings: Array.isArray(bookings) ? bookings : bookings.items || [] });
}

async function loadExpenses() {
    const summary = await getSummary();
    const expenses = summary.expenses || [];
    patchState({ expenses });
}

async function loadReports() {
    const euer = await getEuer();
    patchState({ report: { euer } });
}

function applyTheme(config) {
    document.documentElement.classList.toggle("dark", Boolean(config.darkMode));
}

function initSettings() {
    const config = readConfig();
    applyTheme(config);
    initGoogleAuth();

    document.getElementById("settingsButton").addEventListener("click", () => {
        const current = readConfig();
        settingsForm.dataSource.value = current.dataSource || "sheet";
        settingsForm.spreadsheetId.value = current.spreadsheetId || "";
        settingsForm.googleClientId.value = current.googleClientId || "";
        settingsForm.baseUrl.value = current.baseUrl;
        settingsForm.appToken.value = current.appToken;
        settingsForm.darkMode.checked = current.darkMode;
        renderConnectionTestStatus("", "");
        renderGoogleAuthStatus();
        settingsDialog.showModal();
    });

    if (testConnectionBtn) {
        testConnectionBtn.addEventListener("click", onTestConnectionClick);
    }

    if (googleAuthBtn) {
        googleAuthBtn.addEventListener("click", onGoogleAuthClick);
    }

    settingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const fd = new FormData(settingsForm);
        const nextDataSource = String(fd.get("dataSource") || "sheet");
        const nextSpreadsheetInput = String(fd.get("spreadsheetId") || "").trim();

        if (nextDataSource === "sheet" && !nextSpreadsheetInput) {
            showError(new Error("Bitte Spreadsheet ID oder komplette Google-Sheets-URL eintragen."));
            return;
        }

        const next = writeConfig({
            dataSource: nextDataSource,
            spreadsheetId: nextSpreadsheetInput,
            googleClientId: String(fd.get("googleClientId") || "").trim(),
            baseUrl: String(fd.get("baseUrl") || ""),
            appToken: String(fd.get("appToken") || ""),
            darkMode: fd.get("darkMode") === "on",
        });
        applyTheme(next);
        initGoogleAuth();
        renderGoogleAuthStatus();
        settingsDialog.close();
        bootstrapData().catch(showError);
    });
}

async function onGoogleAuthClick() {
    const clientIdInput = String(settingsForm.googleClientId.value || "").trim();
    if (!clientIdInput) {
        renderGoogleAuthStatus("Bitte zuerst Google OAuth Client ID eintragen.", "error");
        return;
    }

    const next = writeConfig({
        ...readConfig(),
        googleClientId: clientIdInput,
    });
    initGoogleAuth();

    if (!isGoogleAuthReady()) {
        renderGoogleAuthStatus("Google Auth SDK nicht bereit. Seite neu laden und erneut versuchen.", "error");
        return;
    }

    try {
        await requestGoogleAccessToken("consent");
        renderGoogleAuthStatus("Google Zugriff erteilt/aktualisiert.", "ok");
        if (next.dataSource === "sheet") {
            bootstrapData().catch(showError);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Google Auth fehlgeschlagen.";
        renderGoogleAuthStatus(message, "error");
    }
}

function renderGoogleAuthStatus(message, state) {
    if (!googleAuthStatus || !googleAuthBtn) return;

    const signedIn = hasGoogleAccessToken();
    googleAuthBtn.textContent = signedIn ? "Google Auth erneuern" : "Google Auth starten";

    if (message) {
        googleAuthStatus.textContent = message;
        googleAuthStatus.classList.remove("ok", "error");
        if (state) googleAuthStatus.classList.add(state);
        return;
    }

    googleAuthStatus.classList.remove("ok", "error");
    googleAuthStatus.textContent = signedIn
        ? "Google Zugriff aktiv. Bei Rechten-Problemen: Google Auth erneuern."
        : "Noch kein Google Zugriff erteilt.";
}

async function onTestConnectionClick() {
    const fd = new FormData(settingsForm);
    const settingsInput = {
        dataSource: String(fd.get("dataSource") || "sheet"),
        spreadsheetId: String(fd.get("spreadsheetId") || "").trim(),
        baseUrl: String(fd.get("baseUrl") || "").trim(),
        appToken: String(fd.get("appToken") || "").trim(),
    };

    testConnectionBtn.disabled = true;
    renderConnectionTestStatus("Teste Verbindung...", "");

    try {
        const result = await testConnection(settingsInput);
        renderConnectionTestStatus(result.message, result.ok ? "ok" : "error");
    } catch (error) {
        const message = error instanceof Error ? error.message : "Verbindungstest fehlgeschlagen.";
        renderConnectionTestStatus(message, "error");
    } finally {
        testConnectionBtn.disabled = false;
    }
}

function renderConnectionTestStatus(message, state) {
    if (!connectionTestResult) return;
    connectionTestResult.textContent = message || "";
    connectionTestResult.classList.remove("ok", "error");
    if (state) {
        connectionTestResult.classList.add(state);
    }
}

function initNetworkListener() {
    const setOnlineState = () => patchState({ ui: { offline: !navigator.onLine } });
    window.addEventListener("online", setOnlineState);
    window.addEventListener("offline", setOnlineState);
    setOnlineState();
}

async function bootstrapData() {
    const config = readConfig();
    const hasSource =
        (config.dataSource === "sheet" && config.spreadsheetId) ||
        (config.dataSource === "backend" && config.baseUrl);

    if (!hasSource) {
        return;
    }
    await Promise.all([loadDashboard(), loadBookings(), loadExpenses(), loadReports()]);
}

function initServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    const isLocalhost =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname === "::1";

    if (isLocalhost) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => registration.unregister());
        });
        return;
    }

    navigator.serviceWorker.register("./sw.js").catch(() => {
        /* ignore registration errors in unsupported contexts */
    });
}

subscribe(render);
initRouter();
initSettings();
initNetworkListener();
initServiceWorker();
render(getState());
bootstrapData().catch(() => {
    /* initial load errors are shown when user triggers actions */
});
