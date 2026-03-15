(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function start() {
        if (window.history_row_replace_v5) return;
        window.history_row_replace_v5 = true;

        let originalMain = Lampa.Api.sources.tmdb.main;

        Lampa.Api.sources.tmdb.main = function (params, oncomplete, onerror) {
            originalMain(params, function (data) {
                try {
                    // Отримуємо вашу історію
                    let fav = Lampa.Favorite.all() || {};
                    let hist = fav.history || [];

                    if (hist.length > 0 && Array.isArray(data)) {
                        // Шукаємо канал "Продовжити перегляд"
                        // Він може мати назву 'Продовжити перегляд' або 'Продолжить просмотр'
                        let index = data.findIndex(function(item) {
                            return item.title === 'Продовжити перегляд' || 
                                   item.title === 'Продолжить просмотр' ||
                                   item.id === 'continue';
                        });

                        if (index !== -1) {
                            // Якщо знайшли — міняємо його дані на ваші
                            data[index].title = 'Історія перегляду';
                            data[index].results = hist.slice(0, 20);
                            // Важливо залишити оригінальні card_events, якщо вони були, або форсувати їх
                            data[index].card_events = true;
                        } else {
                            // Якщо такий канал не знайдено (вимкнений в налаштуваннях), 
                            // просто вставляємо на 2-ге місце без видалення, раптом проскочить
                            data.splice(1, 0, {
                                title: 'Історія перегляду',
                                results: hist.slice(0, 20),
                                type: 'movie',
                                id: 'history_row',
                                card_events: true
                            });
                        }
                    }
                } catch (e) {
                    console.log('History Plugin Error:', e);
                }

                oncomplete(data);
            }, onerror);
        };
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
