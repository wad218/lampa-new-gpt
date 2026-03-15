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
            id: 'history_row',
            // Додаємо важливі параметри для роботи карток
            card_events: true 
        };
    }

    function start() {
        if (window.history_row_plugin_position) return;
        window.history_row_plugin_position = true;

        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            
            let myOnComplete = function (data) {
                let historyRow = getHistoryRow();
                
                if (historyRow && Array.isArray(data)) {
                    // Видаляємо дублікати, якщо вони є
                    data = data.filter(i => i.id !== 'history_row');
                    
                    // Вставляємо на 3-тю позицію (індекс 2)
                    // Якщо в масиві менше 2 елементів, splice просто додасть в кінець
                    if (data.length > 2) {
                        data.splice(2, 0, historyRow);
                    } else {
                        data.push(historyRow);
                    }
                }
                
                oncomplete(data);
            };

            originalMain(params, myOnComplete, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
