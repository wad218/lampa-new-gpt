(function () { 'use strict';
if (typeof Lampa === 'undefined') return;

function addHistoryRow() {

    var row = {
        id: 'custom_history_row',
        title: 'Історія перегляду',
        type: 'history',
        defOrder: 1,
        icon: ''
    };

    if (!Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;

    var original = Lampa.Api.sources.tmdb.main;

    Lampa.Api.sources.tmdb.main = function (params, oncomplite, onerror) {

        original(params, function (data) {

            if (!data || !data.results) {
                oncomplite(data);
                return;
            }

            var exists = data.results.some(function (item) {
                return item.id === row.id;
            });

            if (!exists) {
                data.results.unshift(row);
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
