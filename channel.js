(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

Lampa.Listener.follow('app', function(e){

    if(e.type === 'ready'){

        if(!Lampa.Storage.get('history_home_show', true)) return;

        Lampa.Home.add({
            title: 'Переглянуте',
            source: 'history'
        },0);

    }

});

})();
