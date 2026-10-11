const SUPABASE_URL = 'https://sodicdqwfxcjakgsdspb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zea9GDv7bDpjDCHgDKNazQ_6240ZBp7';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allAnimeData = [];
let currentEpisodes = [];
let activeCategory = 'all';
let realtimeChannel = null;

let currentUser = {
    nickname: localStorage.getItem('af_user_nick') || '',
    avatar: localStorage.getItem('af_user_avatar') || '',
    role: 'User'
};

let playerSettings = {
    theme: localStorage.getItem('af_theme') || 'sakura',
    customBg: localStorage.getItem('af_custom_bg') || '',
    lang: localStorage.getItem('af_lang') || 'PL',
    preferredHost: parseInt(localStorage.getItem('af_preferred_host') || '0')
};

const mottosList = [
    "Lepiej po tych odcinkach unikaj trawy!",
    "dla lepszych wrażeń dodaj rozszerzenie Ublock orgin!",
    "Nie daj sie ponieść fantazjom!",
    "każdy kocha anime... a anime kocha nas!",
    "Światło co ty tu rozisz? (tekst nawiązany do anime death note)",
    "Dobry dzień!",
    "Wódeczkę do seansu?",
    "Szykuj popcorn!",
    "Masz jaja wchodząc na tą strone.",
    "Właściciel poleca: Cyberpunk: Edgerunners",
    "Siemaaaa",
    "Pomidor!",
    "Lubie fantazy. Ty też?",
    "Szukamy Administracji!"
];

window.onload = async () => {
    createSakuraPetals();
    await checkUserRegistration();
    applySavedTheme();
    fetchAnime();
    runNetflixIntro();
    initRealtimeWatchFeed();
    checkContinueWatching();
    initSearchShortcut();
};

/* SKRÓT KLAWISZOWY: '/' lub 'Ctrl+K' aktywuje wyszukiwarkę */
function initSearchShortcut() {
    window.addEventListener('keydown', (e) => {
        if ((e.key === '/' || (e.ctrlKey && e.key === 'k') || (e.metaKey && e.key === 'k')) && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.focus();
        }
    });
}

/* REALTIME WATCH FEED (Supabase Broadcast) */
function initRealtimeWatchFeed() {
    realtimeChannel = _supabase.channel('watch_events');
    
    realtimeChannel
        .on('broadcast', { event: 'user_watched_ep' }, (payload) => {
            const data = payload.payload;
            if (data && data.nick && data.animeTitle) {
                showActivityNotification(data.nick, data.epNumber, data.animeTitle);
            }
        })
        .subscribe();
}

function broadcastWatchEvent(nick, epNumber, animeTitle) {
    if (realtimeChannel) {
        realtimeChannel.send({
            type: 'broadcast',
            event: 'user_watched_ep',
            payload: { nick, epNumber, animeTitle }
        });
    }
}

function showActivityNotification(nick, epNumber, animeTitle) {
    const toast = document.getElementById('activity-toast');
    const textEl = document.getElementById('activity-text');

    textEl.innerHTML = `<strong class="text-pink-300 font-bold">${nick}</strong> właśnie obejrzał <span class="text-white font-semibold">Odc. ${epNumber}</span> z serii <strong class="text-pink-200">${animeTitle}</strong>!`;

    toast.classList.remove('toast-hidden');

    setTimeout(() => {
        toast.classList.add('toast-hidden');
    }, 6000);
}

/* BANER KONTYNUUJ OGLĄDANIE */
function checkContinueWatching() {
    const lastData = localStorage.getItem('af_last_watched');
    if (!lastData) return;

    try {
        const parsed = JSON.parse(lastData);
        if (parsed && parsed.animeId) {
            const cwBox = document.getElementById('continue-watching-box');
            document.getElementById('cw-title').innerText = parsed.animeTitle;
            document.getElementById('cw-ep').innerText = `Odcinek ${parsed.epNumber}`;
            
            document.getElementById('cw-btn').onclick = () => {
                openAnimeDetails(parsed.animeId, parsed.videoUrl);
            };

            cwBox.classList.remove('hidden');
        }
    } catch(e) {}
}

