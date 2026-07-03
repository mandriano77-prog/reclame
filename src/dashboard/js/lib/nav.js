/**
 * FiloDiretto Studio — NAV catalog (ES module).
 */
export const NAV = [
    {
        id: 'brand-pass',
        label: 'Brand & Pass',
        items: [
            { id: 'brand-identity', label: 'Identità Brand' },
            { id: 'media-library', label: 'Media Library' },
            { id: 'templates', label: 'Template Pass' },
            { id: 'passes', label: 'Pass Emessi' }
        ]
    },
    {
        id: 'comunicazione',
        label: 'Engagement',
        items: [
            { id: 'push', label: 'Push & Notifiche' },
            { id: 'instant-win', label: 'Reward' },
            { id: 'gamification', label: 'Challenge' },
            { id: 'leads', label: 'Contatti' }
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
    'pass-wizard': 'Crea Pass',
    audiences: 'Audience',
    'activity-log': 'Log Attività'
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
                const labelEl = el.querySelector('.nav-label, .a2w-nav-label');
                if (labelEl) labelEl.textContent = item.label;
                else if (!el.querySelector('.nav-icon, .a2w-nav-icon')) el.textContent = item.label;
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
