(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

// функція отримання історії (логіка як у ymain.js)
function loadHistoryRow(callback){

    let hist = [];

    try{
        let fav = Lampa.Favorite.all();
        if(fav && fav.history) hist = fav.history;
    }
    catch(e){}

    if(!hist.length){
        callback({results:[]});
        return;
    }

    // стандартні картки Lampa
    callback({
        title: 'Переглянуте',
        results: hist,
        params:{
            items:{
                mapping: 'line',
                view: 15
            }
        }
    });

}

// додаємо рядок у головну
Lampa.Listener.follow('app', function(e){

    if(e.type === 'ready'){

        Lampa.Api.partNext([
            function(cb){
                loadHistoryRow(cb);
            }
        ],0);

    }

});

})();
