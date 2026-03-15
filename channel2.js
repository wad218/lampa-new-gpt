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
            id: 'history_row',
            class: 'history-row' // Додаємо клас для стабільності
        };
    }

    function start() {
        if (window.history_row_plugin_final) return;
        window.history_row_plugin_final = true;

        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            // Викликаємо оригінал
            originalMain(params, function (data) {
                let historyRow = getHistoryRow();

                if (historyRow && Array.isArray(data)) {
                    // Перевіряємо чи немає дублікатів
                    data = data.filter(item => item.id !== 'history_row');
                    
                    // Додаємо історію на початок
                    data.unshift(historyRow);
                }

                // ВАЖЛИВО: Використовуємо невеликий таймаут перед oncomplete. 
                // Це дає Lampa час "зареєструвати" всі канали до того, як вона почне їх обрізати.
                setTimeout(function() {
                    oncomplete(data);
                }, 10);
                
            }, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
