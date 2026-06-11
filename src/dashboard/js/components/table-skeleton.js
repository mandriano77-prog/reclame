/**
 * TableSkeleton — shimmer placeholder rows + table error banner.
 */
(function (global) {
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * @param {number} rows
     * @param {number} columns
     */
    function renderTableSkeletonRows(rows, columns) {
        var r = Math.max(1, parseInt(rows, 10) || 5);
        var c = Math.max(1, parseInt(columns, 10) || 4);
        var out = '';
        for (var i = 0; i < r; i += 1) {
            out += '<tr class="table-skeleton-row">';
            for (var j = 0; j < c; j += 1) {
                var width = j === 0 ? '72%' : j === c - 1 ? '48%' : '88%';
                out +=
                    '<td class="table-skeleton-cell">' +
                    '<span class="table-skeleton-line" style="width:' + width + '"></span>' +
                    '</td>';
            }
            out += '</tr>';
        }
        return out;
    }

    /**
     * @param {{ headers?: string[], rows?: number, columns?: number }} opts
     */
    function renderTableSkeletonTable(opts) {
        opts = opts || {};
        var headers = opts.headers || [];
        var columns = opts.columns || headers.length || 4;
        var rows = opts.rows || 5;
        var head = headers.length
            ? '<thead><tr>' + headers.map(function (h) {
                return '<th>' + esc(h) + '</th>';
            }).join('') + '</tr></thead>'
            : '';
        return (
            '<table class="table table-skeleton-host">' +
            head +
            '<tbody>' + renderTableSkeletonRows(rows, columns) + '</tbody>' +
            '</table>'
        );
    }

    /**
     * @param {number} colspan
     * @param {string} message
     * @param {string} [retryOnclick]
     */
    function renderTableErrorRow(colspan, message, retryOnclick) {
        var span = Math.max(1, parseInt(colspan, 10) || 1);
        var retry = retryOnclick
            ? '<button type="button" class="btn sec small" onclick="' + esc(retryOnclick) + '">Riprova</button>'
            : '';
        return (
            '<tr class="table-error-row"><td colspan="' + span + '">' +
            '<div class="table-error-banner" role="alert">' +
            '<span>' + esc(message || 'Errore di caricamento') + '</span>' +
            retry +
            '</div></td></tr>'
        );
    }

    /**
     * Error block for non-table hosts (e.g. #audiencesList div).
     * @param {string} message
     * @param {string} [retryOnclick]
     */
    function renderTableErrorBlock(message, retryOnclick) {
        var retry = retryOnclick
            ? '<button type="button" class="btn sec small" onclick="' + esc(retryOnclick) + '">Riprova</button>'
            : '';
        return (
            '<div class="table-error-banner table-error-banner--block" role="alert">' +
            '<span>' + esc(message || 'Errore di caricamento') + '</span>' +
            retry +
            '</div>'
        );
    }

    global.renderTableSkeletonRows = renderTableSkeletonRows;
    global.renderTableSkeletonTable = renderTableSkeletonTable;
    global.renderTableErrorRow = renderTableErrorRow;
    global.renderTableErrorBlock = renderTableErrorBlock;
})(typeof window !== 'undefined' ? window : global);
