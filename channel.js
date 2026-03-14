(function () { 'use strict';
if (typeof Lampa === 'undefined') return;

function addHistoryRow() {

    if (!Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;

    var original = Lampa.Api.sources.tmdb.main;

    Lampa.Api.sources.tmdb.main = function (params, oncomplite, onerror) {

        original(params, function (data) {

            if (!data || !data.rows) {
                oncomplite(data);
                return;
            }

            var exists = data.rows.some(function (row) {
                return row.id === 'history_row';
            });

            if (!exists) {
                data.rows.unshift({
                    id: 'history_row',
                    title: 'Історія перегляду',
                    type: 'history',
                    defOrder: 1,
                    url: '',
                    icon: ''
                });
            }

            oncomplite(data);

        }, onerror);
    };
}

if (window.appready) addHistoryRow();
else Lampa.Listener.follow('app', function (e) {
    if (e.type === 'ready') addHistoryRow();
});
})();
