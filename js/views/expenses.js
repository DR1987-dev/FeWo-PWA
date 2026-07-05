import { formatCurrency, formatDate } from "../utils/format.js";

const CATEGORIES = [
    "Reinigung",
    "Instandhaltung",
    "Versicherung",
    "Strom",
    "Internet",
    "Sonstiges",
];

export function renderExpenses(root, state) {
    const expenses = state.expenses || [];

    root.innerHTML = `
    <div class="grid">
      <article class="card">
        <div class="section-head">
          <h3>Neue Ausgabe</h3>
        </div>
        <form id="expenseForm">
          <label>
            Datum
            <input name="date" type="date" required />
          </label>
          <label>
            Kategorie
            <select name="category" required>
              ${CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}
            </select>
          </label>
          <label>
            Betrag (EUR)
            <input name="amount" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Steuer in %
            <input name="tax_rate" type="number" min="0" step="0.1" value="0" />
          </label>
          <label>
            Beschreibung
            <input name="note" type="text" maxlength="200" />
          </label>
          <label>
            Beleg (optional)
            <input name="receipt" type="file" accept="image/*,.pdf" />
          </label>
          <button type="submit">Ausgabe speichern</button>
        </form>
      </article>

      <article class="card">
        <div class="section-head">
          <h3>Letzte Ausgaben</h3>
        </div>
        <div class="list">
          ${expenses.length
            ? expenses
                .slice(0, 20)
                .map(
                    (item) => `
                      <div class="list-item" data-expense-id="${item.id || ""}">
                        <div>
                          <strong>${item.category || "Unkategorisiert"}</strong>
                          <p class="helper">${formatDate(item.date)} | ${item.note || "-"}</p>
                        </div>
                        <div>${formatCurrency(item.amount)}</div>
                      </div>
                    `,
                )
                .join("")
            : "<p class=\"helper\">Noch keine Ausgaben vorhanden.</p>"
        }
        </div>
      </article>
    </div>
  `;
}

export async function parseExpenseForm(formElement) {
    const data = new FormData(formElement);
    const payload = {
        date: data.get("date"),
        category: data.get("category"),
        amount: Number(data.get("amount")),
        tax_rate: Number(data.get("tax_rate") || 0),
        note: String(data.get("note") || ""),
    };

    const receipt = data.get("receipt");
    if (receipt && typeof receipt === "object" && receipt.size > 0) {
        payload.receipt_name = receipt.name;
        payload.receipt_mime = receipt.type;
        payload.receipt_base64 = await fileToBase64(receipt);
    }

    return payload;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
        reader.onload = () => {
            const result = String(reader.result || "");
            const [, base64] = result.split(",");
            resolve(base64 || "");
        };
        reader.readAsDataURL(file);
    });
}
