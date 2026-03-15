(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function getHistoryRow() {
        let hist = [];
        try {
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
        // Захист від подвійного запуску
        if (window.history_row_plugin_loaded) return;
        window.history_row_plugin_loaded = true;

        // Перехоплюємо саме метод формування головної сторінки
        Lampa.Listener.follow('api', function (e) {
            // Перевіряємо, чи це запит до головної сторінки TMDB
            if (e.type === 'complete' && e.name === 'tmdb_main') {
                let historyRow = getHistoryRow();
                
                if (historyRow && e.data) {
                    // Перевіряємо, чи ми вже не додали історію (щоб не дублювати)
                    let exists = e.data.find(item => item.id === 'history_row');
                    
                    if (!exists) {
                        // Просто додаємо на початок масиву даних, які вже ПРИЙШЛИ від сервера
                        e.data.unshift(historyRow);
                    }
                }
            }
        });
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
