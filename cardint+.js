(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    var CONFIG = { 
        tmdbApiKey: '', 
        cacheTime: 23 * 60 * 60 * 1000, 
        language: 'uk',
        endpoint: 'https://wh.lme.isroot.in/',
        timeout: 10000,
        queue: { maxParallel: 10 }, 
        cache: {
            key: 'lme_wh_cache_v5', 
            size: 3000,
            positiveTtl: 1000 * 60 * 60 * 24,
            negativeTtl: 1000 * 60 * 60 * 6
        }
    };

    const PROXIES =[
        'https://cors.lampa.stream/',
        'https://cors.eu.org/',
        'https://corsproxy.io/?url='
    ];

    

    var inflight = {};
    var lmeCache = null;
    var listCache = {};      
    var tmdbItemCache = {};  
    var itemUrlCache = {};   
    var seasonsCache = {};

    Lampa.Lang.add({
        main: 'Р“РѕР»РѕРІРЅР° UA',
        title_main: 'Р“РѕР»РѕРІРЅР° UA',
        title_tmdb: 'Р“РѕР»РѕРІРЅР° UA'
    });

    var safeStorage = (function () {
        var memoryStore = {};
        try {
            if (typeof window.localStorage !== 'undefined') {
                var testKey = '__season_test_v5__';
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

    try { seasonsCache = JSON.parse(safeStorage.getItem('seasonBadgeCacheV5') || '{}'); } catch (e) {}

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

    async function fetchHtml(url) {
        for (let proxy of PROXIES) {
            try {
                let proxyUrl = proxy.includes('?url=') ? proxy + encodeURIComponent(url) : proxy + url;
                let res = await fetch(proxyUrl);
                if (res.ok) {
                    let text = await res.text();
                    if (text && text.length > 500 && text.includes('<html') && !text.includes('just a moment...')) {
                        return text;
                    }
                }
            } catch (e) {}
        }
        return '';
    }

    function getTmdbKey() {
        let custom = (Lampa.Storage.get('uas_pro_tmdb_apikey') || '').trim();
        return custom || CONFIG.tmdbApiKey || (Lampa.TMDB && Lampa.TMDB.key ? Lampa.TMDB.key() : '4ef0d7355d9ffb5151e987764708ce96');
    }

    function getTmdbEndpoint(path) {
        let url = Lampa.TMDB.api(path);
        if (!url.includes('api_key')) url += (url.includes('?') ? '&' : '?') + 'api_key=' + getTmdbKey();
        if (!url.startsWith('http')) url = 'https://api.themoviedb.org/3/' + url;
        return url;
    }

    function safeFetch(url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest(); xhr.open('GET', url, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, json: function() { return Promise.resolve(JSON.parse(xhr.responseText)); } });
                    else reject(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function () { reject(new Error('Network error')); }; xhr.send(null);
        });
    }

    async function fetchTmdbWithFallback(type, id) {
        let endpoint = getTmdbEndpoint(`${type}/${id}?language=uk`);
        let res = await fetch(PROXIES[0] + endpoint).then(r=>r.json()).catch(()=>null);
        if (res && (!res.overview || res.overview.trim() === '')) {
            let enEndpoint = getTmdbEndpoint(`${type}/${id}?language=en`);
            let enRes = await fetch(PROXIES[0] + enEndpoint).then(r=>r.json()).catch(()=>null);
            if (enRes && enRes.overview) res.overview = enRes.overview;
        }
        return res;
    }

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
                    .then(function (isSuccess) { lmeCache.set(meta.cacheKey, isSuccess); resolve(isSuccess); })
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

    function fetchSeriesData(tmdbId) {
        return new Promise(function (resolve, reject) {
            var now = (new Date()).getTime();
            if (seasonsCache[tmdbId] && (now - seasonsCache[tmdbId].timestamp < CONFIG.cacheTime)) return resolve(seasonsCache[tmdbId].data);
            
            if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.tv === 'function') {
                Lampa.TMDB.tv(tmdbId, function (data) {
                    seasonsCache[tmdbId] = { data: data, timestamp: now };
                    try { safeStorage.setItem('seasonBadgeCacheV5', JSON.stringify(seasonsCache)); } catch (e) {}
                    resolve(data);
                }, reject, { language: CONFIG.language });
            } else {
                var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + getTmdbKey() + '&language=' + CONFIG.language;
                safeFetch(url).then(function (r) { return r.json(); }).then(function(data) {
                    seasonsCache[tmdbId] = { data: data, timestamp: now };
                    try { safeStorage.setItem('seasonBadgeCacheV5', JSON.stringify(seasonsCache)); } catch (e) {}
                    resolve(data);
                }).catch(reject);
            }
        });
    }

    function renderSeasonBadge(cardHtml, tmdbData) {
        if (!tmdbData || !tmdbData.last_episode_to_air) return;
        var last = tmdbData.last_episode_to_air;
        var currentSeason = tmdbData.seasons.filter(function(s) { return s.season_number === last.season_number; })[0];
        
        if (currentSeason && last.season_number > 0) {
            var isComplete = currentSeason.episode_count > 0 && last.episode_number >= currentSeason.episode_count;
            var text = isComplete ? "S" + last.season_number : "S" + last.season_number + " " + last.episode_number + "/" + currentSeason.episode_count;
            
            var typeBadge = cardHtml.querySelector('.card__type');
            if (!typeBadge) {
                var view = cardHtml.querySelector('.card__view');
                if (!view) return;
                typeBadge = document.createElement('div');
                typeBadge.className = 'card__type';
                view.appendChild(typeBadge);
            }
            var bgColor = isComplete ? 'rgba(46, 204, 113, 0.8)' : 'rgba(170, 20, 20, 0.8)';
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

    

    
    function analyzeAndInvert(imgElement) {
        try {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = imgElement.naturalWidth || imgElement.width;
            canvas.height = imgElement.naturalHeight || imgElement.height;
            if (canvas.width === 0 || canvas.height === 0) return;
            ctx.drawImage(imgElement, 0, 0);
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var data = imageData.data;
            var darkPixels = 0, totalPixels = 0;
            for (var i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 10) continue; 
                totalPixels++;
                var brightness = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
                if (brightness < 120) darkPixels++;
            }
            if (totalPixels > 0 && (darkPixels / totalPixels) >= 0.85) imgElement.style.filter += " brightness(0) invert(1)";
        } catch (e) { }
    }

    function fetchLogo(movie, itemElement) {
        var mType = movie.media_type || (movie.name ? 'tv' : 'movie');
        var langPref = Lampa.Storage.get('ym_logo_lang', 'uk_en');
        var quality = Lampa.Storage.get('ym_img_quality', 'w300');
        var cacheKey = 'logo_uas_v8_' + quality + '_' + langPref + '_' + mType + '_' + movie.id;
        var cachedUrl = Lampa.Storage.get(cacheKey);

        function applyLogo(url) {
            if (url && url !== 'none') {
                var img = new Image();
                img.crossOrigin = "anonymous"; 
                img.className = 'card-custom-logo';
                img.onload = function() { analyzeAndInvert(img); itemElement.find('.card__view').append(img); };
                img.src = url;
            } else {
                var textLogo = document.createElement('div');
                textLogo.className = 'card-custom-logo-text';
                
                var txt = movie.title || movie.name;
                if (langPref === 'en') {
                    txt = movie.original_title || movie.original_name || txt;
                }
                
                textLogo.innerText = txt;
                itemElement.find('.card__view').append(textLogo);
            }
        }
        
        if (cachedUrl) { applyLogo(cachedUrl); return; }

        let endpoint = getTmdbEndpoint(`${mType}/${movie.id}/images?include_image_language=uk,en,null`);
        fetch(PROXIES[0] + endpoint).then(r => r.json()).then(function(res) {
            var finalLogo = 'none';
            if (res.logos && res.logos.length > 0) {
                var found = null;
                if (langPref === 'uk') {
                    found = res.logos.find(l => l.iso_639_1 === 'uk');
                } else if (langPref === 'en') {
                    found = res.logos.find(l => l.iso_639_1 === 'en');
                } else {
                    found = res.logos.find(l => l.iso_639_1 === 'uk') || res.logos.find(l => l.iso_639_1 === 'en');
                }

                if (found) finalLogo = PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + found.file_path);
            }
            Lampa.Storage.set(cacheKey, finalLogo);
            applyLogo(finalLogo);
        }).catch(function() {
            Lampa.Storage.set(cacheKey, 'none');
            applyLogo('none');
        });
    }

    

    
    

    function createSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;
        Lampa.SettingsApi.addComponent({
            component: 'ymainpage',
            name: 'YMainPage',
            icon: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_support_yarik', type: 'button' },
            field: { name: "РџС–РґС‚СЂРёРјР°С‚Рё СЂРѕР·СЂРѕР±РЅРёРєС–РІ: Yarik's Mod's", description: 'https://lampalampa.free.nf/' }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_support_lme', type: 'button' },
            field: { name: 'РџС–РґС‚СЂРёРјР°С‚Рё СЂРѕР·СЂРѕР±РЅРёРєС–РІ: LampaME', description: 'https://lampame.github.io/' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_show_flag', type: 'trigger', default: true },
            field: { name: 'Р’С–РґРѕР±СЂР°Р¶РµРЅРЅСЏ РЈРљР  РѕР·РІСѓС‡РѕРє', description: 'РџРѕС€СѓРє С‚Р° РІС–РґРѕР±СЂР°Р¶РµРЅРЅСЏ РїСЂР°РїРѕСЂС†СЏ РЅР° РєР°СЂС‚РєР°С…' }
        });

        var langValues = {
            'uk': 'РўС–Р»СЊРєРё СѓРєСЂР°С—РЅСЃСЊРєРѕСЋ',
            'uk_en': 'РЈРєСЂ + РђРЅРіР» (Р—Р° Р·Р°РјРѕРІС‡СѓРІР°РЅРЅСЏРј)',
            'en': 'РўС–Р»СЊРєРё Р°РЅРіР»С–Р№СЃСЊРєРѕСЋ'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_logo_lang', type: 'select', values: langValues, default: 'uk_en' },
            field: { name: 'РњРѕРІР° Р»РѕРіРѕС‚РёРїС–РІ', description: 'РћР±РµСЂС–С‚СЊ РїСЂС–РѕСЂРёС‚РµС‚ РјРѕРІРё РґР»СЏ Р»РѕРіРѕС‚РёРїС–РІ' }
        });

        var qualValues = {
            'w300': 'w300 (Р—Р° Р·Р°РјРѕРІС‡СѓРІР°РЅРЅСЏРј)',
            'w500': 'w500',
            'w780': 'w780',
            'original': 'РћСЂРёРіС–РЅР°Р»'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_img_quality', type: 'select', values: qualValues, default: 'w300' },
            field: { name: 'РЇРєС–СЃС‚СЊ Р·РѕР±СЂР°Р¶РµРЅСЊ (Р¤РѕРЅ/Р›РѕРіРѕ)', description: 'Р’РїР»РёРІР°С” РЅР° С€РІРёРґРєС–СЃС‚СЊ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ СЃС‚РѕСЂС–РЅРєРё' }
        });

        let orderValues = { '1': 'РџРѕР·РёС†С–СЏ 1', '2': 'РџРѕР·РёС†С–СЏ 2', '3': 'РџРѕР·РёС†С–СЏ 3', '4': 'РџРѕР·РёС†С–СЏ 4', '5': 'РџРѕР·РёС†С–СЏ 5', '6': 'РџРѕР·РёС†С–СЏ 6', '7': 'РџРѕР·РёС†С–СЏ 7', '8': 'РџРѕР·РёС†С–СЏ 8', '9': 'РџРѕР·РёС†С–СЏ 9' };

        DEFAULT_ROWS_SETTINGS.forEach(r => {
            Lampa.SettingsApi.addParam({
                component: 'ymainpage',
                param: { name: r.id, type: 'trigger', default: r.default },
                field: { name: 'Р’РёРјРєРЅСѓС‚Рё / РЈРІС–РјРєРЅСѓС‚Рё: ' + r.title, description: 'РџРѕРєР°Р·СѓРІР°С‚Рё С†РµР№ СЂСЏРґРѕРє РЅР° РіРѕР»РѕРІРЅС–Р№' }
            });
            Lampa.SettingsApi.addParam({
                component: 'ymainpage',
                param: { name: r.id + '_order', type: 'select', values: orderValues, default: r.defOrder },
                field: { name: 'РџРѕСЂСЏРґРѕРє: ' + r.title, description: 'РЇРєРёРј РїРѕ СЂР°С…СѓРЅРєСѓ РІРёРІРѕРґРёС‚Рё С†РµР№ СЂСЏРґРѕРє' }
            });
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_pro_tmdb_btn', type: 'button' },
            field: { name: 'Р’Р»Р°СЃРЅРёР№ TMDB API РєР»СЋС‡', description: 'РќР°С‚РёСЃРЅС–С‚СЊ, С‰РѕР± РІРІРµСЃС‚Рё РєР»СЋС‡ (РїСЂР°С†СЋС” РїРµСЂС€РѕС‡РµСЂРіРѕРІРѕ)' }
        });

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'ymainpage') {
                e.body.find('[data-name="uas_support_yarik"]').on('hover:enter', function () {
                    window.open('https://lampalampa.free.nf/', '_blank');
                });
                
                e.body.find('[data-name="uas_support_lme"]').on('hover:enter', function () {
                    window.open('https://lampame.github.io/main/#uk', '_blank');
                });

                e.body.find('[data-name="uas_pro_tmdb_btn"]').on('hover:enter', function () {
                    var currentKey = Lampa.Storage.get('uas_pro_tmdb_apikey') || '';
                    Lampa.Input.edit({
                        title: 'Р’РІРµРґС–С‚СЊ TMDB API РљР»СЋС‡', value: currentKey, free: true, nosave: true
                    }, function (new_val) {
                        if (new_val !== undefined) {
                            Lampa.Storage.set('uas_pro_tmdb_apikey', new_val.trim());
                            Lampa.Noty.show('TMDB РєР»СЋС‡ Р·Р±РµСЂРµР¶РµРЅРѕ. РџРµСЂРµР·Р°РїСѓСЃС‚С–С‚СЊ Р·Р°СЃС‚РѕСЃСѓРЅРѕРє.');
                        }
                    });
                });
            }
        });
    }

    

    function start() {
        if (window.uaserials_pro_v8_loaded) return;
        window.uaserials_pro_v8_loaded = true;

        lmeCache = new Cache(CONFIG.cache);
        lmeCache.init();

        createSettings();

        var style = document.createElement('style');
        style.innerHTML = `
            .card .card__age { display: none !important; }

            .card__view .card-badge-age { 
                display: block !important; right: 0 !important; top: 0 !important; padding: 0.2em 0.45em !important; 
                background: rgba(0, 0, 0, 0.6) !important; 
                position: absolute !important; margin-top: 0 !important; font-size: 1.1em !important; 
                z-index: 10 !important; color: #fff !important; font-weight: bold !important;
            }

            .card--wide-custom { width: 25em !important; margin-right: 0.2em !important; margin-bottom: 0 !important; position: relative; cursor: pointer; transition: transform 0.2s ease, z-index 0.2s ease; z-index: 1; }
            
            .card--wide-custom .card__view { border-radius: 0.4em !important; overflow: hidden !important; box-shadow: 0 3px 6px rgba(0,0,0,0.5); }
            .card--wide-custom .card-backdrop-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); pointer-events: none; border-radius: 0.4em !important; z-index: 1; }
            
            .card--wide-custom.focus { z-index: 99 !important; transform: scale(1.08); }
            .card--wide-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 3px solid #fff !important; outline: none !important; }
            .card--wide-custom.focus .card__view::after, .card--wide-custom.focus .card__view::before { display: none !important; content: none !important; }

            .card-custom-logo { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 70% !important; height: 70% !important; max-width: 70% !important; max-height: 70% !important; padding: 0 !important; margin: 0 !important; object-fit: contain; z-index: 5; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.8)); pointer-events: none; transition: filter 0.3s ease; }
            
            .card-custom-logo-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-height: 70%; text-align: center; font-size: 2em; font-weight: 600; color: #fff; text-shadow: none !important; z-index: 5; pointer-events: none; word-wrap: break-word; white-space: normal; line-height: 1.2; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }

            .card--wide-custom > div:not(.card__view):not(.custom-title-bottom):not(.custom-overview-bottom) { display: none !important; }
            .custom-title-bottom { width: 100%; text-align: left; font-size: 1.1em; font-weight: bold; margin-top: 0.3em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0.2em; }
            .custom-overview-bottom { width: 100%; text-align: left; font-size: 0.85em; color: #bbb; line-height: 1.2; margin-top: 0.2em; padding: 0 0.2em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; }
            
            .card__vote { right: 0 !important; bottom: 0 !important; padding: 0.2em 0.45em !important; z-index: 2; position: absolute !important; font-weight: bold; background: rgba(0,0,0,0.6); }
            .card__type { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; line-height: 1 !important; padding: 0.3em !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; align-items: center; justify-content: center; z-index: 2; color: #fff !important; transition: background 0.3s !important; }
            .card__type svg { width: 1.5em !important; height: 1.5em !important; }
            .card__type.card__type--season { font-size: 1.1em !important; font-weight: bold !important; padding: 0.2em 0.45em !important; font-family: Roboto, Arial, sans-serif !important; }
            .card__ua_flag { position: absolute !important; left: 0 !important; bottom: 0 !important; width: 2.4em !important; height: 1.4em !important; font-size: 1.3em !important; background: linear-gradient(180deg, #0057b8 50%, #ffd700 50%) !important; opacity: 0.8 !important; z-index: 2; }
            
            .card--wide-custom .card-badge-age { border-radius: 0 0 0 0.5em !important; }
            .card--wide-custom .card__vote { border-radius: 0.5em 0 0 0 !important; } 
            .card--wide-custom .card__type { border-radius: 0 0 0.5em 0 !important; }  
            .card--wide-custom .card__ua_flag { border-radius: 0 0.5em 0 0 !important; }

            .card:not(.card--wide-custom):not(.card--history-custom) .card-badge-age { border-radius: 0 0.8em 0 0.8em !important; }
            .card:not(.card--wide-custom):not(.card--history-custom) .card__vote { border-radius: 0.8em 0 0.8em 0 !important; }
            .card:not(.card--wide-custom):not(.card--history-custom) .card__type { border-radius: 0.8em 0 0.8em 0 !important; }
            .card:not(.card--wide-custom):not(.card--history-custom) .card__ua_flag { border-radius: 0 0.8em 0 0.8em !important; }

            .items-line[data-uas-title-row="true"] .items-line__head { display: none !important; }
            .items-line[data-uas-content-row="true"] .items-line__head { display: none !important; }
            
            .items-line[data-uas-title-row="true"] { margin-top: 0 !important; margin-bottom: 0.5em !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-title-row="true"] .items-line__body { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-title-row="true"] .scroll__item { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            
            .items-line[data-uas-content-row="true"] { margin-top: 0.1em !important; margin-bottom: 0.5em !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-content-row="true"] .items-line__body { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-content-row="true"] .scroll__item { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }

            .card--title-btn {
                width: 100vw !important; 
                max-width: 100% !important; 
                height: auto !important;
                background: transparent !important;
                border-radius: 1.5em !important;
                margin: 0.2em 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important; 
                padding: 0.5em 1.5em !important; 
                cursor: pointer !important;
                border: 2px solid transparent !important; 
                box-shadow: none !important;
                box-sizing: border-box !important;
                transition: transform 0.2s ease, border 0.2s ease, background 0.2s ease !important;
            }

            .card--title-btn.focus {
                background: rgba(255, 255, 255, 0.05) !important;
                border: 2px solid #fff !important;
                box-shadow: none !important;
                outline: none !important;
                transform: scale(1.01) !important;
            }

            .title-btn-text {
                display: flex !important;
                align-items: center !important;
                font-size: 1.4em !important;
                font-weight: bold !important;
                color: #777 !important; 
                border: none !important; 
                padding: 0 !important;
                line-height: 1.2 !important;
                text-align: left !important;
                transition: color 0.2s ease, transform 0.2s ease !important;
            }

            .title-btn-icon {
                height: 1.1em !important;
                width: auto !important;
                margin-right: 0.5em !important;
                filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5)) !important;
            }

            .card--title-btn.focus .title-btn-text {
                color: #fff !important; 
                text-shadow: none !important; 
                box-shadow: none !important; 
            }

            .card--title-btn-static {
                cursor: default !important;
            }
            .card--title-btn-static .title-btn-text {
                opacity: 0.5 !important; 
            }

            .card--title-btn .card__view, 
            .card--title-btn .card__view::after, 
            .card--title-btn .card__view::before {
                display: none !important;
            }

            .card--collection-btn {
                width: 16em !important;
                height: 7em !important;
                background: rgba(40,40,40,0.8) !important;
                border-radius: 0.8em !important;
                margin-right: 0.8em !important;
                margin-bottom: 0.8em !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1em !important;
                cursor: pointer !important;
                border: 2px solid transparent !important;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
                transition: transform 0.2s ease, background 0.2s ease, border 0.2s ease !important;
                text-align: center !important;
                box-sizing: border-box !important;
                position: relative;
            }

            .card--collection-btn.focus {
                background: rgba(60,60,60,0.9) !important;
                border: 2px solid #fff !important;
                transform: scale(1.05) !important;
                z-index: 99 !important;
            }

            .card--collection-btn .collection-title {
                font-size: 1.1em !important;
                font-weight: bold !important;
                color: #fff !important;
                line-height: 1.3 !important;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .card--collection-btn .card__view, 
            .card--collection-btn .card__view::after, 
            .card--collection-btn .card__view::before {
                display: none !important;
            }

            .card--history-custom {
                width: 16em !important;
                margin-right: 0.8em !important;
                margin-bottom: 0 !important;
                position: relative;
                cursor: pointer;
                transition: transform 0.2s ease, z-index 0.2s ease;
                z-index: 1;
            }
            
            .card--history-custom .card__view {
                border-radius: 0.8em !important;
                overflow: hidden !important;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            }
            
            .card--history-custom .card-backdrop-overlay {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); pointer-events: none; border-radius: 0.8em !important; z-index: 1;
            }
            
            .card--history-custom.focus { z-index: 99 !important; transform: scale(1.08); }
            .card--history-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 2px solid #fff !important; outline: none !important; }
            .card--history-custom.focus .card__view::after, .card--history-custom.focus .card__view::before { display: none !important; content: none !important; }

            .card--history-custom > div:not(.card__view) { display: none !important; }

            .card--history-custom .card-badge-age { border-radius: 0 0 0 0.8em !important; }
            .card--history-custom .card__vote { border-radius: 0.8em 0 0 0 !important; } 
            .card--history-custom .card__type { border-radius: 0 0 0.8em 0 !important; }  
            .card--history-custom .card__ua_flag { border-radius: 0 0.8em 0 0 !important; }

            .card--history-custom .card-custom-logo-text { font-size: 1.2em !important; padding: 0 0.5em; }
        `;
        document.head.appendChild(style);

        Lampa.Listener.follow('line', function (e) {
            if (e.type === 'create' && e.data && e.line && e.line.render) {
                var el = e.line.render();
                if (e.data.uas_title_row) el.attr('data-uas-title-row', 'true');
                if (e.data.uas_content_row) el.attr('data-uas-content-row', 'true');
            }
        });

        var initialFocusHandled = true; 

        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start') {
                initialFocusHandled = false;
            }
        });

        Lampa.Listener.follow('controller', function (e) {
            if (e.type === 'focus' && !initialFocusHandled) {
                initialFocusHandled = true; 
                var target = $(e.target);
                if (target.hasClass('card--title-btn')) {
                    setTimeout(function() {
                        Lampa.Controller.move('down');
                    }, 20); 
                }
            }
        });

        var CardMaker = Lampa.Maker.map('Card');
        var originalOnVisible = CardMaker.Card.onVisible;

        CardMaker.Card.onVisible = function () {
            originalOnVisible.apply(this, arguments);
            var cardInstance = this;
            var html = this.html;
            var data = this.data;
            if (!html || !data) return;

            if (data.is_title_btn || data.is_collection_btn) return;

            var isWideCard = html.classList.contains('card--wide-custom') || $(html).hasClass('card--wide-custom');
            var isHistoryCard = html.classList.contains('card--history-custom') || $(html).hasClass('card--history-custom');
            var isSpecialCard = isWideCard || isHistoryCard;

            var view = html.querySelector('.card__view');
            if (view && data) {
                var ageBadge = view.querySelector('.card-badge-age');
                if (!ageBadge) {
                    var yearStr = (data.release_date || data.first_air_date || '').toString().substring(0, 4);
                    if (yearStr && yearStr.length === 4) {
                        ageBadge = document.createElement('div');
                        ageBadge.className = 'card-badge-age';
                        ageBadge.innerText = yearStr;
                        view.appendChild(ageBadge);
                    }
                }
            }

            var vote = html.getElementsByClassName('card__vote');
            if (vote.length > 0) {
                var color = getColor(parseFloat(vote[0].textContent.trim()), 0.8);
                if (color) vote[0].style.backgroundColor = color;
            }

            var showFlag = Lampa.Storage.get('uas_show_flag');
            if (showFlag === null || showFlag === undefined) showFlag = true;

            if (showFlag && data.id) {
                var oldFlag = html.querySelector('.card__ua_flag');
                if (oldFlag) oldFlag.remove();

                var meta = createMediaMeta(data);
                if (meta) {
                    var cached = lmeCache.get(meta.cacheKey);
                    if (cached === true) renderFlag(html);
                    else if (cached !== false) {
                        loadFlag(meta).then(function (isSuccess) {
                            if (isSuccess && cardInstance.html.parentNode) renderFlag(cardInstance.html);
                        });
                    }
                }
            } else if (!showFlag && !isSpecialCard) {
                var oldFlag = html.querySelector('.card__ua_flag');
                if (oldFlag) oldFlag.remove();
            }

            if ((data.media_type === 'tv' || data.name || data.number_of_seasons) && data.id) {
                fetchSeriesData(data.id).then(function(tmdbData) {
                    if (cardInstance.html.parentNode && cardInstance.data === data) {
                        renderSeasonBadge(cardInstance.html, tmdbData);
                    }
                }).catch(function(){});
            }
        };

    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });

})();
