function startPlugin() {  
    window.plugin_watched_ready = true;

    // 1. Реєструємо стилі для примусового показу опису
    Lampa.Template.add('watched_style', `
        <style>
            /* Примусово розширюємо висоту контейнера і показуємо текст */
            .watched_main .card--wide .card__info {
                display: flex !important;
                flex-direction: column !important;
                justify-content: flex-end !important;
            }

            .watched_main .card__description {
                display: -webkit-box !important;
                -webkit-line-clamp: 3 !important; /* Обмежуємо до 3 рядків */
                -webkit-box-orient: vertical !important;
                overflow: hidden !important;
                opacity: 1 !important;
                visibility: visible !important;
                height: auto !important;
                margin-top: 0.5rem !important;
                font-size: 1.2rem !important; /* Трохи збільшимо для TV */
            }

            /* Додатковий фікс для Mi Box */
            .watched_main .card__info {
                display: block !important;
            }
        </style>
    `);
    $('body').append(Lampa.Template.get('watched_style'));

    let manifest = {  
        type: 'video',  
        version: '1.0.1',  
        name: Lampa.Lang.translate('title_watched'),  
        description: 'Shows watched movies and TV series',  
        component: 'watched'  
    };  
      
    Lampa.Manifest.plugins = manifest;  

    // 2. Компонент для бокового меню
    function component(object){  
        let comp = new Lampa.InteractionMain(object);  
  
        comp.create = function(){  
            this.activity.loader(true);  
            let all = Lampa.Favorite.all();  
            let history = all.history || [];  
  
            let results = history.slice(0, 50).map(item => {
                let ready = Lampa.Arrays.clone(item);
                ready.overview = ''; 
                return ready;
            });

            this.build({  
                results: results,  
                title: Lampa.Lang.translate('title_watched'),
                line_type: 'poster' 
            });  
            
            this.render().find('.items').addClass('category-full');
            return this.render();
        };  
  
        comp.onMore = function(data){  
            Lampa.Activity.push({  
                url: 'history',  
                title: Lampa.Lang.translate('menu_history'),  
                component: 'favorite',  
                page: 2  
            });
        };  
  
        return comp;
    }
  
    // 3. Додаємо контент на головний екран
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

                return function (call) {
                    let results = history.slice(0, 20).map(item => {
                        let ready = Lampa.Arrays.clone(item);
                        ready.overview = item.overview || '';
                        ready.description = item.overview || '';
                        if(!ready.vote_average) ready.vote_average = item.vote_average || '0.0';
                        ready.background_image = item.img || item.backdrop_path || item.poster;
                        return ready;
                    });

                    call({
                        results: results,
                        title: Lampa.Lang.translate('title_watched'),
                        card_events: true,
                        line_type: 'wide',
                        static: true,
                        type: 'movie',
                        display: 'show',
                        hide_timeline: false
                    });
                };
            } // Закриваємо call
        }); // Закриваємо ContentRows.add
    }
  
    // 4. Функція додавання кнопки в меню
    function add(){  
        let button = $(`<li class="menu__item selector">  
            <div class="menu__ico">  
                <svg height="36" viewBox="0 0 38 36" fill="none" xmlns="http://www.w3.org/2000/svg">  
                    <path d="M19 2C9.6 2 2 9.6 2 19s7.6 17 17 17 17-7.6 17-17S28.4 2 19 2zm0 30c-7.2 0-13-5.8-13-13s5.8-13 13-13 13 5.8 13 13-5.8 13-13 13z" fill="currentColor"/>  
                    <path d="M15 14v10l8-5-8-5z" fill="currentColor"/>  
                </svg>  
            </div>  
            <div class="menu__text">${manifest.name}</div>  
        </li>`);  
  
        button.on('hover:enter', function () {  
            Lampa.Activity.push({  
                url: '',  
                title: manifest.name,  
                component: 'watched',  
                page: 1  
            });  
        });  
  
        $('.menu .menu__list').eq(0).append(button);  
    }  
  
    Lampa.Component.add('watched', component);  
  
    if(window.appready) add();  
    else {  
        Lampa.Listener.follow('app', function (e) {  
            if (e.type == 'ready') add();  
        });  
    }  
}  
  
if(!window.plugin_watched_ready && Lampa.Manifest.app_digital >= 242) startPlugin();
