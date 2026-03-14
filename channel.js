(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

Lampa.Component.add('history_home', {
    component: 'category_full',
    source: 'history'
});

Lampa.Listener.follow('app', function(e){

    if(e.type === 'ready'){

        setTimeout(function(){

            if(Lampa.Home){

                Lampa.Home.add({
                    title: 'Переглянуте',
                    component: 'history_home'
                });

            }

        },1500);

    }

});

})();
