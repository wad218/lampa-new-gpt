function startPlugin() {  
    window.plugin_watched_ready = true  
  
    let manifest = {  
        type: 'video',  
        version: '1.0.1',  
        name: Lampa.Lang.translate('title_watched'),  
        description: 'Shows watched movies and TV series',  
        component: 'watched'  
    }  
      
    Lampa.Manifest.plugins = manifest  
  
      // Компонент для відображення сторінки з бокового меню
    function component(object){  
        let comp = new Lampa.InteractionMain(object)  
  
        comp.create = function(){  
            this.activity.loader(true)  
  
            let all = Lampa.Favorite.all()  
            let history = all.history || []  
  
            let results = history.slice(0, 50).map(item => {
                let ready = Lampa.Arrays.clone(item);
                // Обов'язково чистимо опис для бокового меню, щоб текст не накладався
                ready.overview = ''; 
                return ready;
            });

            this.build({  
                results: results,  
                title: Lampa.Lang.translate('title_watched'),
                // Вказуємо тип лінії для сітки в боковому меню
                // 'poster' зробить їх вертикальними та чистими як у каталозі
                line_type: 'poster' 
            })  
            
            // Додатковий метод для примусового очищення стилів
            this.render().find('.items').addClass('category-full');

            return this.render()  
        }  
  
        comp.onMore = function(data){  
            Lampa.Activity.push({  
                url: 'history',  
                title: Lampa.Lang.translate('menu_history'),  
                component: 'favorite',  
                page: 2  
            })  
        }  
  
        return comp  
    }
  
    // Додаємо контент на головний екран
    if(Lampa.Manifest.app_digital >= 300){  
        Lampa.ContentRows.add({  
            name: 'watched_main',  
            title: Lampa.Lang.translate('title_watched'),  
            index: 0, 
            screen: ['main'],  
            call: (params, screen) => {
    let all = Lampa.Favorite.all();
    let history = all.history || [];

    if (!history.length) return;

    return function(call) {
        let results = history.slice(0, 20).map(item => {
            let ready = Lampa.Arrays.clone(item);
            // Копіюємо опис у поле description, яке часто використовується UI-модами
            ready.description = item.overview || '';
            ready.background_image = item.img || item.poster || item.backdrop_path;
            return ready;
        });

        call({
            results: results,
            title: Lampa.Lang.translate('title_watched'),
            card_events: true,
            // Це важливо: додаємо клас, який дозволить тексту бути видимим
            class: 'force-show-description',
            // Кажемо системі, що опис має бути статичним
            static: true,
            // Додаємо опис самого каналу (деякі UI плагіни виводять його)
            description: Lampa.Lang.translate('title_watched')
        });
    }
}  
  
    function add(){  
        let button = $(`<li class="menu__item selector">  
            <div class="menu__ico">  
                <svg height="36" viewBox="0 0 38 36" fill="none" xmlns="http://www.w3.org/2000/svg">  
                    <path d="M19 2C9.6 2 2 9.6 2 19s7.6 17 17 17 17-7.6 17-17S28.4 2 19 2zm0 30c-7.2 0-13-5.8-13-13s5.8-13 13-13 13 5.8 13 13-5.8 13-13 13z" fill="currentColor"/>  
                    <path d="M15 14v10l8-5-8-5z" fill="currentColor"/>  
                </svg>  
            </div>  
            <div class="menu__text">${manifest.name}</div>  
        </li>`)  
  
        button.on('hover:enter', function () {  
            Lampa.Activity.push({  
                url: '',  
                title: manifest.name,  
                component: 'watched',  
                page: 1  
            })  
        })  
  
        $('.menu .menu__list').eq(0).append(button)  
    }  
  
    Lampa.Component.add('watched', component)  
  
    if(window.appready) add()  
    else{  
        Lampa.Listener.follow('app', function (e) {  
            if (e.type == 'ready') add()  
        })  
    }  
}  
  
if(!window.plugin_watched_ready && Lampa.Manifest.app_digital >= 242) startPlugin()
