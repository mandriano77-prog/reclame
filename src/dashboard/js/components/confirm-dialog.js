/**
 * ConfirmDialog — native <dialog> replacement for window.confirm on destructive flows.
 */
(function (global) {
    var pendingResolve = null;

    function getEls() {
        return {
            dialog: document.getElementById('appConfirmDialog'),
            title: document.getElementById('appConfirmTitle'),
            message: document.getElementById('appConfirmMessage'),
            confirmBtn: document.getElementById('appConfirmBtn'),
            form: document.getElementById('appConfirmForm')
        };
    }

    function appConfirm(opts) {
        opts = opts || {};
        var els = getEls();
        if (!els.dialog) return Promise.resolve(global.confirm(opts.message || opts.title || 'Confermi?'));

        return new Promise(function (resolve) {
            pendingResolve = resolve;
            if (els.title) els.title.textContent = opts.title || 'Confermi?';
            if (els.message) els.message.textContent = opts.message || '';
            if (els.confirmBtn) {
                els.confirmBtn.textContent = opts.confirmLabel || 'Conferma';
                els.confirmBtn.className = opts.tone === 'danger' ? 'btn danger' : 'btn';
            }
            els.dialog.showModal();
        });
    }

    function bindConfirmDialog() {
        var els = getEls();
        if (!els.form || els.form.dataset.bound === '1') return;
        els.form.dataset.bound = '1';
        els.form.addEventListener('submit', function (e) {
            e.preventDefault();
            var fd = new FormData(els.form);
            var val = fd.get('action');
            els.dialog.close();
            if (pendingResolve) {
                pendingResolve(val === 'confirm');
                pendingResolve = null;
            }
        });
        els.dialog.addEventListener('cancel', function () {
            if (pendingResolve) {
                pendingResolve(false);
                pendingResolve = null;
            }
        });
    }

    global.appConfirm = appConfirm;
    global.bindConfirmDialog = bindConfirmDialog;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindConfirmDialog);
    } else {
        bindConfirmDialog();
    }
})(typeof window !== 'undefined' ? window : global);
