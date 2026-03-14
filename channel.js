(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function loadHistory(component, params, oncomplete){
        let hist = [];

        try{
            let fav = Lampa.Favorite.all();
            if(fav && fav.history) hist = fav.history;
        }
        catch(e){}

        oncomplete({
            results: hist,
            title: 'Переглянуте',
            params:{
                items:{
                    mapping:'line',
                    view:15
                }
            }
        });
    }

    Lampa.Api.sources.history_home = {
        title: 'Переглянуте',
        main: loadHistory
    };

    Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready'){

            Lampa.Home.add({
                title: 'Переглянуте',
                source: 'history_home'
            }, 0);

        }
    });

})();
