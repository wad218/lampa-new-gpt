(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function getHistoryRow() {
        let hist = [];
        try {
            let fav = Lampa.Favorite.all() || {};
            hist = fav.history || [];
        } catch (e) { }

        if (!hist || hist.length === 0) return null;

        return {
            title: 'Історія перегляду',
            results: hist.slice(0, 20),
            type: 'movie',
            id: 'history_row'
        };
    }

    function start() {
        if (window.history_row_plugin_final_v3) return;
        window.history_row_plugin_final_v3 = true;

        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            // Створюємо власну функцію-обробник результату
            let myOnComplete = function (data) {
                let historyRow = getHistoryRow();
                
                if (historyRow && Array.isArray(data)) {
                    // Перевіряємо, чи немає нас вже в списку
                    if (!data.find(i => i.id === 'history_row')) {
                        // Вставляємо історію на перше місце
                        data.unshift(historyRow);
                    }
                }
                
                // ВІДДАЄМО ДАНІ ЯК Є
                oncomplete(data);
            };

            // Викликаємо оригінальний TMDB, але передаємо йому НАШУ функцію завершення
            originalMain(params, myOnComplete, onerror);
        };
    }

    // Запуск без затримок, але з перевіркою ready
    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
