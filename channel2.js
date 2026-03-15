(function () {
'use strict';

if (typeof Lampa === 'undefined') return;

const DEFAULT_ROWS_SETTINGS =[
{ id:'ym_row_history',title:'Історія перегляду',defOrder:1,default:true },
{ id:'ym_row_movies_new',title:'Новинки фільмів',defOrder:2,default:true },
{ id:'ym_row_series_new',title:'Новинки серіалів',defOrder:3,default:true },
{ id:'ym_row_collections',title:'Підбірки KinoBaza',defOrder:4,default:true },
{ id:'ym_row_kinobaza',title:'Новинки Стрімінгів UA',defOrder:5,default:true },
{ id:'ym_row_community',title:'Знахідки спільноти LME',defOrder:6,default:true },
{ id:'ym_row_movies_watch',title:'Популярні фільми',defOrder:7,default:true },
{ id:'ym_row_series_pop',title:'Популярні серіали',defOrder:8,default:true },
{ id:'ym_row_random',title:'Випадкова підбірка',defOrder:9,default:true }
];

function createSettings(){
if(!Lampa.SettingsApi) return;

Lampa.SettingsApi.addComponent({
component:'ymainpage',
name:'UA Main',
icon:'<svg width="36" height="36" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>'
});

let orderValues={
1:'Позиція 1',
2:'Позиція 2',
3:'Позиція 3',
4:'Позиція 4',
5:'Позиція 5',
6:'Позиція 6',
7:'Позиція 7',
8:'Позиція 8',
9:'Позиція 9'
};

DEFAULT_ROWS_SETTINGS.forEach(r=>{
Lampa.SettingsApi.addParam({
component:'ymainpage',
param:{name:r.id,type:'trigger',default:r.default},
field:{name:'Показувати: '+r.title}
});

Lampa.SettingsApi.addParam({
component:'ymainpage',
param:{name:r.id+'_order',type:'select',values:orderValues,default:r.defOrder},
field:{name:'Порядок: '+r.title}
});
});
}

function loadHistory(callback){
let hist=[];
try{
let fav=Lampa.Favorite.all();
if(fav && fav.history) hist=fav.history;
}catch(e){}

callback({
results:hist.slice(0,20),
title:''
});
}

function loadUAS(url,page){
let p=page+1;
return Lampa.Reguest.silent('https://cors.lampa.stream/'+url+'page/'+p+'/',false,{});
}

function overrideApi(){

Lampa.Api.sources.tmdb.main=function(params,oncomplete,onerror){

let rowDefs=[
{ id:'ym_row_history',type:'history',title:'Історія перегляду'},
{ id:'ym_row_movies_new',type:'uas',url:'https://uaserials.com/films/p/',title:'Новинки фільмів'},
{ id:'ym_row_series_new',type:'uas',url:'https://uaserials.com/series/p/',title:'Новинки серіалів'},
{ id:'ym_row_movies_watch',type:'uas',url:'https://uaserials.my/filmss/w/',title:'Популярні фільми'},
{ id:'ym_row_series_pop',type:'uas',url:'https://uaserials.com/series/w/',title:'Популярні серіали'},
{ id:'ym_row_random',type:'random',title:'Випадкова підбірка'}
];

let activeRows=[];

rowDefs.forEach(def=>{

let enabled=Lampa.Storage.get(def.id);
if(enabled===null || enabled===undefined) enabled=true;

let order=parseInt(Lampa.Storage.get(def.id+'_order')) || 1;

if(enabled) activeRows.push({...def,order:order});

});

activeRows.sort((a,b)=>a.order-b.order);

let parts=[];

activeRows.forEach(def=>{

parts.push((cb)=>{

if(def.type==='history'){
loadHistory(cb);
return;
}

if(def.type==='uas'){
Lampa.Api.get('tmdb','discover/movie',{
with_original_language:'uk',
page:1
},cb,()=>cb({results:[]}));
return;
}

if(def.type==='random'){
Lampa.Api.get('tmdb','trending/movie/week',{page:1},cb,()=>cb({results:[]}));
return;
}

});

});

Lampa.Api.partNext(parts,2,oncomplete,onerror);

};

}

function start(){

if(window.ua_main_minimal) return;
window.ua_main_minimal=true;

createSettings();
overrideApi();

}

if(window.appready) start();
else Lampa.Listener.follow('app',e=>{
if(e.type==='ready') start();
});

})();
