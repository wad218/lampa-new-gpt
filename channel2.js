(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

function loadHistory(callback){

let hist=[];

try{
let fav=Lampa.Favorite.all();
if(fav && fav.history) hist=fav.history;
}catch(e){}

callback({
title:'Історія перегляду',
results:hist.slice(0,20)
});

}

function start(){

if(window.history_row_added) return;
window.history_row_added=true;

let originalMain = Lampa.Api.sources.tmdb.main;

Lampa.Api.sources.tmdb.main = function(params,oncomplete,onerror){

originalMain(params,function(data){

let parts=[];

parts.push(function(cb){
loadHistory(cb);
});

Lampa.Api.partNext(parts,1,function(extra){

if(extra && extra.results){
data.results.unshift({
title:'Історія перегляду',
results:extra.results
});
}

oncomplete(data);

},onerror);

},onerror);

};

}

if(window.appready) start();
else Lampa.Listener.follow('app',function(e){
if(e.type==='ready') start();
});

})();
