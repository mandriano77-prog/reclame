/**
 * Sidebar — mobile sheet + backdrop.
 */
(function (global) {
    var STORAGE_KEY = 'fd:sidebar:mobileOpen';

    function bindMobileSidebar() {
        var toggle = document.getElementById('sidebarToggle');
        var backdrop = document.getElementById('sidebarBackdrop');
        if (!toggle || toggle.dataset.bound === '1') return;
        toggle.dataset.bound = '1';

        function setOpen(open) {
            document.body.classList.toggle('sidebar-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        toggle.addEventListener('click', function () {
            setOpen(!document.body.classList.contains('sidebar-open'));
        });

        if (backdrop) {
            backdrop.addEventListener('click', function () { setOpen(false); });
        }

        document.querySelectorAll('.sidebar .nav-item').forEach(function (el) {
            el.addEventListener('click', function () {
                if (window.matchMedia('(max-width: 767px)').matches) setOpen(false);
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setOpen(false);
        });
    }

    global.bindMobileSidebar = bindMobileSidebar;
})(typeof window !== 'undefined' ? window : global);
