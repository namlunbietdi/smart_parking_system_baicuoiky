// public/js/dashboard.js
// Dashboard interaction script (full).
// - Toggle active state for the three big menu cards
// - Click on "control" card redirects to /control.html
// - Keyboard accessible (Enter/Space) for cards
// - Exports no globals

document.addEventListener('DOMContentLoaded', () => {
    const cards = Array.from(document.querySelectorAll('.menu-card'));

    if (!cards.length) return;

    function setActive(selected) {
        cards.forEach(c => {
            const isActive = c === selected;
            c.classList.toggle('active', isActive);
            c.setAttribute('aria-selected', isActive ? 'true' : 'false');
            // ensure focus outline for keyboard users
            if (isActive) c.focus?.();
        });
    }

    function handleCardActivation(card) {
        const view = card.dataset.view;
        if (view === 'control') {
            // Navigate to control page (uses static control.html)
            // Change to '/control' if you add a server route handling that path.
            window.location.href = '/control.html';
            return;
        }

        // For other views just mark active (UI-only in this file)
        setActive(card);

        // Optionally you can add callbacks here to fetch & render content
        // e.g. if (view === 'activity') loadActivityData();
        // e.g. if (view === 'vehicles') loadVehiclesData();
    }

    // Click + keyboard support (Enter / Space)
    cards.forEach(card => {
        // Make card focusable for keyboard users if not already
        if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');

        card.addEventListener('click', () => handleCardActivation(card));

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardActivation(card);
            }
        });
    });

    // Default: activate the first card
    setActive(cards[0]);
});