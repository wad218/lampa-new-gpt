(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

function loadHistory(cb){

let hist=[];

try{
let fav=Lampa.Favorite.all() || {};
hist = fav.history || [];
}catch(e){}

cb({
title:'Історія перегляду',
results:hist.slice(0,20)
});

}

function start(){

if(window.history_row_plugin) return;
window.history_row_plugin=true;

let originalMain = Lampa.Api.sources.tmdb.main;

Lampa.Api.sources.tmdb.main = function(params,oncomplete,onerror){

let parts=[];

parts.push(function(cb){
loadHistory(cb);
});

parts.push(function(cb){
originalMain(params,cb,onerror);
});

Lampa.Api.partNext(parts,2,oncomplete,onerror);

};

}

if(window.appready) start();
else Lampa.Listener.follow('app',function(e){
if(e.type==='ready') start();
});

})();
