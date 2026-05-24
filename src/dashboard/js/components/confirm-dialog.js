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
            cancelBtn: document.getElementById('appConfirmCancelBtn'),
            form: document.getElementById('appConfirmForm')
        };
    }

    function finishConfirm(confirmed) {
        var els = getEls();
        if (els.dialog && els.dialog.open) els.dialog.close();
        if (pendingResolve) {
            pendingResolve(!!confirmed);
            pendingResolve = null;
        }
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
        if (!els.dialog || els.dialog.dataset.bound === '1') return;
        els.dialog.dataset.bound = '1';

        if (els.confirmBtn) {
            els.confirmBtn.addEventListener('click', function () { finishConfirm(true); });
        }
        if (els.cancelBtn) {
            els.cancelBtn.addEventListener('click', function () { finishConfirm(false); });
        }
        if (els.form) {
            els.form.addEventListener('submit', function (e) {
                e.preventDefault();
                var submitter = e.submitter;
                var val = submitter && submitter.id === 'appConfirmBtn' ? 'confirm' : 'cancel';
                finishConfirm(val === 'confirm');
            });
        }
        els.dialog.addEventListener('cancel', function (e) {
            e.preventDefault();
            finishConfirm(false);
        });
        els.dialog.addEventListener('close', function () {
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
