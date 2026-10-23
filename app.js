let _supabase;
let allAnimeData = [];
let currentAnimeEpisodes = [];
let currentEpisodeIndex = 0;

let currentUser = {
    nickname: localStorage.getItem('af_user_nick') || '',
    role: 'User'
};

let siteTheme = localStorage.getItem('af_theme') || 'light';
let isAutoplay = localStorage.getItem('af_autoplay') === 'true';
let gridDensity = localStorage.getItem('af_grid_density') || 'compact';

window.onload = async () => {
    // Inicjalizacja Supabase po wczytaniu config.js
    if (typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined') {
        const { createClient } = supabase;
        _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Brak konfiguracji Supabase lub biblioteki Supabase JS.");
    }

    applyTheme(siteTheme);
    applyGridDensity(gridDensity);
    initSettingsUI();
    setupEventListeners();
    await checkUserRegistration();
    fetchAnime();
};

function setupEventListeners() {
    // Nawigacja
    document.getElementById('logo-home-btn').addEventListener('click', () => showSection('home'));
    document.getElementById('nav-home-btn').addEventListener('click', () => showSection('home'));
    document.getElementById('nav-calendar-btn').addEventListener('click', () => showSection('calendar'));
    document.getElementById('nav-announcements-btn').addEventListener('click', () => showSection('announcements'));
    document.getElementById('nav-settings-btn').addEventListener('click', toggleSettingsModal);
    document.getElementById('close-settings-btn').addEventListener('click', toggleSettingsModal);
    document.getElementById('back-to-home-btn').addEventListener('click', () => showSection('home'));

    // Wyszukiwarka
    document.getElementById('search-input').addEventListener('input', filterAnime);

    // Formularze i Modale
    document.getElementById('nickname-form').addEventListener('submit', submitNickname);
    document.getElementById('autoplay-toggle').addEventListener('change', (e) => toggleAutoplay(e.target.checked));
    document.getElementById('reset-user-data-btn').addEventListener('click', resetUserData);

    // Przełączniki motywu
    document.querySelectorAll('input[name="site_theme"]').forEach(radio => {
        radio.addEventListener('change', (e) => setTheme(e.target.value));
    });

    // Przełączniki gęstości kafelków
    document.querySelectorAll('input[name="grid_density"]').forEach(radio => {
        radio.addEventListener('change', (e) => setGridDensity(e.target.value));
    });
}

function initSettingsUI() {
    document.getElementById('autoplay-toggle').checked = isAutoplay;
    const gridRadio = document.querySelector(`input[name="grid_density"][value="${gridDensity}"]`);
    if (gridRadio) gridRadio.checked = true;
}

function setTheme(theme) {
    siteTheme = theme;
    localStorage.setItem('af_theme', theme);
    applyTheme(theme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('theme-dark');
    } else {
        document.body.classList.remove('theme-dark');
    }
    const radio = document.querySelector(`input[name="site_theme"][value="${theme}"]`);
    if (radio) radio.checked = true;
}

function toggleAutoplay(val) {
    isAutoplay = val;
    localStorage.setItem('af_autoplay', val);
}

function setGridDensity(density) {
    gridDensity = density;
    localStorage.setItem('af_grid_density', density);
    applyGridDensity(density);
}

function applyGridDensity(density) {
    const grid = document.getElementById('anime-grid');
    if (density === 'large') {
        grid.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6";
    } else {
        grid.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4";
    }
}

function resetUserData() {
    if (confirm("Czy na pewno chcesz wyczyścić zapamiętane dane (nick, motyw, ustawienia)?")) {
        localStorage.clear();
        location.reload();
    }
}

async function checkUserRegistration() {
    if (!currentUser.nickname) {
        document.getElementById('nickname-modal').classList.remove('hidden');
    } else {
        updateUserBadge();
    }
}

async function submitNickname(e) {
    e.preventDefault();
    const nick = document.getElementById('user-nick-input').value.trim();
    if (!nick) return;

    currentUser.nickname = nick;
    localStorage.setItem('af_user_nick', nick);

    document.getElementById('nickname-modal').classList.add('hidden');
    updateUserBadge();
}

function updateUserBadge() {
    document.getElementById('user-profile-badge').classList.remove('hidden');
    document.getElementById('nav-nick').innerText = currentUser.nickname;
}

function toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');
}

