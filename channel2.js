(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function getHistoryRow() {
        let hist = [];
        try {
            let fav = Lampa.Favorite.all() || {};
            hist = fav.history || [];
        } catch (e) { }

        if (hist.length === 0) return null; // Не повертаємо порожню стрічку

        return {
            title: 'Історія перегляду',
            results: hist.slice(0, 20),
            type: 'movie'
        };
    }

    function start() {
        if (window.history_row_plugin) return;
        window.history_row_plugin = true;

        // Зберігаємо оригінальну функцію TMDB
        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            // Викликаємо оригінальний TMDB
            originalMain(params, function (data) {
                let historyRow = getHistoryRow();
                
                let result = [];
                
                // Якщо історія є, додаємо її першою
                if (historyRow) {
                    result.push(historyRow);
                }

                // Додаємо всі стандартні канали TMDB (вони вже в масиві data)
                if (Array.isArray(data)) {
                    result = result.concat(data);
                } else {
                    result.push(data);
                }

                // Повертаємо об'єднаний масив
                oncomplete(result);
            }, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
