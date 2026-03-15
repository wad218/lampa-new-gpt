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
        if (window.history_row_inject_loaded) return;
        window.history_row_inject_loaded = true;

        // Підписуємось на подію створення будь-якої активності (сторінки)
        Lampa.Listener.follow('activity', function (e) {
            // Перевіряємо, чи це головна сторінка TMDB
            if (e.type === 'render' && e.component === 'full' && e.activity.component === 'main') {
                
                let historyRow = getHistoryRow();
                
                if (historyRow && e.activity.render) {
                    // Знаходимо контейнер з результатами на сторінці
                    let result = e.activity.render().find('.items');
                    
                    // Якщо історія ще не додана, додаємо її ПІСЛЯ рендеру основних каналів
                    if (!e.activity.history_added) {
                        // Цей метод дозволяє Lampa додати рядок динамічно
                        // Ми викликаємо оригінальний метод малювання рядка
                        Lampa.Component.get('full').prototype.append.call(e.activity, historyRow);
                        e.activity.history_added = true;
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
