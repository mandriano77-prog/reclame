/**
 * FiloDiretto Studio — NAV catalog (ES module).
 */
export const NAV = [
    {
        id: 'brand',
        label: 'Brand',
        items: [
            { id: 'brand-identity', label: 'Identità Brand' },
            { id: 'media-library', label: 'Media Library' }
        ]
    },
    {
        id: 'pass',
        label: 'Pass',
        items: [
            { id: 'templates', label: 'Template Pass' },
            { id: 'passes', label: 'Pass Emessi' }
        ]
    },
    {
        id: 'comunicazione',
        label: 'Comunicazione',
        items: [
            { id: 'campaigns', label: 'Campagne' },
            { id: 'push', label: 'Push & Notifiche' }
        ]
    },
    {
        id: 'engagement',
        label: 'Engagement',
        items: [
            { id: 'instant-win', label: 'Instant Win' },
            { id: 'gamification', label: 'Gamification' }
        ]
    },
    {
        id: 'database',
        label: 'Database',
        items: [
            { id: 'leads', label: 'Contatti' },
            { id: 'audiences', label: 'Audience' }
        ]
    },
    {
        id: 'insights',
        label: 'Insights',
        items: [
            { id: 'analytics', label: 'Analytics' },
            { id: 'activity-log', label: 'Log Attività' }
        ]
    },
    {
        id: 'setup',
        label: 'Setup',
        items: [{ id: 'users', label: 'Utenti' }]
    }
];

export const EXTRA_PAGE_TITLES = {
    welcome: 'Inizio',
    'pass-design': 'Design Pass',
    'pass-wizard': 'Crea Pass'
};

export function getPageTitle(sectionId) {
    for (const sec of NAV) {
        for (const item of sec.items) {
            if (item.id === sectionId) return item.label;
        }
    }
    return EXTRA_PAGE_TITLES[sectionId] || sectionId;
}

export function buildSectionPageTitles() {
    const titles = { ...EXTRA_PAGE_TITLES };
    NAV.forEach((sec) => {
        sec.items.forEach((item) => {
            titles[item.id] = item.label;
        });
    });
    return titles;
}

export function applyNavNaming() {
    NAV.forEach((section) => {
        document.querySelectorAll(`details[data-nav-group="${section.id}"] > summary.nav-group-label`).forEach((el) => {
            el.textContent = section.label;
        });
        section.items.forEach((item) => {
            document.querySelectorAll(`.nav-item[data-section-id="${item.id}"]`).forEach((el) => {
                if (el.hasAttribute('data-menu-key')) return;
                el.textContent = item.label;
            });
        });
    });
    NAV.forEach((section) => {
        section.items.forEach((item) => {
            const root = document.getElementById(item.id);
            if (!root) return;
            const h1 = root.querySelector('h1.page-title, h1.sec-title, h1.page-header__title');
            if (h1 && !h1.hasAttribute('data-menu-key')) {
                h1.textContent = item.label;
            }
        });
    });
}
