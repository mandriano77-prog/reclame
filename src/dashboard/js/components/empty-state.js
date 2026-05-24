/**
 * EmptyState — HTML helper for zero-data views.
 */
(function (global) {
    var ICONS = {
        inbox: '<svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
        users: '<svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        ticket: '<svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>'
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * @param {{ title: string, description?: string, ctaLabel?: string, ctaOnclick?: string, icon?: keyof ICONS }} opts
     */
    function renderEmptyState(opts) {
        opts = opts || {};
        var icon = ICONS[opts.icon] || ICONS.inbox;
        var cta = opts.ctaLabel && opts.ctaOnclick
            ? '<button type="button" class="btn" onclick="' + esc(opts.ctaOnclick) + '">' + esc(opts.ctaLabel) + '</button>'
            : '';
        return (
            '<div class="empty-state" role="status">' +
            icon +
            '<p class="empty-state__title">' + esc(opts.title) + '</p>' +
            (opts.description ? '<p class="empty-state__desc">' + esc(opts.description) + '</p>' : '') +
            cta +
            '</div>'
        );
    }

    global.renderEmptyState = renderEmptyState;
})(typeof window !== 'undefined' ? window : global);
