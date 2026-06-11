/**
 * Relative / absolute date labels for dashboard UI (Italian).
 */
(function (global) {
    function formatAbsoluteDateIt(timestampMs) {
        if (!timestampMs) return '';
        try {
            return 'Salvato il ' + new Intl.DateTimeFormat('it-IT', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(timestampMs));
        } catch (_) {
            return '';
        }
    }

    function formatRelativeSavedLabel(timestampMs) {
        if (!timestampMs) return { label: 'Salvato', title: '' };
        var diff = Math.max(0, Date.now() - timestampMs);
        var min = Math.floor(diff / 60000);
        var title = formatAbsoluteDateIt(timestampMs);
        if (min < 1) return { label: 'Salvato ora', title: title };
        if (min < 60) return { label: 'Salvato ' + min + ' min fa', title: title };
        var h = Math.floor(min / 60);
        if (h < 24) return { label: 'Salvato ' + h + (h === 1 ? ' ora fa' : ' ore fa'), title: title };
        var d = Math.floor(h / 24);
        if (d < 7) return { label: 'Salvato ' + d + (d === 1 ? ' giorno fa' : ' giorni fa'), title: title };
        var w = Math.max(1, Math.round(d / 7));
        if (d < 30) return { label: 'circa ' + w + (w === 1 ? ' settimana fa' : ' settimane fa'), title: title };
        var mo = Math.max(1, Math.round(d / 30));
        if (d < 365) return { label: 'circa ' + mo + (mo === 1 ? ' mese fa' : ' mesi fa'), title: title };
        var y = Math.max(1, Math.round(d / 365));
        return { label: 'circa ' + y + (y === 1 ? ' anno fa' : ' anni fa'), title: title };
    }

    global.formatAbsoluteDateIt = formatAbsoluteDateIt;
    global.formatRelativeSavedLabel = formatRelativeSavedLabel;
})(typeof window !== 'undefined' ? window : global);
