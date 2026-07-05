import { formatCurrency, formatDate } from "../utils/format.js";

export function renderBookings(root, state) {
    const bookings = state.bookings || [];

    root.innerHTML = `
    <div class="grid">
      <article class="card">
        <div class="section-head">
          <h3>Buchungen</h3>
          <button class="ghost" id="refreshBookingsBtn">Aktualisieren</button>
        </div>
        <div class="list">
          ${bookings.length
            ? bookings
                .map(
                    (booking) => `
                      <button class="list-item ghost ${String(booking.id) === String(state.ui.selectedBookingId) ? "selected" : ""}" data-booking-id="${booking.id}">
                        <div>
                          <strong>${booking.guest_name || "Buchung"}</strong>
                          <p class="helper">${formatDate(booking.checkin)} - ${formatDate(booking.checkout)}</p>
                          <p class="helper">Typ: ${typeLabel(booking.booking_type)}</p>
                        </div>
                        <div>${formatCurrency(booking.gross_amount)}</div>
                      </button>
                    `,
                )
                .join("")
            : "<p class=\"helper\">Keine Buchungen gefunden.</p>"
        }
        </div>
      </article>
    </div>
  `;
}

export function renderBookingDialogContent(booking) {
    return `
      <form id="bookingEditForm" method="dialog" data-booking-id="${booking.id}" data-booking-type="${booking.booking_type || ""}">
        <h3>${escapeHtml(booking.guest_name || "Buchung")}</h3>
        <p class="helper">${formatDate(booking.checkin)} - ${formatDate(booking.checkout)} | Typ: ${typeLabel(booking.booking_type)}</p>
        <p><strong>Einnahmen:</strong> ${formatCurrency(booking.gross_amount)}</p>
        <p><strong>Gebuehren:</strong> ${formatCurrency(booking.fees_total)}</p>
        <p><strong>Netto:</strong> ${formatCurrency(booking.net_amount)}</p>
        <p><strong>Auszahlung:</strong> ${formatCurrency(booking.payout_amount)}</p>
        ${renderBookingEditor(booking)}
        <menu>
          <button type="button" value="cancel" class="ghost" id="closeBookingDialogBtn">Schliessen</button>
          ${booking.booking_type ? '<button type="submit">Aenderungen speichern</button>' : ""}
        </menu>
      </form>
    `;
}

function typeLabel(type) {
    if (type === "fixkosten") return "Fixkosten";
    if (type === "manual") return "Manuell";
    if (type === "transfer") return "Umbuchung";
    return "Abgeleitet";
}

