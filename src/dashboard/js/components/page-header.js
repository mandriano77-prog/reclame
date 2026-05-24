/**
 * PageHeader — wraps section H1 + lead + actions into consistent layout.
 */
(function (global) {
    var SKIP = { welcome: 1 };

    function extractLead(section) {
        var p = section.querySelector(':scope > p:not(.page-header__desc)');
        if (!p || p.closest('.page-header')) return null;
        var style = p.getAttribute('style') || '';
        if (style.indexOf('color') === -1 && !p.classList.contains('page-lead')) return null;
        return p;
    }

    function extractLegacyRow(section) {
        var row = section.querySelector(':scope > div[style*="justify-content:space-between"]');
        if (!row || row.closest('.page-header')) return null;
        var h1 = row.querySelector('h1.page-title, h1.sec-title');
        if (!h1) return null;
        return row;
    }

    function enhanceSection(section) {
        if (!section || !section.id || SKIP[section.id]) return;
        if (section.querySelector(':scope > header.page-header')) return;

        var legacyRow = extractLegacyRow(section);
        var h1 = legacyRow
            ? legacyRow.querySelector('h1')
            : section.querySelector(':scope > h1.page-title, :scope > h1.sec-title');
        if (!h1) return;

        var lead = extractLead(section);
        var actionsEl = legacyRow ? legacyRow.querySelector('.page-header__actions-source, div:last-child') : null;
        if (legacyRow && actionsEl === legacyRow) actionsEl = null;
        if (legacyRow) {
            var kids = Array.prototype.slice.call(legacyRow.children);
            actionsEl = kids.length > 1 ? kids[kids.length - 1] : null;
            if (actionsEl && actionsEl.querySelector('h1')) actionsEl = null;
        }

        var header = document.createElement('header');
        header.className = 'page-header';

        var main = document.createElement('div');
        main.className = 'page-header__main';
        h1.classList.add('page-header__title');
        h1.classList.remove('sec-title', 'page-title');
        h1.style.marginBottom = '';
        main.appendChild(h1);

        if (lead) {
            lead.classList.add('page-header__desc');
            lead.removeAttribute('style');
            main.appendChild(lead);
        }

        header.appendChild(main);

        if (actionsEl && actionsEl.children && actionsEl.children.length) {
            var actions = document.createElement('div');
            actions.className = 'page-header__actions';
            while (actionsEl.firstChild) actions.appendChild(actionsEl.firstChild);
            header.appendChild(actions);
            if (legacyRow) legacyRow.classList.add('page-header--legacy-row');
            else actionsEl.remove();
        }

        if (legacyRow) {
            legacyRow.parentNode.insertBefore(header, legacyRow);
            if (legacyRow.querySelector('h1')) legacyRow.remove();
        } else {
            section.insertBefore(header, section.firstChild);
        }
    }

    function enhancePageHeaders() {
        document.querySelectorAll('.content .section').forEach(enhanceSection);
    }

    global.enhancePageHeaders = enhancePageHeaders;
})(typeof window !== 'undefined' ? window : global);
