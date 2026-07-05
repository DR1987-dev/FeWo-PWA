const eur = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
});

export function formatCurrency(value) {
    const numeric = Number(value || 0);
    return eur.format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatDate(value) {
    if (!value) return "-";

    let normalized = value;
    if (typeof value === "string") {
        const raw = value.trim();
        const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
        if (de) {
            const year = de[3].length === 2 ? `20${de[3]}` : de[3];
            normalized = `${year}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
        }
    }

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}
