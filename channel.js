(function () { 'use strict';
if (typeof Lampa === 'undefined') return;

function addHistoryRow() {

    if (!Lampa.Home) return;

    Lampa.Listener.follow('home', function (e) {

        if (e.type !== 'create') return;

        var rows = e.object.rows || [];

        var exists = rows.some(function (row) {
            return row.type === 'history';
        });

        if (!exists) {
            rows.unshift({
                title: 'Ви дивилися',
                type: 'history'
            });
        }

        e.object.rows = rows;
    });
}

if (window.appready) addHistoryRow();
else Lampa.Listener.follow('app', function (e) {
    if (e.type === 'ready') addHistoryRow();
});
})();
