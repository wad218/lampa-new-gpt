(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function loadHistory(cb) {
        let hist = [];
        try {
            // Отримуємо історію з Favorite
            let fav = Lampa.Favorite.all() || {};
            hist = fav.history || [];
        } catch (e) { }

        // Повертаємо об'єкт секції
        cb({
            title: 'Історія перегляду',
            results: hist.slice(0, 20),
            type: 'movie' // бажано вказати тип для коректного відображення
        });
    }

    function start() {
        if (window.history_row_plugin) return;
        window.history_row_plugin = true;

        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            let parts = [];

            // 1. Додаємо історію
            parts.push(function (cb) {
                loadHistory(cb);
            });

            // 2. Додаємо стандартний контент
            parts.push(function (cb) {
                originalMain(params, function (data) {
                    // Якщо originalMain повертає масив секцій, передаємо його далі
                    cb(data);
                }, onerror);
            });

            // Використовуємо ліміт частин. 
            // В Lampa partNext збирає результати в один масив.
            Lampa.Api.partNext(parts, parts.length, function (result) {
                // result буде масивом, де [0] - це історія, а [1] - масив від TMDB
                // Нам треба "розгладити" (flatten) цей масив
                let merged = [];
                result.forEach(item => {
                    if (Array.isArray(item)) merged = merged.concat(item);
                    else merged.push(item);
                });
                
                oncomplete(merged);
            }, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
