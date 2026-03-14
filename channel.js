(function () {
    'use strict';

    if (!window.Lampa) return;

    Lampa.Component.add('history_view', {
        component: 'category',
        title: 'Переглянуте',
        source: 'history'
    });

    Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready'){

            Lampa.Home.add({
                title: 'Переглянуте',
                component: 'history_view'
            });

        }
    });

})();
