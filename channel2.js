(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

function loadHistory(){
    let hist = [];
    try{
        let fav = Lampa.Favorite.all() || {};
        hist = fav.history || [];
    }catch(e){}

    return {
        title: 'Історія перегляду',
        results: hist.slice(0,20)
    };
}

function start(){

    if(window.history_row_plugin) return;
    window.history_row_plugin = true;

    const originalMain = Lampa.Api.sources.tmdb.main;

    Lampa.Api.sources.tmdb.main = function(params,oncomplete,onerror){

        originalMain(params,function(data){

            let historyRow = loadHistory();

            if(historyRow.results.length){
                if(!data.results) data.results = [];

                data.results.unshift(historyRow);
            }

            oncomplete(data);

        },onerror);

    };

}

if(window.appready) start();
else Lampa.Listener.follow('app',function(e){
    if(e.type === 'ready') start();
});

})();
