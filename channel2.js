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
            // Додаємо ідентифікатор, щоб Lampa не плутала цей канал з іншими
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
                let finalResult = [];

                // Додаємо історію на перше місце
                if (historyRow) {
                    finalResult.push(historyRow);
                }

                // Додаємо абсолютно ВСІ канали, які прийшли від TMDB
                if (Array.isArray(data)) {
                    // Використовуємо розширення масиву, щоб нічого не загубити
                    finalResult = finalResult.concat(data);
                } else if (data && typeof data === 'object') {
                    finalResult.push(data);
                }

                // ВАЖЛИВО: передаємо масив далі без обрізки
                oncomplete(finalResult);
            }, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
