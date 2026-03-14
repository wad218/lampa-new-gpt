(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    // ---- НАЛАШТУВАННЯ ----
    Lampa.SettingsApi.addParam({
        component: 'interface',
        param: {
            name: 'show_history_home',
            type: 'trigger',
            default: true
        },
        field: {
            name: 'Показувати канал "Переглянуте"',
            description: 'Додає рядок історії переглядів на головну'
        }
    });

    // ---- РЯДОК ІСТОРІЇ ----
    function loadHistory(component, params, oncomplete){

        let hist = [];

        try{
            hist = (Lampa.Favorite.all().history || []);
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

    // ---- ДЖЕРЕЛО ДЛЯ HOME ----
    Lampa.Api.sources.history_home = {
        title: 'Переглянуте',
        main: loadHistory
    };

    // ---- ДОДАТИ НА ГОЛОВНУ ----
    Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready'){

            if(Lampa.Storage.get('show_history_home', true)){

                Lampa.Home.add({
                    title: 'Переглянуте',
                    source: 'history_home'
                }, 0);

            }

        }
    });

})();
