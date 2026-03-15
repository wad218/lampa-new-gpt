(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function getHistoryRow() {
        let hist = [];
        try {
            let fav = Lampa.Favorite.all() || {};
            hist = fav.history || [];
        } catch (e) { }

        if (hist.length === 0) return null;

        return {
            title: 'Історія перегляду',
            results: hist.slice(0, 20),
            type: 'movie',
            id: 'history_row'
        };
    }

    function start() {
        if (window.history_row_plugin) return;
        window.history_row_plugin = true;

        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            originalMain(params, function (data) {
                let historyRow = getHistoryRow();

                if (historyRow) {
                    // Якщо data - це масив, ми додаємо історію на початок САМОГО ЦЬОГО масиву
                    // Використовуємо unshift, щоб не створювати новий об'єкт масиву
                    if (Array.isArray(data)) {
                        data.unshift(historyRow);
                    } else {
                        // Якщо прийшов один об'єкт, перетворюємо його на масив
                        data = [historyRow, data];
                    }
                }

                // Повертаємо оригінальний (але модифікований) об'єкт data
                oncomplete(data);
            }, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
