(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

function historyRow(callback){

    let hist = [];

    try{
        let fav = Lampa.Favorite.all();
        if(fav && fav.history) hist = fav.history;
    }
    catch(e){}

    callback({
        name: 'history_home',
        title: 'Переглянуте',
        results: hist,
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

        setTimeout(function(){

            Lampa.Api.partNext([
                function(cb){
                    historyRow(cb);
                }
            ],0);

        },1000);

    }

});

})();
