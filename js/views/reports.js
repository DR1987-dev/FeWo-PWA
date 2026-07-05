import { formatCurrency } from "../utils/format.js";

export function renderReports(root, state) {
    const euer = state.report.euer || {};

    root.innerHTML = `
    <div class="grid">
      <article class="card">
        <div class="section-head">
          <h3>Monatsuebersicht</h3>
          <button class="ghost" id="refreshReportsBtn">Aktualisieren</button>
        </div>
        <div class="list">
          <div class="list-item"><span>Einnahmen</span><strong>${formatCurrency(euer.month_income)}</strong></div>
          <div class="list-item"><span>Ausgaben</span><strong>${formatCurrency(euer.month_expenses)}</strong></div>
          <div class="list-item"><span>Gewinn</span><strong>${formatCurrency(euer.month_profit)}</strong></div>
        </div>
      </article>

      <article class="card">
        <div class="section-head">
          <h3>Jahresuebersicht</h3>
        </div>
        <div class="list">
          <div class="list-item"><span>Einnahmen</span><strong>${formatCurrency(euer.year_income)}</strong></div>
          <div class="list-item"><span>Ausgaben</span><strong>${formatCurrency(euer.year_expenses)}</strong></div>
          <div class="list-item"><span>Gewinn</span><strong>${formatCurrency(euer.year_profit)}</strong></div>
        </div>
      </article>

      <article class="card">
        <div class="section-head">
          <h3>Export</h3>
        </div>
        <p class="helper">CSV fuer WISO EUEr direkt aus dem Backend exportieren.</p>
        <button id="exportCsvBtn">CSV Export starten</button>
      </article>
    </div>
  `;
}
