import { patchState } from "./state.js";

const ROUTES = ["dashboard", "expenses", "bookings", "reports"];

export function initRouter() {
    const fromHash = location.hash.replace("#", "");
    const route = ROUTES.includes(fromHash) ? fromHash : "dashboard";
    setRoute(route, false);

    window.addEventListener("hashchange", () => {
        const next = location.hash.replace("#", "");
        setRoute(ROUTES.includes(next) ? next : "dashboard", false);
    });

    document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => {
            setRoute(button.dataset.route, true);
        });
    });
}

export function setRoute(route, pushHash = true) {
    patchState({ ui: { route } });

    if (pushHash && location.hash !== `#${route}`) {
        history.pushState(null, "", `#${route}`);
    }

    document.querySelectorAll(".view").forEach((view) => {
        view.classList.toggle("active", view.dataset.view === route);
    });

    document.querySelectorAll(".tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.route === route);
    });
}
