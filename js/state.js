const listeners = new Set();

const state = {
    bookings: [],
    expenses: [],
    payments: [],
    summary: null,
    report: {
        euer: null,
        monatswerte: [],
        monthlyDetails: [],
    },
    ui: {
        route: "dashboard",
        loading: false,
        error: "",
        offline: !navigator.onLine,
        selectedBookingId: "",
        dashboardYear: "",
        dashboardMonth: "",
        dashboardAccount: "",
    },
};

export function getState() {
    return structuredClone(state);
}

export function patchState(partial) {
    Object.keys(partial).forEach((key) => {
        if (
            typeof partial[key] === "object" &&
            partial[key] !== null &&
            !Array.isArray(partial[key])
        ) {
            state[key] = { ...state[key], ...partial[key] };
            return;
        }
        state[key] = partial[key];
    });
    listeners.forEach((listener) => listener(getState()));
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
