(function () {
    'use strict';

    // --- МАНІФЕСТ ПЛАГІНУ ---
    var manifest = {
        type: 'other',
        version: '2.1.0',
        author: '@lme_chat',
        name: 'Card Styles Pro',
        description: 'Кастомний стиль карток + Напівпрозорий Прапор України + Бейджі сезонів (у верхньому лівому куті)',
        component: 'card_styles_pro'
    };

    // --- НАЛАШТУВАННЯ ---
    var CONFIG = { 
        tmdbApiKey: '', 
        cacheTime: 23 * 60 * 60 * 1000, 
        enabled: true, 
        language: 'uk',
        endpoint: 'https://wh.lme.isroot.in/',
        timeout: 10000,
        uiDeadline: 2200,
        queue: { maxParallel: 8 },
        cache: {
            key: 'nightingale_wh_cache_v1',
            size: 3000,
            positiveTtl: 1000 * 60 * 60 * 24,
            negativeTtl: 1000 * 60 * 60 * 6
        }
    };

    // --- БАЗА ДАНИХ ТА КЕШ ---
    var inflight = {};
    var nightingaleCache = null;
    
    var safeStorage = (function () {
        var memoryStore = {};
        try {
            if (typeof window.localStorage !== 'undefined') {
                var testKey = '__season_test__';
                window.localStorage.setItem(testKey, '1');
                window.localStorage.removeItem(testKey);
                return window.localStorage;
            }
        } catch (e) {}
        return {
            getItem: function (k) { return memoryStore.hasOwnProperty(k) ? memoryStore[k] : null; },
            setItem: function (k, v) { memoryStore[k] = String(v); },
            removeItem: function (k) { delete memoryStore[k]; }
        };
    })();

    var seasonsCache = {};
    try { seasonsCache = JSON.parse(safeStorage.getItem('seasonBadgeCache') || '{}'); } catch (e) {}

    // --- ДОПОМІЖНІ ФУНКЦІЇ NIGHTINGALE ---
    function debounce(func, wait) {
        var timer;
        return function () {
            var context = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () { func.apply(context, args); }, wait);
        };
    }

    function Cache(config) {
        var self = this;
        var storage = {};

        function cleanupExpired() {
            var now = Date.now(), changed = false, keys = Object.keys(storage);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i], node = storage[key];
                if (!node || !node.timestamp || typeof node.value !== 'boolean') { delete storage[key]; changed = true; continue; }
                var ttl = node.value ? config.positiveTtl : config.negativeTtl;
                if (node.timestamp <= now - ttl) { delete storage[key]; changed = true; }
            }
            if (changed) self.save();
        }

        self.save = debounce(function () { Lampa.Storage.set(config.key, storage); }, 400);
        self.init = function () { storage = Lampa.Storage.get(config.key, {}) || {}; cleanupExpired(); };
        self.get = function (id) {
            var node = storage[id];
            if (!node || !node.timestamp || typeof node.value !== 'boolean') return null;
            var ttl = node.value ? config.positiveTtl : config.negativeTtl;
            if (node.timestamp > Date.now() - ttl) return node.value;
            delete storage[id]; self.save(); return null;
        };
        self.set = function (id, value) {
            cleanupExpired();
            storage[id] = { timestamp: Date.now(), value: !!value };
            self.save();
        };
    }

    var requestQueue = {
        activeCount: 0, queue:[], maxParallel: CONFIG.queue.maxParallel,
        add: function (task) { this.queue.push(task); this.process(); },
        process: function () {
            var _this = this;
            while (this.activeCount < this.maxParallel && this.queue.length) {
                var task = this.queue.shift(); this.activeCount++;
                Promise.resolve().then(task)["catch"](function () {})["finally"](function () { _this.activeCount--; _this.process(); });
            }
        }
    };

    function createMediaMeta(data) {
        var tmdbId = parseInt(data && data.id, 10);
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;
        
        var mediaKind = String(data.media_type || '').toLowerCase();
        if (mediaKind !== 'tv' && mediaKind !== 'movie') {
            if (data.original_name || data.first_air_date || data.number_of_seasons) mediaKind = 'tv';
            else if (data.title || data.original_title || data.release_date) mediaKind = 'movie';
            else return null;
        }
        return { tmdbId: tmdbId, mediaKind: mediaKind, serial: mediaKind === 'tv' ? 1 : 0, cacheKey: mediaKind + ':' + tmdbId };
    }

    function isSuccessResponse(response) {
        if (response === true) return true;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            if (response.error || response.status === 'error' || response.success === false || response.ok === false) return false;
            if (response.success === true || response.status === 'success' || response.ok === true) return true;
            if (response.play && typeof response.play === 'string' && response.play.trim().length > 0) return true;
            if (response.data) {
                if (response.data === true) return true;
                if (typeof response.data === 'object' && Object.keys(response.data).length > 0 && !response.data.error) return true;
            }
            return Object.keys(response).length > 0;
        }
        return false;
    }

    function loadFlag(meta) {
        if (!inflight[meta.cacheKey]) {
            inflight[meta.cacheKey] = new Promise(function (resolve) {
                requestQueue.add(function () {
                    var url = CONFIG.endpoint + '?tmdb_id=' + encodeURIComponent(meta.tmdbId) + '&serial=' + meta.serial + '&silent=true';
                    return new Promise(function (res) { Lampa.Network.silent(url, function (r) { res(isSuccessResponse(r)); }, function () { res(false); }, null, { timeout: CONFIG.timeout }); })
                    .then(function (isSuccess) { nightingaleCache.set(meta.cacheKey, isSuccess); resolve(isSuccess); })
                    .finally(function () { delete inflight[meta.cacheKey]; });
                });
            });
        }
        return inflight[meta.cacheKey];
    }

    function renderFlag(cardHtml) {
        var view = cardHtml.querySelector('.card__view');
        if (!view || view.querySelector('.card__ua_flag')) return;
        var badge = document.createElement('div');
        badge.className = 'card__ua_flag';
        view.appendChild(badge);
    }

    // --- ДОПОМІЖНІ ФУНКЦІЇ SEASONS ---
    function safeFetch(url) {
        return new Promise(function (resolve, reject) {
            try {
                var xhr = new XMLHttpRequest(); xhr.open('GET', url, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, json: function() { return Promise.resolve(JSON.parse(xhr.responseText)); } });
                        else reject(new Error('HTTP ' + xhr.status));
                    }
                };
                xhr.onerror = function () { reject(new Error('Network error')); }; xhr.send(null);
            } catch (err) { reject(err); }
        });
    }

    function fetchSeriesData(tmdbId) {
        return new Promise(function (resolve, reject) {
            var now = (new Date()).getTime();
            if (seasonsCache[tmdbId] && (now - seasonsCache[tmdbId].timestamp < CONFIG.cacheTime)) return resolve(seasonsCache[tmdbId].data);
            
            if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.tv === 'function') {
                Lampa.TMDB.tv(tmdbId, function (data) {
                    seasonsCache[tmdbId] = { data: data, timestamp: now };
                    try { safeStorage.setItem('seasonBadgeCache', JSON.stringify(seasonsCache)); } catch (e) {}
                    resolve(data);
                }, reject, { language: CONFIG.language });
            } else if (CONFIG.tmdbApiKey) {
                var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + CONFIG.tmdbApiKey + '&language=' + CONFIG.language;
                safeFetch(url).then(function (r) { return r.json(); }).then(function(data) {
                    seasonsCache[tmdbId] = { data: data, timestamp: now };
                    try { safeStorage.setItem('seasonBadgeCache', JSON.stringify(seasonsCache)); } catch (e) {}
                    resolve(data);
                }).catch(reject);
            } else reject();
        });
    }

    function renderSeasonBadge(cardHtml, tmdbData) {
        if (!tmdbData || !tmdbData.last_episode_to_air) return;
        var last = tmdbData.last_episode_to_air;
        var currentSeason = tmdbData.seasons.filter(function(s) { return s.season_number === last.season_number; })[0];
        
        if (currentSeason && last.season_number > 0) {
            // Перевіряємо чи сезон завершений (всі серії вийшли)
            var isComplete = currentSeason.episode_count > 0 && last.episode_number >= currentSeason.episode_count;
            var text = isComplete ? "S" + last.season_number : "S" + last.season_number + " " + last.episode_number + "/" + currentSeason.episode_count;
            
            // Знаходимо існуючий бейдж "card__type" (там де іконка TV)
            var typeBadge = cardHtml.querySelector('.card__type');
            
            // Якщо його немає (що буває рідко), створюємо його в тому ж місці
            if (!typeBadge) {
                var view = cardHtml.querySelector('.card__view');
                if (!view) return;
                typeBadge = document.createElement('div');
                typeBadge.className = 'card__type';
                view.appendChild(typeBadge);
            }
            
            // Задаємо кольори: смарагдовий (завершено) або темно-червоний (не завершено)
            var bgColor = isComplete ? 'rgba(46, 204, 113, 0.8)' : 'rgba(170, 20, 20, 0.8)';
            
            // Замінюємо іконку на текст сезону
            typeBadge.innerHTML = text;
            typeBadge.classList.add('card__type--season');
            typeBadge.style.backgroundColor = bgColor;
        }
    }

    function getColor(rating, alpha) {
        var rgb = '';
        if (rating >= 0 && rating <= 3) rgb = '231, 76, 60';
        else if (rating > 3 && rating <= 5) rgb = '230, 126, 34';
        else if (rating > 5 && rating <= 6.5) rgb = '241, 196, 15';
        else if (rating > 6.5 && rating < 8) rgb = '52, 152, 219';
        else if (rating >= 8 && rating <= 10) rgb = '46, 204, 113';
        return rgb ? 'rgba(' + rgb + ', ' + alpha + ')' : null;
    }

    // --- ОСНОВНА ІНІЦІАЛІЗАЦІЯ ---
    function start() {
        if (window.card_styles_pro_fixed) return;
        window.card_styles_pro_fixed = true;

        if (Lampa.Manifest) Lampa.Manifest.plugins = manifest;
        
        nightingaleCache = new Cache(CONFIG.cache);
        nightingaleCache.init();

        var s = Lampa.Storage.get('sbadger_settings_v1') || {};
        if (s.tmdb_key) CONFIG.tmdbApiKey = s.tmdb_key;

        // Вбудовуємо CSS
        var style = document.createElement('style');
        style.innerHTML =
            '.card__vote { right: 0 !important; bottom: 0 !important; padding: 0.2em 0.45em !important; border-radius: 0.75em 0 !important; z-index: 2; }' +
            '.card__view .card__age { right: 0 !important; top: 0 !important; padding: 0.2em 0.45em !important; border-radius: 0 0.75em !important; background: rgba(0, 0, 0, 0.5) !important; position: absolute !important; margin-top: 0 !important; font-size: 1.3em !important; font-weight: bold !important; z-index: 2; }' +
            
            /* Стилізація базового бейджа card__type у лівому верхньому куті */
            '.card__type { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; line-height: 1 !important; padding: 0.3em !important; border-radius: 0.75em 0 0.75em 0 !important; background: rgba(45, 60, 80, 0.75) !important; display: flex !important; align-items: center; justify-content: center; z-index: 2; color: #fff !important; transition: background 0.3s !important; }' +
            '.card__type svg { width: 1.5em !important; height: 1.5em !important; }' +
            
            /* Додатковий клас, коли бейдж замінюється на текст сезонів */
            '.card__type.card__type--season { font-size: 1.3em !important; font-weight: bold !important; padding: 0.2em 0.45em !important; font-family: Roboto, Arial, sans-serif !important; }' +
            '.card__icons { top: 2.4em !important; }' +
            
            /* Напівпрозорий Прапор України */
            '.card__ua_flag { position: absolute !important; left: 0 !important; bottom: 0 !important; width: 2.4em !important; height: 1.4em !important; font-size: 1.3em !important; border-radius: 0 0.75em 0 0.75em !important; background: linear-gradient(180deg, #0057b8 50%, #ffd700 50%) !important; opacity: 0.8 !important; z-index: 2; }';
        document.head.appendChild(style);

        // Перехоплюємо рендер картки
        var CardMaker = Lampa.Maker.map('Card');
        var originalOnVisible = CardMaker.Card.onVisible;

        CardMaker.Card.onVisible = function () {
            originalOnVisible.apply(this, arguments);
            var cardInstance = this;
            var html = this.html;
            var data = this.data;
            if (!html || !data) return;

            // 1. Стилі карток (Завжди починаємо зі стандартної SVG-іконки)
            var tv = html.getElementsByClassName('card__type');
            if (tv.length > 0) {
                var element = tv[0];
                // Скидаємо бейдж до стандартної SVG іконки під час першого рендеру
                // Це не дозволить показати невірні дані сезонів, якщо картка була використана повторно (VirtualList)
                element.classList.remove('card__type--season');
                element.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 51.802 51.801"><path d="M47.947 4.43H12.495A3.86 3.86 0 0 0 8.64 8.284v2.641h-.466a3.86 3.86 0 0 0-3.855 3.854v2.642h-.465A3.86 3.86 0 0 0 0 21.275v22.242a3.86 3.86 0 0 0 3.854 3.854h35.453a3.86 3.86 0 0 0 3.855-3.854v-2.644h.465a3.86 3.86 0 0 0 3.854-3.854v-2.641h.467a3.86 3.86 0 0 0 3.854-3.854V8.284a3.857 3.857 0 0 0-3.855-3.854m-8.75 25.987v12.99H3.963V21.385h35.234zm4.321 6.494h-.355V21.275a3.86 3.86 0 0 0-3.855-3.854H12.604v-.001H8.641v-1.266h-.357v-1.266h35.235V36.91zm4.321-6.494h-.356V14.78a3.86 3.86 0 0 0-3.854-3.854H12.604V8.394H47.84z" fill="currentColor"></path><path d="m26.401 30.446-5.788-4.215a1.916 1.916 0 0 0-3.044 1.549v8.43a1.914 1.914 0 0 0 1.916 1.916c.398 0 .794-.125 1.128-.367l5.788-4.215a1.92 1.92 0 0 0 0-3.098" fill="currentColor"></path></svg>';
            }

            var vote = html.getElementsByClassName('card__vote');
            if (vote.length > 0) {
                var color = getColor(parseFloat(vote[0].textContent.trim()), 0.8);
                if (color) vote[0].style.backgroundColor = color;
            }

            var age = html.querySelector('.card__age');
            var view = html.querySelector('.card__view');
            if (age && view) view.appendChild(age);

            // 2. Очищення від попередніх бейджів локалізації
            var oldFlag = html.querySelector('.card__ua_flag');
            if (oldFlag) oldFlag.remove();

            // 3. Nightingale Прапор
            if (data.source && (data.source === 'tmdb' || data.source === 'cub')) {
                var meta = createMediaMeta(data);
                if (meta) {
                    var cached = nightingaleCache.get(meta.cacheKey);
                    if (cached === true) {
                        renderFlag(html);
                    } else if (cached !== false) {
                        loadFlag(meta).then(function (isSuccess) {
                            if (isSuccess && cardInstance.html.parentNode) renderFlag(cardInstance.html);
                        });
                    }
                }
            }

            // 4. Завантаження даних Сезонів (Замінить ліву верхню іконку при успіху)
            if (CONFIG.enabled && (data.name || data.first_air_date || data.number_of_seasons || data.media_type === 'tv')) {
                fetchSeriesData(data.id).then(function(tmdbData) {
                    if (cardInstance.html.parentNode && cardInstance.data === data) {
                        renderSeasonBadge(cardInstance.html, tmdbData);
                    }
                }).catch(function(){});
            }
        };

        // --- ДОДАВАННЯ НАЛАШТУВАНЬ В МЕНЮ ---
        if (Lampa.SettingsApi) {
            Lampa.Template.add('settings_card_styles_pro', '<div></div>');
            Lampa.SettingsApi.addParam({
                component: 'interface',
                param: { type: 'button', component: 'card_styles_pro' },
                field: { name: 'Стилі та Сезони', description: 'Налаштування прогресу серій (TMDB API)' },
                onChange: function () { Lampa.Settings.create('card_styles_pro', { template: 'settings_card_styles_pro', onBack: function () { Lampa.Settings.create('interface'); } }); }
            });
            Lampa.SettingsApi.addParam({
                component: 'card_styles_pro',
                param: { name: 'sbadger_tmdb_key', type: 'input', values: '', "default": CONFIG.tmdbApiKey },
                field: { name: 'TMDB API ключ', description: 'Необов\'язково, Lampa має вбудований ключ. За потреби введіть власний.' },
                onChange: function (v) { CONFIG.tmdbApiKey = String(v || '').trim(); Lampa.Storage.set('sbadger_settings_v1', {tmdb_key: CONFIG.tmdbApiKey}); }
            });
        }
    }

    if (window.appready) start();
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') start(); }); }
})();