function saveLastWatched(animeId, animeTitle, epNumber, videoUrl) {
    const data = { animeId, animeTitle, epNumber, videoUrl };
    localStorage.setItem('af_last_watched', JSON.stringify(data));
    checkContinueWatching();
}

function runNetflixIntro() {
    const introScreen = document.getElementById('intro-screen');
    const introNick = document.getElementById('intro-nick');
    const introMotto = document.getElementById('intro-motto');
    const introAvatarImg = document.getElementById('intro-avatar-img');
    const introAvatarIcon = document.getElementById('intro-avatar-icon');

    introNick.innerText = currentUser.nickname || 'UŻYTKOWNIK';

    if (mottosList.length > 0) {
        const randomText = mottosList[Math.floor(Math.random() * mottosList.length)];
        introMotto.innerText = `"${randomText}"`;
    }

    if (currentUser.avatar) {
        introAvatarImg.src = currentUser.avatar;
        introAvatarImg.classList.remove('hidden');
        introAvatarIcon.classList.add('hidden');
    } else {
        introAvatarImg.classList.add('hidden');
        introAvatarIcon.classList.remove('hidden');
    }

    setTimeout(() => {
        introScreen.classList.add('fade-out');
    }, 3000);
}

async function checkUserRegistration() {
    if (!currentUser.nickname) {
        document.getElementById('nickname-modal').classList.remove('hidden');
    } else {
        await fetchUserData();
    }
}

async function submitNickname(e) {
    e.preventDefault();
    const nick = document.getElementById('user-nick-input').value.trim();
    const avatar = document.getElementById('user-avatar-input').value.trim();
    if (!nick) return;

    currentUser.nickname = nick;
    currentUser.avatar = avatar;
    localStorage.setItem('af_user_nick', nick);
    localStorage.setItem('af_user_avatar', avatar);
    
    try {
        let { data: existing } = await _supabase.from('users').select('*').eq('nickname', nick).single();
        if (!existing) {
            await _supabase.from('users').insert([{ nickname: nick, avatar_url: avatar, role: 'User' }]);
        } else {
            currentUser.role = existing.role || 'User';
            if (avatar) await _supabase.from('users').update({ avatar_url: avatar }).eq('nickname', nick);
        }
    } catch(err) {}

    document.getElementById('nickname-modal').classList.add('hidden');
    updateUserBadge();
    runNetflixIntro();
}

async function fetchUserData() {
    try {
        let { data: user } = await _supabase.from('users').select('*').eq('nickname', currentUser.nickname).single();
        if (user) {
            currentUser.role = user.role || 'User';
            if (user.avatar_url && !currentUser.avatar) {
                currentUser.avatar = user.avatar_url;
                localStorage.setItem('af_user_avatar', user.avatar_url);
            }
        }
    } catch(e) {}
    updateUserBadge();
}

function updateUserBadge() {
    document.getElementById('user-profile-badge').classList.remove('hidden');
    document.getElementById('nav-nick').innerText = currentUser.nickname;
    
    const avatarImg = document.getElementById('nav-avatar-img');
    const avatarIcon = document.getElementById('nav-avatar-icon');

    if (currentUser.avatar) {
        avatarImg.src = currentUser.avatar;
        avatarImg.classList.remove('hidden');
        avatarIcon.classList.add('hidden');
    } else {
        avatarImg.classList.add('hidden');
        avatarIcon.classList.remove('hidden');
    }

    const roleEl = document.getElementById('nav-role');
    roleEl.innerText = currentUser.role;

    if (currentUser.role === 'VIP') {
        roleEl.className = "text-[9px] text-amber-400 font-extrabold uppercase";
    } else if (currentUser.role === 'Admin') {
        roleEl.className = "text-[9px] text-rose-400 font-extrabold uppercase";
    } else {
        roleEl.className = "text-[9px] text-pink-300 font-extrabold uppercase";
    }
}

function toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');

    if (!modal.classList.contains('hidden')) {
        document.getElementById('settings-avatar-input').value = currentUser.avatar || '';
        if (playerSettings.theme === 'custom') {
            document.getElementById('custom-gui-box').classList.remove('hidden');
        }
    }
}

async function saveSettingsAvatar() {
    const url = document.getElementById('settings-avatar-input').value.trim();
    currentUser.avatar = url;
    localStorage.setItem('af_user_avatar', url);
    updateUserBadge();
    try {
        if (currentUser.nickname) await _supabase.from('users').update({ avatar_url: url }).eq('nickname', currentUser.nickname);
    } catch(err) {}
    toggleSettingsModal();
}

const themesList = ['sakura', 'obsidian', 'monochrome', 'ocean', 'cyberpunk'];
function cycleThemeQuick() {
    let currentIndex = themesList.indexOf(playerSettings.theme);
    let nextIndex = (currentIndex + 1) % themesList.length;
    selectTheme(themesList[nextIndex]);
}

function selectTheme(themeVal) {
    playerSettings.theme = themeVal;
    localStorage.setItem('af_theme', themeVal);
    const customBox = document.getElementById('custom-gui-box');
    if (themeVal === 'custom') customBox.classList.remove('hidden');
    else customBox.classList.add('hidden');
    applySavedTheme();
}

function saveCustomBg() {
    const url = document.getElementById('custom-bg-input').value.trim();
    const warning = document.getElementById('gif-warning');
    const isGif = url.toLowerCase().includes('.gif');
    const hasVipAccess = currentUser.role === 'VIP' || currentUser.role === 'Admin';

    if (isGif && !hasVipAccess) {
        warning.classList.remove('hidden');
        alert('Tylko VIP/Admin może ustawiać GIF jako tło!');
        return;
    }

    warning.classList.add('hidden');
    playerSettings.customBg = url;
    localStorage.setItem('af_custom_bg', url);
    applySavedTheme();
    alert('Własne tło zostało zastosowane!');
}

function applySavedTheme() {
    document.body.className = "min-h-screen flex flex-col relative overflow-x-hidden pb-12";
    if (playerSettings.theme === 'obsidian') document.body.classList.add('theme-obsidian');
    else if (playerSettings.theme === 'monochrome') document.body.classList.add('theme-monochrome');
    else if (playerSettings.theme === 'ocean') document.body.classList.add('theme-ocean');
    else if (playerSettings.theme === 'cyberpunk') document.body.classList.add('theme-cyberpunk');
    else if (playerSettings.theme === 'custom') {
        document.body.classList.add('theme-custom');
        if (playerSettings.customBg) document.documentElement.style.setProperty('--custom-bg-img', `url('${playerSettings.customBg}')`);
    }
}

function updateSetting(key, val) {
    playerSettings[key] = val;
    localStorage.setItem(`af_${key}`, val);
}

function createSakuraPetals() {
    const container = document.getElementById('sakura-box');
    for (let i = 0; i < 18; i++) {
        const petal = document.createElement('div');
        petal.classList.add('petal');
        petal.style.left = Math.random() * 100 + '%';
        petal.style.width = (Math.random() * 10 + 8) + 'px';
        petal.style.height = (Math.random() * 12 + 10) + 'px';
        petal.style.animationDuration = (Math.random() * 7 + 7) + 's';
        petal.style.animationDelay = (Math.random() * 8) + 's';
        container.appendChild(petal);
    }
}

