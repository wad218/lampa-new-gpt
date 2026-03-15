(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

const ROWS = [
{id:'ua_history',title:'Історія перегляду',order:1,type:'history'},
{id:'ua_movies_new',title:'Новинки фільмів',order:2,type:'tmdb',url:'movie/now_playing'},
{id:'ua_series_new',title:'Новинки серіалів',order:3,type:'tmdb',url:'tv/on_the_air'},
{id:'ua_movies_pop',title:'Популярні фільми',order:4,type:'tmdb',url:'movie/popular'},
{id:'ua_series_pop',title:'Популярні серіали',order:5,type:'tmdb',url:'tv/popular'},
{id:'ua_random',title:'Випадкова підбірка',order:6,type:'random'}
];

function createSettings(){

if(!Lampa.SettingsApi) return;

Lampa.SettingsApi.addComponent({
component:'ua_channels',
name:'UA Channels'
});

let orderValues={
1:'Позиція 1',
2:'Позиція 2',
3:'Позиція 3',
4:'Позиція 4',
5:'Позиція 5',
6:'Позиція 6'
};

ROWS.forEach(r=>{

Lampa.SettingsApi.addParam({
component:'ua_channels',
param:{name:r.id,type:'trigger',default:true},
field:{name:'Показувати: '+r.title}
});

Lampa.SettingsApi.addParam({
component:'ua_channels',
param:{name:r.id+'_order',type:'select',values:orderValues,default:r.order},
field:{name:'Порядок: '+r.title}
});

});

}

function historyRow(cb){

let hist=[];

try{
let fav=Lampa.Favorite.all();
if(fav && fav.history) hist=fav.history;
}catch(e){}

cb({
title:'Історія перегляду',
results:hist.slice(0,20)
});

}

function buildRows(){

let active=[];

ROWS.forEach(r=>{

let enabled=Lampa.Storage.get(r.id);
if(enabled===null) enabled=true;

let order=parseInt(Lampa.Storage.get(r.id+'_order')) || r.order;

if(enabled) active.push({...r,order:order});

});

active.sort((a,b)=>a.order-b.order);

return active;

}

function injectChannels(){

let original=Lampa.Api.sources.tmdb.main;

Lampa.Api.sources.tmdb.main=function(params,oncomplete,onerror){

original(params,function(data){

let rows=buildRows();

let parts=[];

rows.forEach(r=>{

parts.push((cb)=>{

if(r.type==='history'){
historyRow(cb);
return;
}

if(r.type==='tmdb'){

Lampa.Api.get('tmdb',r.url,{page:1},(res)=>{

cb({
title:r.title,
results:res.results
});

},()=>cb({results:[]}));

return;

}

if(r.type==='random'){

Lampa.Api.get('tmdb','trending/movie/week',{page:1},(res)=>{

cb({
title:r.title,
results:res.results
});

},()=>cb({results:[]}));

}

});

});

Lampa.Api.partNext(parts,2,function(extra){

data.results=data.results.concat(extra.results || []);

oncomplete(data);

},onerror);

},onerror);

};

}

function start(){

if(window.ua_channels_loaded) return;
window.ua_channels_loaded=true;

createSettings();
injectChannels();

}

if(window.appready) start();
else Lampa.Listener.follow('app',e=>{
if(e.type==='ready') start();
});

})();
