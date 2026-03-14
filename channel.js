(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    // ---- налаштування ----
    Lampa.SettingsApi.addParam({
        component: 'interface',
        param: {
            name: 'show_history_home',
            type: 'trigger',
            default: true
        },
        field: {
            name: 'Показувати канал "Переглянуте"',
            description: 'Історія переглядів на головній'
        }
    });

    function loadHistoryRow(callback){

        let hist = [];

        try{
            hist = (Lampa.Favorite.all().history || []);
        }
        catch(e){}

        callback({
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

    Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready'){

            if(!Lampa.Storage.get('show_history_home', true)) return;

            Lampa.Api.partNext([
                function(cb){
                    loadHistoryRow(cb);
                }
            ], 0);

        }
    });

})();