function showSection(sectionId) {
    ['home', 'details', 'calendar', 'announcements'].forEach(sec => {
        const el = document.getElementById(`sec-${sec}`);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(`sec-${sectionId}`).classList.remove('hidden');
}

async function fetchAnime() {
    try {
        let { data: anime } = await _supabase.from('anime').select('*').order('created_at', { ascending: false });
        allAnimeData = anime || [];
        buildGenresFilter(allAnimeData);
        renderAnimeGrid(allAnimeData);
        fetchAnnouncements();
        fetchCalendar();
    } catch(e) {}
}

function buildGenresFilter(list) {
    const bar = document.getElementById('genres-filter-bar');
    let categoriesSet = new Set();
    list.forEach(item => {
        if (item.category) item.category.split(',').forEach(cat => categoriesSet.add(cat.trim()));
    });

    let html = `<button onclick="filterByCategory('all')" class="genre-btn ${activeCategory === 'all' ? 'bg-pink-600 text-white border-pink-400' : 'bg-pink-950/40 text-pink-300/80 border-pink-500/20'} font-bold px-3 py-1 rounded-full border transition-all">Wszystkie</button>`;
    categoriesSet.forEach(cat => {
        const isActive = activeCategory === cat;
        html += `<button onclick="filterByCategory('${cat}')" class="genre-btn ${isActive ? 'bg-pink-600 text-white border-pink-400' : 'bg-pink-950/40 text-pink-300/80 border-pink-500/20'} font-bold px-3 py-1 rounded-full border transition-all">${cat}</button>`;
    });
    bar.innerHTML = html;
}

function filterByCategory(cat) {
    activeCategory = cat;
    buildGenresFilter(allAnimeData);
    if (cat === 'all') renderAnimeGrid(allAnimeData);
    else renderAnimeGrid(allAnimeData.filter(i => i.category && i.category.toLowerCase().includes(cat.toLowerCase())));
}

function filterAnime() {
    const val = document.getElementById('search-input').value.toLowerCase().trim();
    if (!val) {
        renderAnimeGrid(allAnimeData);
        return;
    }
    const filtered = allAnimeData.filter(item => item.title.toLowerCase().includes(val));
    renderAnimeGrid(filtered);
}

function renderAnimeGrid(list) {
    const grid = document.getElementById('anime-grid');
    if (list.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-pink-300/40 text-xs">Brak dostępnych serii w tej kategorii.</div>`;
        return;
    }

    grid.innerHTML = list.map(item => `
        <div class="glass-panel glass-panel-hover rounded-2xl overflow-hidden cursor-pointer flex flex-col group" onclick="openAnimeDetails(${item.id})">
            <div class="relative aspect-[2/3] bg-purple-950/40 overflow-hidden">
                <img src="${item.image_url || 'https://via.placeholder.com/300x450'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                ${item.rating ? `<span class="absolute top-2 right-2 bg-purple-950/80 border border-pink-500/30 text-pink-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full"><i class="fa-solid fa-star text-amber-400"></i> ${item.rating}</span>` : ''}
            </div>
            <div class="p-3.5 flex-1 flex flex-col justify-between">
                <h3 class="font-bold text-xs line-clamp-1 text-pink-100 group-hover:text-pink-300">${item.title}</h3>
                <p class="text-[10px] text-pink-300/50 mt-1">${item.category || 'Anime'}</p>
            </div>
        </div>
    `).join('');
}

function openRandomAnime() {
    if (allAnimeData.length === 0) return;
    openAnimeDetails(allAnimeData[Math.floor(Math.random() * allAnimeData.length)].id);
}

async function fetchCalendar() {
    const cal = document.getElementById('calendar-list');
    let { data: items } = await _supabase.from('calendar').select('*').order('created_at', { ascending: false });
    
    let itemsHTML = '';
    if (items && items.length > 0) {
        itemsHTML += items.map(item => `
            <div class="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between">
                ${item.image_url ? `<div class="h-44 overflow-hidden relative"><img src="${item.image_url}" class="w-full h-full object-cover"></div>` : ''}
                <div class="p-5 space-y-3">
                    <div class="flex justify-between items-start gap-2">
                        <h4 class="font-bold text-pink-100 text-sm leading-snug">${item.title}</h4>
                        <span class="text-[10px] text-pink-300 font-bold bg-pink-950/80 px-2.5 py-1 rounded-full border border-pink-500/30 shrink-0">${item.day}</span>
                    </div>
                    ${item.time ? `<p class="text-xs text-pink-300/70 flex items-center gap-2 font-medium"><i class="fa-regular fa-clock text-pink-400"></i> ${item.time}</p>` : ''}
                </div>
            </div>
        `).join('');
    }
    cal.innerHTML = itemsHTML || '<p class="text-pink-300/40 text-xs col-span-full">Brak zapowiedzi.</p>';
}

async function fetchAnnouncements() {
    const container = document.getElementById('announcements-list');
    let { data: anns } = await _supabase.from('ogloszenia').select('*').order('created_at', { ascending: false });
    
    if (!anns || anns.length === 0) {
        container.innerHTML = `<div class="glass-panel p-6 rounded-2xl text-xs text-pink-300/50">Brak nowych ogłoszeń.</div>`;
        return;
    }

    container.innerHTML = anns.map(ann => `
        <div class="glass-panel rounded-2xl overflow-hidden border border-pink-500/20">
            ${ann.image_url ? `<img src="${ann.image_url}" class="w-full max-h-80 object-cover">` : ''}
            <div class="p-6 space-y-3">
                <div class="flex justify-between items-center border-b border-pink-500/20 pb-3">
                    <h3 class="font-bold text-base text-pink-100 flex items-center gap-2">
                        <i class="fa-solid fa-scroll text-pink-400"></i> ${ann.title}
                    </h3>
                    <span class="text-[10px] text-pink-300/50 font-medium">${new Date(ann.created_at).toLocaleDateString()}</span>
                </div>
                <p class="text-xs text-pink-200/80 leading-relaxed whitespace-pre-line">${ann.content}</p>
            </div>
        </div>
    `).join('');
}

async function openAnimeDetails(id, autoPlayUrl = null) {
    const item = allAnimeData.find(a => a.id === id);
    if (!item) return;

    let { data: eps } = await _supabase.from('episodes').select('*').eq('anime_id', id).order('episode_number', { ascending: true });
    eps = eps || [];

    document.getElementById('details-content').innerHTML = `
        <div class="flex flex-col sm:flex-row gap-6 mb-8 items-center sm:items-start">
            <img src="${item.image_url}" class="w-44 rounded-2xl object-cover shadow-xl border border-pink-500/30">
            <div class="space-y-3 text-center sm:text-left flex-1">
                <h1 class="text-2xl font-black text-white">${item.title}</h1>
                <p class="text-xs text-pink-300/80">Status: ${item.status} | Gatunek: ${item.category}</p>
            </div>
        </div>
        <div id="video-container" class="aspect-video bg-black/80 rounded-2xl border border-pink-500/20 mb-6 flex items-center justify-center">
            <p class="text-pink-300/40 text-xs">Wybierz odcinek.</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            ${eps.map(e => `<button onclick="playEp('${e.video_url}',${e.episode_number}, '${item.title.replace(/'/g, "\\'")}', ${item.id})" class="bg-pink-950/40 hover:bg-pink-600 border border-pink-500/20 p-3 rounded-xl text-xs font-semibold text-white">Odc. ${e.episode_number}</button>`).join('')}
        </div>
    `;
    showSection('details');

    if (autoPlayUrl) {
        const matchedEp = eps.find(e => e.video_url === autoPlayUrl);
        const epNum = matchedEp ? matchedEp.episode_number : 1;
        playEp(autoPlayUrl, epNum, item.title, item.id);
    }
}

function playEp(url, epNum, title, animeId) {
    document.getElementById('video-container').innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
    
    saveLastWatched(animeId, title, epNum, url);

    if (currentUser.nickname) {
        broadcastWatchEvent(currentUser.nickname, epNum, title);
    }
}
