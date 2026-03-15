(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function start() {
        if (window.history_row_final_v4) return;
        window.history_row_final_v4 = true;

        // Створюємо функцію, яка буде малювати нашу стрічку
        function addHistoryRow(object) {
            let hist = [];
            try {
                let fav = Lampa.Favorite.all() || {};
                hist = fav.history || [];
            } catch (e) { }

            if (hist.length > 0) {
                let row = {
                    title: 'Історія перегляду',
                    results: hist.slice(0, 20),
                    type: 'movie',
                    id: 'history_row',
                    card_events: true
                };

                // Додаємо стрічку в кінець поточної активності
                // Якщо ми на головній (main)
                if (object.activity.component === 'main') {
                    object.activity.render().find('.items').prepend(Lampa.Template.get('items_line', row));
                    // Спеціальний виклик для ініціалізації карток, щоб вони натискалися
                    Lampa.Controller.add('content', {
                        toggle: function () {},
                        up: function () {},
                        down: function () {},
                        right: function () {},
                        left: function () {},
                        back: function () {}
                    });
                }
            }
        }

        // Слухаємо подію повної готовності сторінки
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite' && e.activity.component === 'main') {
                // Додаємо нашу історію ПІСЛЯ того, як Lampa вже все намалювала
                // Використовуємо невелику затримку, щоб не заважати основному списку
                setTimeout(function() {
                    let hist = [];
                    try {
                        let fav = Lampa.Favorite.all() || {};
                        hist = (fav.history || []).slice(0, 20);
                    } catch (err) {}

                    if (hist.length) {
                        let line = Lampa.Template.get('items_line', {
                            title: 'Історія перегляду',
                            id: 'history_row'
                        });

                        line.find('.items').append(Lampa.Arrays.create(hist).map(function (item) {
                            let card = Lampa.Template.get('card', item);
                            card.on('click', function () {
                                Lampa.Activity.push({
                                    url: item.url,
                                    title: item.title,
                                    component: 'full',
                                    id: item.id,
                                    method: item.name ? 'tv' : 'movie',
                                    card: item
                                });
                            });
                            return card;
                        }));

                        // Вставляємо на самий початок контейнера
                        e.activity.render().find('.items').prepend(line);
                    }
                }, 200);
            }
        });
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
