/**
 * FiloDiretto Studio — single source of truth for sidebar labels, page titles, document.title.
 * Vanilla dashboard equivalent of src/lib/nav.ts (Next.js spec).
 */
(function (global) {
    /** @typedef {{ id: string, label: string }} NavItem */
    /** @typedef {{ id: string, label: string, items: NavItem[] }} NavSection */

    /** @type {NavSection[]} */
    var NAV = [
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
                { id: 'instant-win', label: 'Reward' },
                { id: 'gamification', label: 'Challenge' }
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

    /** Sections outside main NAV (wizard / design flows). */
    var EXTRA_PAGE_TITLES = {
        welcome: 'Inizio',
        'pass-design': 'Design Pass',
        'pass-wizard': 'Crea Pass'
    };

    function getPageTitle(sectionId) {
        for (var s = 0; s < NAV.length; s++) {
            var sec = NAV[s];
            for (var i = 0; i < sec.items.length; i++) {
                if (sec.items[i].id === sectionId) return sec.items[i].label;
            }
        }
        return EXTRA_PAGE_TITLES[sectionId] || sectionId;
    }

    function buildSectionPageTitles() {
        var titles = {};
        Object.keys(EXTRA_PAGE_TITLES).forEach(function (k) {
            titles[k] = EXTRA_PAGE_TITLES[k];
        });
        NAV.forEach(function (sec) {
            sec.items.forEach(function (item) {
                titles[item.id] = item.label;
            });
        });
        return titles;
    }

    function applySidebarLabels() {
        NAV.forEach(function (section) {
            document.querySelectorAll('details[data-nav-group="' + section.id + '"] > summary.nav-group-label').forEach(function (el) {
                el.textContent = section.label;
            });
            section.items.forEach(function (item) {
                document.querySelectorAll('.nav-item[data-section-id="' + item.id + '"]').forEach(function (el) {
                    if (el.hasAttribute('data-menu-key')) return;
                    el.textContent = item.label;
                });
            });
        });
    }

    function applyPageHeadings() {
        NAV.forEach(function (section) {
            section.items.forEach(function (item) {
                var root = document.getElementById(item.id);
                if (!root) return;
                var h1 = root.querySelector('h1.page-title, h1.sec-title');
                if (h1 && !h1.hasAttribute('data-menu-key')) {
                    h1.textContent = item.label;
                }
            });
        });
    }

    function applyNavNaming() {
        applySidebarLabels();
        applyPageHeadings();
    }

    global.FD_NAV = {
        NAV: NAV,
        EXTRA_PAGE_TITLES: EXTRA_PAGE_TITLES,
        getPageTitle: getPageTitle,
        buildSectionPageTitles: buildSectionPageTitles,
        applyNavNaming: applyNavNaming
    };
})(typeof window !== 'undefined' ? window : global);
