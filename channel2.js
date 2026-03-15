(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function start() {
        if (window.history_row_plugin_final_fixed) return;
        window.history_row_plugin_final_fixed = true;

        // Перехоплюємо результат запиту до головної сторінки
        Lampa.Listener.follow('api', function (e) {
            if (e.type === 'complete' && e.name === 'tmdb_main') {
                
                // Отримуємо історію
                let hist = [];
                try {
                    let fav = Lampa.Favorite.all() || {};
                    hist = fav.history || [];
                } catch (err) {}

                if (hist.length > 0 && e.data && Array.isArray(e.data)) {
                    // Перевіряємо, чи ми вже не вставили цей рядок
                    if (!e.data.find(function(i) { return i.id === 'history_row' })) {
                        
                        // Створюємо об'єкт рядка
                        let row = {
                            title: 'Історія перегляду',
                            results: hist.slice(0, 20),
                            type: 'movie',
                            id: 'history_row',
                            card_events: true // Це активує кліки та фокус
                        };

                        // ВАЖЛИВО: додаємо в масив, який Lampa вже "схвалила"
                        e.data.unshift(row);
                    }
                }
            }
        });

        // Додатковий хак: примусово оновлюємо контролер, щоб картки були активні
        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'render' && e.activity.component === 'main') {
                setTimeout(function() {
                    Lampa.Controller.render();
                }, 100);
            }
        });
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
