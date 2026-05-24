/**
 * Class name helper (shadcn-style) — for future UI components.
 */
function cn() {
    var inputs = Array.prototype.slice.call(arguments);
    var classes = [];
    for (var i = 0; i < inputs.length; i++) {
        var v = inputs[i];
        if (!v) continue;
        if (typeof v === 'string') classes.push(v);
        else if (Array.isArray(v)) classes.push(cn.apply(null, v));
        else if (typeof v === 'object') {
            Object.keys(v).forEach(function (k) {
                if (v[k]) classes.push(k);
            });
        }
    }
    return classes.join(' ');
}

if (typeof window !== 'undefined') {
    window.cn = cn;
}
