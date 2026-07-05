import { formatCurrency } from "../utils/format.js";

export function renderDashboard(root, state) {
    const summary = state.summary || {};
    const monatswerte = Array.isArray(state.report?.monatswerte) ? state.report.monatswerte : [];
    const bookings = Array.isArray(state.bookings) ? state.bookings : [];
    const monthlyDetails = Array.isArray(state.report?.monthlyDetails) ? state.report.monthlyDetails : [];

    const byAccount = buildAccountRows(monatswerte).slice(0, 8);
    const latest = [...bookings]
        .sort((a, b) => String(b.date || b.checkin || "").localeCompare(String(a.date || a.checkin || "")))
        .slice(0, 8);

    const years = [...new Set(monatswerte.map((row) => Number(row.Jahr || row.jahr || 0)).filter(Boolean))].sort((a, b) => b - a);
    const months = [
        "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember",
    ];
    const accounts = [...new Set(monatswerte.map((row) => String(row.Buchungskonto || row.buchungskonto || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const selectedYear = Number(state.ui?.dashboardYear || years[0] || new Date().getFullYear());
    const availableMonths = buildAvailableMonths(monatswerte, selectedYear);
    const selectedMonth = Number(state.ui?.dashboardMonth || availableMonths[availableMonths.length - 1] || new Date().getMonth() + 1);
    const selectedAccount = String(state.ui?.dashboardAccount || "");
    const kontoOverviewRows = buildKontoOverviewRows(monatswerte, selectedYear, selectedAccount);
    const detailSource = monthlyDetails.length ? monthlyDetails : bookings;
    const monthDetailRows = buildSingleMonthDetailRows(detailSource, selectedYear, selectedMonth, selectedAccount);

    root.innerHTML = `
    <div class="grid dashboard-grid">
      <div class="cards">
        ${metricCard("Einnahmen (Monat)", summary.month_income)}
        ${metricCard("Ausgaben (Monat)", summary.month_expenses)}
        ${metricCard("Gewinn", summary.month_profit)}
        ${metricCard("Offene Zahlungen", summary.open_payments)}
      </div>

      <article class="card panel-wide">
        <div class="section-head">
          <h3>Monatsdetails</h3>
          <button class="ghost" id="refreshDashboardBtn">Aktualisieren</button>
        </div>
        <div class="dashboard-filters">
          <label>
            Jahr
            <select id="dashboardYearFilter">
              ${years.map((year) => `<option value="${year}" ${year === selectedYear ? "selected" : ""}>${year}</option>`).join("")}
            </select>
          </label>
          <label>
            Monat
            <select id="dashboardMonthFilter">
              ${availableMonths.map((month) => `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${months[month - 1] || month}</option>`).join("")}
            </select>
          </label>
          <label>
            Buchungskonto
            <select id="dashboardAccountFilter">
              <option value="">Alle Konten</option>
              ${accounts.map((konto) => `<option value="${escapeHtml(konto)}" ${konto === selectedAccount ? "selected" : ""}>${escapeHtml(konto)}</option>`).join("")}
            </select>
          </label>
        </div>

        ${monthDetailRows.length ? `
          <div class="konto-table-wrap">
            <table class="konto-table monthly-detail-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Datum</th>
                  <th>Kostenart</th>
                  <th>Betrag</th>
                </tr>
              </thead>
              <tbody>
                ${monthDetailRows.map((row, index) => `
                  <tr>
                    <td>${index + 1}.</td>
                    <td>${escapeHtml(row.dateLabel)}</td>
                    <td>${escapeHtml(row.label)}</td>
                    <td class="${row.amount < 0 ? "amount-neg" : "amount-pos"}">${formatCurrency(row.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="helper">Keine Buchungen fuer den gewaehlten Monat gefunden.</p>`}
      </article>

      <article class="card">
        <div class="section-head">
          <h3>Konto-Matrix</h3>
        </div>
        ${byAccount.length ? `
          <div class="matrix">
            ${byAccount
                .map(
                    (row) => `
                      <div class="matrix-row">
                        <span class="name">${escapeHtml(row.konto)}</span>
                        <span>${formatCurrency(row.einnahmen)}</span>
                        <span>${formatCurrency(row.ausgaben)}</span>
                        <strong>${formatCurrency(row.diff)}</strong>
                      </div>
                    `,
                )
                .join("")}
          </div>
          <p class="helper">Spalten: Einnahmen, Ausgaben, Differenz</p>
        ` : `<p class="helper">Keine Kontowerte vorhanden.</p>`}
      </article>

      <article class="card">
        <div class="section-head">
          <h3>Letzte Buchungen</h3>
        </div>
        ${latest.length ? `
          <div class="matrix">
            ${latest
                .map(
                    (item) => `
                      <div class="matrix-row compact">
                        <span class="name">${escapeHtml(item.guest_name || item.category || "Buchung")}</span>
                        <span>${escapeHtml(String(item.date || item.checkin || "-"))}</span>
                        <strong>${formatCurrency(item.net_amount ?? item.amount ?? 0)}</strong>
                      </div>
                    `,
                )
                .join("")}
          </div>
        ` : `<p class="helper">Noch keine Buchungen geladen.</p>`}
      </article>

      <article class="card panel-wide">
        <div class="section-head">
          <h3>Kontoübersicht</h3>
        </div>
        ${kontoOverviewRows.length ? `
          <div class="konto-table-wrap">
            <table class="konto-table">
              <thead>
                <tr>
                  <th>Monatsname</th>
                  <th>Monatsstartwert</th>
                  <th>Einnahmen</th>
                  <th>Ausgaben</th>
                  <th>Monatsendwert</th>
                  <th>Monatsdifferenz</th>
                </tr>
              </thead>
              <tbody>
                ${kontoOverviewRows.map((row) => `
                  <tr>
                    <td>${row.monatsname}</td>
                    <td>${formatCurrency(row.monatsstartwert)}</td>
                    <td>${formatCurrency(row.einnahmen)}</td>
                    <td>${formatCurrency(row.ausgaben)}</td>
                    <td>${formatCurrency(row.monatsendwert)}</td>
                    <td>${formatCurrency(row.monatsdifferenz)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="helper">Keine Daten fuer die aktuelle Filterkombination.</p>`}
      </article>
    </div>
  `;
}

function metricCard(label, value) {
    return `
    <article class="card">
      <p class="metric-label">${label}</p>
      <p class="metric-value">${formatCurrency(value)}</p>
    </article>
  `;
}

function buildAccountRows(monatswerte) {
    const map = new Map();
    monatswerte.forEach((row) => {
        const konto = String(row.Buchungskonto || row.buchungskonto || "Unbekannt");
        const prev = map.get(konto) || { konto, einnahmen: 0, ausgaben: 0, diff: 0 };
        prev.einnahmen += toNumber(row.Einnahmen || row.einnahmen);
        prev.ausgaben += toNumber(row.Ausgaben || row.ausgaben);
        prev.diff += toNumber(row.Monatsdifferenz || row.monatsdifferenz || 0);
        map.set(konto, prev);
    });

    return [...map.values()].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = String(value ?? "").trim().replace(/\s/g, "");
    if (!raw) return 0;

    let normalized = raw;
    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");
    if (hasComma && hasDot) {
        normalized = raw.lastIndexOf(",") > raw.lastIndexOf(".")
            ? raw.replace(/\./g, "").replace(/,/g, ".")
            : raw.replace(/,/g, "");
    } else if (hasComma) {
        normalized = raw.replace(/,/g, ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function buildKontoOverviewRows(monatswerte, selectedYear, selectedAccount) {
    const monthNames = [
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember",
    ];

    const filtered = monatswerte.filter((row) => {
        const year = Number(row.Jahr || row.jahr || 0);
        const account = String(row.Buchungskonto || row.buchungskonto || "").trim();
        if (year !== Number(selectedYear)) return false;
        if (selectedAccount && account !== selectedAccount) return false;
        return true;
    });

    const byMonth = new Map();
    filtered.forEach((row) => {
        const month = Number(row.Monat || row.monat || 0);
        if (!month) return;
        const prev = byMonth.get(month) || {
            monat: month,
            monatsname: monthNames[month - 1] || String(month),
            monatsstartwert: 0,
            einnahmen: 0,
            ausgaben: 0,
            monatsendwert: 0,
            monatsdifferenz: 0,
        };
        prev.monatsstartwert += toNumber(row.Monatsstartwert || row.monatsstartwert);
        prev.einnahmen += toNumber(row.Einnahmen || row.einnahmen);
        prev.ausgaben += toNumber(row.Ausgaben || row.ausgaben);
        prev.monatsendwert += toNumber(row.Monatsendwert || row.monatsendwert);
        prev.monatsdifferenz += toNumber(row.Monatsdifferenz || row.monatsdifferenz);
        byMonth.set(month, prev);
    });

    return [...byMonth.values()].sort((a, b) => a.monat - b.monat);
}

function buildAvailableMonths(monatswerte, selectedYear) {
    return [...new Set(
        monatswerte
            .filter((row) => Number(row.Jahr || row.jahr || 0) === Number(selectedYear))
            .map((row) => Number(row.Monat || row.monat || 0))
            .filter((month) => month >= 1 && month <= 12),
    )].sort((a, b) => a - b);
}

function buildSingleMonthDetailRows(bookings, selectedYear, selectedMonth, selectedAccount) {
    return bookings
        .map((booking) => normalizeBookingForMonth(booking))
        .filter(Boolean)
        .filter((row) => row.year === Number(selectedYear) && row.month === Number(selectedMonth))
        .filter((row) => {
            if (!selectedAccount) return true;
            return String(row.account || "").trim() === selectedAccount;
        })
        .sort((a, b) => (a.dateIso > b.dateIso ? -1 : 1));
}

function normalizeBookingForMonth(booking) {
    const date = readBookingDate(booking);
    if (!date) return null;

    const account = String(
        booking.buchungskonto || booking.account || booking.raw?.buchungskonto || booking.raw?.von || booking.raw?.nach || "",
    ).trim();

    const amount = toNumber(booking.net_amount ?? booking.amount ?? booking.gross_amount ?? booking.raw?.betrag ?? 0);

    return {
        year: date.year,
        month: date.month,
        dateIso: `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
        dateLabel: formatDateLabel(date),
        label: booking.guest_name || booking.category || booking.raw?.kostenart || booking.raw?.buchungstext || "Buchung",
        account,
        typeLabel: booking.booking_type || "standard",
        amount,
    };
}

function formatDateLabel(date) {
    const names = ["Jan", "Feb", "Maerz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const monthLabel = names[date.month - 1] || String(date.month);
    return `${monthLabel} ${date.day}, ${date.year}`;
}

function readBookingDate(booking) {
    const candidates = [
        booking.date,
        booking.datum,
        booking.checkin,
        booking.raw?.datum,
        booking.raw?.startdatum,
    ];
    for (const value of candidates) {
        const parsed = parseFlexibleDate(value);
        if (parsed) return parsed;
    }
    return null;
}

function parseFlexibleDate(value) {
    if (!value) return null;
    const raw = String(value).trim();

    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    }

    match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
        return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
    }

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
        };
    }
    return null;
}
