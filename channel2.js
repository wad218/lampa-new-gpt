(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function start() {
        if (window.history_row_replace_loaded) return;
        window.history_row_replace_loaded = true;

        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            originalMain(params, function (data) {
                try {
                    let fav = Lampa.Favorite.all() || {};
                    let hist = fav.history || [];

                    if (hist.length > 0 && Array.isArray(data)) {
                        // Створюємо нашу секцію історії
                        let historyRow = {
                            title: 'Історія перегляду',
                            results: hist.slice(0, 20),
                            type: 'movie',
                            id: 'history_row',
                            card_events: true
                        };

                        // ТРЮК: Замість додавання нового (що обрізає список), 
                        // ми просто міняємо останній (5-й) або будь-який інший канал на Історію.
                        // Або вставляємо і видаляємо останній, щоб довжина масиву не змінилася.
                        
                        data.unshift(historyRow); // Додали на початок
                        if (data.length > 15) { 
                            // Якщо каналів багато, просто залишаємо як є
                        } else {
                            // Якщо Lampa прискіплива до кількості, можна видалити щось непотрібне в кінці
                            // data.pop(); 
                        }
                    }
                } catch (e) {}

                oncomplete(data);
            }, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
