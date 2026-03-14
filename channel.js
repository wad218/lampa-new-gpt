(function () {
    'use strict';

    if (!window.Lampa) return;

    Lampa.Component.add('watched_history', {
        component: 'category_full',
        title: 'Переглянуте',
        source: 'history'
    });

    Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready'){

            Lampa.Storage.set('main_watched_history', true);

            Lampa.Main.add({
                title: 'Переглянуте',
                component: 'watched_history'
            });

        }
    });

})();