function showSection(sectionId) {
    ['home', 'details', 'calendar', 'announcements'].forEach(sec => {
        const el = document.getElementById(`sec-${sec}`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`sec-${sectionId}`);
    if (target) target.classList.remove('hidden');
}

async function fetchAnime() {
    const statusDiv = document.getElementById('db-status');
    try {
        if (!_supabase) throw new Error("Supabase klient nie został zainicjalizowany.");

        let { data: anime, error } = await _supabase.from('anime').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        allAnimeData = anime || [];
        renderAnimeGrid(allAnimeData);
        fetchAnnouncements();
        fetchCalendar();
        
        statusDiv.innerHTML = `<i class="fa-solid fa-check text-green-600"></i> Połączono`;
    } catch (err) {
        console.error("Błąd połączenia:", err);
        statusDiv.innerHTML = `<i class="fa-solid fa-xmark text-red-500"></i> Błąd połączenia`;
    }
}

function renderAnimeGrid(list) {
    const grid = document.getElementById('anime-grid');
    if (list.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-400 text-xs">Brak dostępnych wyników.</div>`;
        return;
    }

    grid.innerHTML = list.map(item => `
        <div class="google-card overflow-hidden cursor-pointer flex flex-col group p-2" onclick="openAnimeDetails(${item.id})">
            <div class="relative aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded overflow-hidden mb-2">
                <img src="${item.image_url || 'https://via.placeholder.com/300x450'}" alt="${item.title}" class="w-full h-full object-cover">
            </div>
            <div class="flex flex-col justify-between flex-1">
                <h3 class="font-bold text-xs line-clamp-1">${item.title}</h3>
                <div class="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                    <span>${item.category || 'Anime'}</span>
                    ${item.rating ? `<span class="font-bold"><i class="fa-solid fa-star text-yellow-500"></i> ${item.rating}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

async function fetchCalendar() {
    const cal = document.getElementById('calendar-list');
    if (!_supabase) return;
    let { data: calendarItems } = await _supabase.from('calendar').select('*').order('created_at', { ascending: false });

    if (!calendarItems || calendarItems.length === 0) {
        cal.innerHTML = `<p class="text-gray-400 text-xs col-span-full">Brak zapowiedzi.</p>`;
        return;
    }

    cal.innerHTML = calendarItems.map(item => `
        <div class="google-card p-4 space-y-2">
            <div class="flex justify-between items-start">
                <h4 class="font-bold text-xs">${item.title}</h4>
                <span class="text-[10px] text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">${item.day}</span>
            </div>
            ${item.time ? `<p class="text-xs text-gray-500"><i class="fa-regular fa-clock mr-1"></i> ${item.time}</p>` : ''}
        </div>
    `).join('');
}

async function fetchAnnouncements() {
    const container = document.getElementById('announcements-list');
    if (!_supabase) return;
    let { data: announcements } = await _supabase.from('ogloszenia').select('*').order('created_at', { ascending: false });
    
    if (!announcements || announcements.length === 0) {
        container.innerHTML = `<div class="google-card p-4 text-xs text-gray-400">Brak nowych wiadomości.</div>`;
        return;
    }

    container.innerHTML = announcements.map(ann => `
        <div class="google-card p-4 space-y-2">
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                <h3 class="font-bold text-sm">${ann.title}</h3>
                <span class="text-[10px] text-gray-400">${new Date(ann.created_at).toLocaleDateString()}</span>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">${ann.content}</p>
        </div>
    `).join('');
}

async function openAnimeDetails(id) {
    const item = allAnimeData.find(a => a.id === id);
    if (!item) return;

    let { data: episodes } = await _supabase.from('episodes').select('*').eq('anime_id', id).order('episode_number', { ascending: true });
    currentAnimeEpisodes = episodes || [];
    currentEpisodeIndex = 0;

    const content = document.getElementById('details-content');
    content.innerHTML = `
        <div class="flex flex-col sm:flex-row gap-4 mb-6">
            <img src="${item.image_url || 'https://via.placeholder.com/300x450'}" class="w-32 h-48 rounded object-cover border border-gray-200 dark:border-gray-700 shrink-0">
            <div class="space-y-2">
                <h1 class="text-xl font-bold">${item.title}</h1>
                <div class="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Status: <strong>${item.status || 'Nieokreślony'}</strong></span>
                    <span class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Kategoria: <strong>${item.category || 'Brak'}</strong></span>
                    <span class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Ocena: <strong><i class="fa-solid fa-star text-yellow-500"></i> ${item.rating || '-'}</strong></span>
                </div>
            </div>
        </div>

        <div class="space-y-4">
            <div id="video-container" class="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <p class="text-gray-400 text-xs">Wybierz odcinek, aby odtworzyć.</p>
            </div>

            <!-- Przyciski Następny / Poprzedni -->
            <div class="flex items-center justify-between gap-2">
                <button onclick="changeEpisode(-1)" id="prev-ep-btn" class="px-4 py-2 rounded text-xs font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5">
                    <i class="fa-solid fa-arrow-left"></i> Poprzedni odcinek
                </button>
                <span id="current-ep-label" class="text-xs font-bold">Odcinek -</span>
                <button onclick="changeEpisode(1)" id="next-ep-btn" class="px-4 py-2 rounded text-xs font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5">
                    Następny odcinek <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>

            <!-- Przycisk pokaż wszystkie odcinki -->
            <div class="pt-2 text-center">
                <button onclick="toggleAllEpisodesList()" class="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded text-xs font-bold transition-colors">
                    <i class="fa-solid fa-list mr-1"></i> Pokaż wszystkie odcinki
                </button>
            </div>

            <!-- Ukryta/Widoczna lista wszystkich odcinków -->
            <div id="all-episodes-section" class="hidden pt-2 border-t border-gray-200 dark:border-gray-800">
                <h4 class="font-bold text-xs mb-2">Wszystkie Odcinki:</h4>
                <div id="all-episodes-grid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1"></div>
            </div>

            <!-- Informacja DMCA / Discord -->
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-lg space-y-1.5">
                <p class="flex items-start gap-2">
                    <i class="fa-solid fa-circle-info text-blue-500 mt-0.5 shrink-0"></i>
                    <span>Odcinki są pobierane ze źródeł nieoficjalnych oraz zewnętrznych platform hostingowych.</span>
                </p>
                <p class="flex items-start gap-2">
                    <i class="fa-brands fa-discord text-indigo-500 mt-0.5 shrink-0"></i>
                    <span>Jeśli nie życzysz sobie, aby odcinek z Twoim tłumaczeniem był udostępniany na naszej platformie, prosimy o skontaktowanie się z nami poprzez <a href="https://discord.gg/UTDFC34jX" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Discorda</a>.</span>
                </p>
            </div>
        </div>
    `;

    showSection('details');
    renderAllEpisodesList();

    if (currentAnimeEpisodes.length > 0) {
        playEpisodeByIndex(0);
    }
}

function playEpisodeByIndex(index) {
    if (index < 0 || index >= currentAnimeEpisodes.length) return;
    currentEpisodeIndex = index;
    const ep = currentAnimeEpisodes[index];

    document.getElementById('current-ep-label').innerText = `Odcinek ${ep.episode_number}${ep.title ? ' - ' + ep.title : ''}`;

    const container = document.getElementById('video-container');
    let rawUrl = ep.video_url || '';
    
    if (rawUrl.includes('http://') || rawUrl.includes('https://')) {
        const parts = rawUrl.split(/:(.+)/);
        if (parts.length >= 2 && !parts[0].startsWith('http')) {
            rawUrl = parts[1].trim();
        } else {
            rawUrl = rawUrl.split(',')[0].trim();
        }
    }

    if (rawUrl.endsWith('.mp4') || rawUrl.includes('.mp4?')) {
        container.innerHTML = `<video id="active-video-player" controls autoplay class="w-full h-full"><source src="${rawUrl}" type="video/mp4">Przeglądarka nie obsługuje wideo.</video>`;
        
        if (isAutoplay) {
            const videoEl = document.getElementById('active-video-player');
            if (videoEl) {
                videoEl.onended = () => {
                    if (currentEpisodeIndex < currentAnimeEpisodes.length - 1) {
                        changeEpisode(1);
                    }
                };
            }
        }
    } else {
        let embedUrl = rawUrl;
        if (embedUrl.includes('dood') && embedUrl.includes('/v/')) {
            embedUrl = embedUrl.replace('/v/', '/e/');
        }

        container.innerHTML = `<iframe src="${embedUrl}" class="w-full h-full border-0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    }

    document.getElementById('prev-ep-btn').disabled = (currentEpisodeIndex === 0);
    document.getElementById('prev-ep-btn').style.opacity = (currentEpisodeIndex === 0) ? '0.5' : '1';

    document.getElementById('next-ep-btn').disabled = (currentEpisodeIndex === currentAnimeEpisodes.length - 1);
    document.getElementById('next-ep-btn').style.opacity = (currentEpisodeIndex === currentAnimeEpisodes.length - 1) ? '0.5' : '1';
}

function changeEpisode(direction) {
    const newIndex = currentEpisodeIndex + direction;
    if (newIndex >= 0 && newIndex < currentAnimeEpisodes.length) {
        playEpisodeByIndex(newIndex);
    }
}

function toggleAllEpisodesList() {
    const section = document.getElementById('all-episodes-section');
    section.classList.toggle('hidden');
}

function renderAllEpisodesList() {
    const grid = document.getElementById('all-episodes-grid');
    if (currentAnimeEpisodes.length === 0) {
        grid.innerHTML = '<p class="text-gray-400 text-xs col-span-full">Brak odcinków.</p>';
        return;
    }

    grid.innerHTML = currentAnimeEpisodes.map((ep, idx) => `
        <button onclick="playEpisodeByIndex(${idx}); toggleAllEpisodesList();" class="border border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white p-2 rounded text-xs text-center transition-colors">
            <span class="font-bold">Odc. ${ep.episode_number}</span>
            ${ep.lang ? `<span class="text-[9px] text-gray-400 block">[${ep.lang}]</span>` : ''}
        </button>
    `).join('');
}

function filterAnime() {
    showSection('home');
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allAnimeData.filter(item => item.title && item.title.toLowerCase().includes(query));
    renderAnimeGrid(filtered);
}