function renderBookingEditor(booking) {
    if (!booking.booking_type) {
        return "<p class=\"helper\">Diese Buchung ist abgeleitet und nicht direkt editierbar. Bearbeite stattdessen die Quell-Eintraege (Fixkosten, Manuelle_Buchungen, Umbuchungen).</p>";
    }

    if (booking.booking_type === "fixkosten") {
        return `
          <hr />
          <h4>Fixkosten bearbeiten</h4>
            <label>Kostenart<input name="kostenart" value="${escapeHtml(booking.raw?.kostenart || "")}" required /></label>
            <label>Kategorie<input name="kategorie" value="${escapeHtml(booking.raw?.kategorie || "")}" /></label>
            <label>Betrag (EUR)<input name="betrag" type="number" min="0" step="0.01" value="${Number(booking.raw?.betrag || 0)}" required /></label>
            <label>Startdatum<input name="startdatum" type="date" value="${escapeHtml(booking.raw?.startdatum || "")}" required /></label>
            <label>Enddatum<input name="enddatum" type="date" value="${escapeHtml(booking.raw?.enddatum || "")}" /></label>
            <label>Buchungstext Abgleich<input name="buchungstextabgleich" value="${escapeHtml(booking.raw?.buchungstextabgleich || "")}" /></label>
            <label>Wertstellungstag<input name="wertstellungstag" type="number" min="1" max="31" value="${escapeHtml(booking.raw?.wertstellungstag || "")}" /></label>
            <label>Intervall
              <select name="intervall">
                ${option("monat", booking.raw?.intervall)}
                ${option("quartal", booking.raw?.intervall)}
                ${option("jahr", booking.raw?.intervall)}
              </select>
            </label>
            <label>Buchungskonto<input name="buchungskonto" value="${escapeHtml(booking.raw?.buchungskonto || "")}" required /></label>
        `;
    }

    if (booking.booking_type === "manual") {
        return `
          <hr />
          <h4>Manuelle Buchung bearbeiten</h4>
            <label>Kostenart<input name="kostenart" value="${escapeHtml(booking.raw?.kostenart || "")}" required /></label>
            <label>Buchungstext<input name="buchungstext" value="${escapeHtml(booking.raw?.buchungstext || "")}" /></label>
            <label>Buchungskonto<input name="buchungskonto" value="${escapeHtml(booking.raw?.buchungskonto || "")}" required /></label>
            <label>Datum<input name="datum" type="date" value="${escapeHtml(booking.raw?.datum || "")}" required /></label>
            <label>Betrag (EUR, +/-)<input name="betrag" type="number" step="0.01" value="${Number(booking.raw?.betrag || 0)}" required /></label>
        `;
    }

    if (booking.booking_type === "transfer") {
        return `
          <hr />
          <h4>Umbuchung bearbeiten</h4>
            <label>Datum<input name="datum" type="date" value="${escapeHtml(booking.raw?.datum || "")}" required /></label>
            <label>Von Konto<input name="von" value="${escapeHtml(booking.raw?.von || "")}" required /></label>
            <label>Nach Konto<input name="nach" value="${escapeHtml(booking.raw?.nach || "")}" required /></label>
            <label>Betrag (EUR)<input name="betrag" type="number" min="0" step="0.01" value="${Number(booking.raw?.betrag || 0)}" required /></label>
            <label>Text<input name="text" value="${escapeHtml(booking.raw?.text || "")}" /></label>
        `;
    }

    return "<p class=\"helper\">Diese Buchungsart kann nicht bearbeitet werden.</p>";
}

function option(value, selectedValue) {
    const selected = String(selectedValue || "").toLowerCase() === value ? "selected" : "";
    return `<option value="${value}" ${selected}>${value}</option>`;
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function parseBookingEditForm(formElement) {
    const data = new FormData(formElement);
    const bookingType = String(formElement.dataset.bookingType || "");
    const id = String(formElement.dataset.bookingId || "");

    if (bookingType === "fixkosten") {
        return {
            id,
            kostenart: String(data.get("kostenart") || ""),
            kategorie: String(data.get("kategorie") || ""),
            betrag: Number(data.get("betrag") || 0),
            startdatum: String(data.get("startdatum") || ""),
            enddatum: String(data.get("enddatum") || ""),
            buchungstextabgleich: String(data.get("buchungstextabgleich") || ""),
            wertstellungstag: String(data.get("wertstellungstag") || ""),
            intervall: String(data.get("intervall") || ""),
            buchungskonto: String(data.get("buchungskonto") || ""),
        };
    }

    if (bookingType === "manual") {
        return {
            id,
            kostenart: String(data.get("kostenart") || ""),
            buchungstext: String(data.get("buchungstext") || ""),
            buchungskonto: String(data.get("buchungskonto") || ""),
            datum: String(data.get("datum") || ""),
            betrag: Number(data.get("betrag") || 0),
        };
    }

    if (bookingType === "transfer") {
        return {
            id,
            datum: String(data.get("datum") || ""),
            von: String(data.get("von") || ""),
            nach: String(data.get("nach") || ""),
            betrag: Number(data.get("betrag") || 0),
            text: String(data.get("text") || ""),
        };
    }

    throw new Error("Diese Buchungsart kann nicht bearbeitet werden.");
}
