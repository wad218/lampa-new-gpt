(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function getHistoryRow() {
        let hist = [];
        try {
            // Отримуємо дані прямо з Favorite
            let fav = Lampa.Favorite.all() || {};
            hist = fav.history || [];
        } catch (e) { }

        if (!hist.length) return null;

        return {
            title: 'Історія перегляду',
            results: hist.slice(0, 20),
            type: 'movie',
            id: 'history_row'
        };
    }

    function start() {
        if (window.history_row_plugin_fixed) return;
        window.history_row_plugin_fixed = true;

        // Зберігаємо оригінал
        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            // Викликаємо оригінальну функцію TMDB
            originalMain(params, function (data) {
                let historyRow = getHistoryRow();
                
                if (historyRow) {
                    // Перевіряємо, чи дані прийшли як масив
                    if (Array.isArray(data)) {
                        // Перевіряємо, чи ми вже не додали історію
                        let exists = data.find(i => i.id === 'history_row');
                        if (!exists) data.unshift(historyRow);
                    } else if (data && typeof data === 'object') {
                        // Якщо це поодинокий об'єкт, перетворюємо на масив
                        data = [historyRow, data];
                    }
                }
                
                // Повертаємо дані в Lampa
                oncomplete(data);
            }, onerror);
        };
    }

    // Запускаємо з невеликою затримкою, щоб Lampa встигла завантажити ядро
    if (window.appready) setTimeout(start, 500);
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') setTimeout(start, 500);
    });
})();
