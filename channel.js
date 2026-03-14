(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

// створюємо компонент історії
Lampa.Component.add('history_home', {
    component: 'category_full',
    source: 'history'
});

// додаємо рядок на головну
Lampa.Listener.follow('app', function(e){

    if(e.type === 'ready'){

        Lampa.Home.add({
            title: 'Переглянуте',
            component: 'history_home'
        },0);

    }

});

})();
