/**
 * Dashboard UI bootstrap — ES module entry (enhancements only; business logic stays inline).
 */
import { NAV, getPageTitle, buildSectionPageTitles, applyNavNaming } from './lib/nav.js';

window.FD_NAV_ESM = { NAV, getPageTitle, buildSectionPageTitles, applyNavNaming };

function initUiEnhancements() {
    if (typeof window.enhancePageHeaders === 'function') window.enhancePageHeaders();
    if (typeof window.bindMobileSidebar === 'function') window.bindMobileSidebar();
    if (typeof window.bindConfirmDialog === 'function') window.bindConfirmDialog();

    document.querySelectorAll('.table').forEach(function (table) {
        if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
        var wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
    });

    document.querySelectorAll('[data-tooltip]').forEach(function (el) {
        if (!el.getAttribute('title') && el.dataset.tooltip) {
            el.setAttribute('title', el.dataset.tooltip);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUiEnhancements);
} else {
    initUiEnhancements();
}
