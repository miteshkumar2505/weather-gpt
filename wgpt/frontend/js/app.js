/**
 * WeatherGPT — Main Application Logic
 * Handles weather data fetching, rendering, search, and geolocation.
 */

const API_BASE = window.location.origin;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── State ──────────────────────────────────────────────────────
window.currentCity = '';
window.currentLat = null;
window.currentLon = null;
window.currentLang = localStorage.getItem('weathergpt_lang') || 'en';
window.lastWeatherData = null;
let searchTimeout = null;
let weatherMap = null;
let mapMarker = null;
let visibilityChart = null;
let conditionPieChart = null;
let atmosphericPieChart = null;

// ── i18n Translations ──────────────────────────────────────────
const TRANSLATIONS = {
    en: {
        searchPlaceholder: "Search any city... (e.g., Mumbai, London, Tokyo)",
        useMyLocation: "📍 Use My Location",
        welcomeTitle: "Welcome to WeatherGPT",
        welcomeSubtitle: "Your AI-powered weather intelligence platform. Get real-time forecasts, alerts, and climate insights through natural conversation.",
        weatherDetails: "Weather Details",
        hourlyForecast: "Hourly Forecast",
        next36Hours: "Next 36 hours",
        visibilityGraphTitle: "👁️ Visibility Trend Graph",
        visibilityGraphSubtitle: "Hourly sight distance & atmospheric transparency",
        currentSight: "Current",
        minSight: "Min Sight",
        maxSight: "Max Sight",
        avgClarity: "Avg Clarity",
        weatherBreakdownTitle: "📊 Weather Breakdown & Atmospheric Distribution",
        weatherBreakdownSubtitle: "Forecast condition composition & real-time sky composition",
        forecastConditionTitle: "🌤️ Forecast Conditions Breakdown",
        atmosphericCompositionTitle: "💧 Atmospheric & Cloud Composition",
        fiveDayForecast: "5-Day Forecast",
        dailyOverview: "Daily overview",
        interactiveMapTitle: "🗺️ Interactive Weather Map",
        interactiveMapSubtitle: "Click anywhere on the map to pick a location & get real-time alerts",
        clickMapHint: "👇 Click map to select location",
        weatherAlertsTitle: "⚠️ Weather Alerts",
        colorCodedSeverity: "Color-coded severity",
        noAlertsText: "No extreme weather alerts active for this location",
        humidity: "💧 Humidity",
        wind: "💨 Wind",
        pressure: "🌡️ Pressure",
        visibility: "👁️ Visibility",
        clouds: "☁️ Clouds",
        feelsLike: "🌡️ Feels Like",
        sunrise: "Sunrise",
        sunset: "Sunset",
        chatTitle: "WeatherGPT AI",
        chatStatus: "Online · Multilingual & Voice Enabled",
        chatPlaceholder: "Ask about weather or click 🎤 to speak...",
        quickCurrent: "🌡️ Current Weather",
        quickVisibility: "👁️ Visibility",
        quickForecast: "📅 Forecast",
        quickAlerts: "⚠️ Alerts",
        quickRain: "🌧️ Rain?",
        advisoryGeneral: "General",
        advisoryAgriculture: "Agriculture",
        advisoryAviation: "Aviation",
        advisoryMarine: "Marine",
    },
    hi: {
        searchPlaceholder: "कोई भी शहर खोजें... (जैसे मुंबई, दिल्ली, जयपुर)",
        useMyLocation: "📍 मेरे स्थान का उपयोग करें",
        welcomeTitle: "वेदरजीपीटी (WeatherGPT) में आपका स्वागत है",
        welcomeSubtitle: "आपका एआई-संचालित मौसम मंच। प्राकृतिक बातचीत के माध्यम से सटीक पूर्वानुमान, अलर्ट और अंतर्दृष्टि प्राप्त करें।",
        weatherDetails: "मौसम विवरण",
        hourlyForecast: "प्रति घंटा पूर्वानुमान",
        next36Hours: "अगले 36 घंटे",
        visibilityGraphTitle: "👁️ दृश्यता प्रवृत्ति ग्राफ (Visibility Graph)",
        visibilityGraphSubtitle: "प्रति घंटा दृश्यता दूरी और वायुमंडलीय पारदर्शिता",
        currentSight: "वर्तमान",
        minSight: "न्यूनतम दृश्यता",
        maxSight: "अधिकतम दृश्यता",
        avgClarity: "औसत स्पष्टता",
        weatherBreakdownTitle: "📊 मौसम विभाजन और वायुमंडलीय वितरण",
        weatherBreakdownSubtitle: "पूर्वानुमान स्थिति संरचना और वास्तविक समय आकाश संरचना",
        forecastConditionTitle: "🌤️ पूर्वानुमान स्थिति विभाजन",
        atmosphericCompositionTitle: "💧 वायुमंडलीय और बादल संरचना",
        fiveDayForecast: "5-दिवसीय पूर्वानुमान",
        dailyOverview: "दैनिक अवलोकन",
        interactiveMapTitle: "🗺️ इंटरेक्टिव मौसम मानचित्र",
        interactiveMapSubtitle: "स्थान चुनने और अलर्ट देखने के लिए मानचित्र पर कहीं भी क्लिक करें",
        clickMapHint: "👇 स्थान चुनने के लिए क्लिक करें",
        weatherAlertsTitle: "⚠️ मौसम चेतावनी एवं अलर्ट",
        colorCodedSeverity: "रंग-कोडित गंभीरता",
        noAlertsText: "इस स्थान के लिए कोई गंभीर मौसम अलर्ट सक्रिय नहीं है",
        humidity: "💧 आर्द्रता",
        wind: "💨 हवा",
        pressure: "🌡️ दबाव",
        visibility: "👁️ दृश्यता",
        clouds: "☁️ बादल",
        feelsLike: "🌡️ महसूस तापमान",
        sunrise: "सूर्योदय",
        sunset: "सूर्यास्त",
        chatTitle: "वेदरजीपीटी एआई",
        chatStatus: "ऑनलाइन · बहुभाषी और आवाज सक्षम",
        chatPlaceholder: "मौसम के बारे में पूछें या बोलने के लिए 🎤 क्लिक करें...",
        quickCurrent: "🌡️ वर्तमान मौसम",
        quickVisibility: "👁️ दृश्यता",
        quickForecast: "📅 पूर्वानुमान",
        quickAlerts: "⚠️ अलर्ट",
        quickRain: "🌧️ क्या बारिश होगी?",
        advisoryGeneral: "सामान्य",
        advisoryAgriculture: "कृषि",
        advisoryAviation: "विमानन",
        advisoryMarine: "समुद्री",
    },
    gu: {
        searchPlaceholder: "કોઈપણ શહેર શોધો... (દા.ત., અમદાવાદ, સુરત, મુંબઈ)",
        useMyLocation: "📍 મારું સ્થાન વાપરો",
        welcomeTitle: "વેધરજીપીટી (WeatherGPT) માં આપનું સ્વાગત છે",
        welcomeSubtitle: "તમારું AI-સંચાલિત હવામાન ઇન્ટેલિજન્સ પ્લેટફોર્મ. વાર્તાલાપ દ્વારા રીઅલ-ટાઇમ અંદાજ, અલર્ટ્સ અને માહિતી મેળવો.",
        weatherDetails: "હવામાન વિગતો",
        hourlyForecast: "કલાકદીઠ હવામાન અંદાજ",
        next36Hours: "આગામી 36 કલાક",
        visibilityGraphTitle: "👁️ દૃશ્યતા વલણ ગ્રાફ (Visibility Graph)",
        visibilityGraphSubtitle: "કલાકદીઠ દૃશ્યતા અંતર અને વાતાવરણીય સ્પષ્ટતા",
        currentSight: "વર્તમાન",
        minSight: "ન્યૂનતમ દૃશ્યતા",
        maxSight: "મહત્તમ દૃશ્યતા",
        avgClarity: "સરેરાશ સ્પષ્ટતા",
        weatherBreakdownTitle: "📊 હવામાન વિભાજન અને વાતાવરણીય વિતરણ",
        weatherBreakdownSubtitle: "હવામાન સ્થિતિ રચના અને રીઅલ-ટાઇમ આકાશ વિતરણ",
        forecastConditionTitle: "🌤️ હવામાન સ્થિતિ વિભાજન",
        atmosphericCompositionTitle: "💧 વાતાવરણીય અને વાદળ રચના",
        fiveDayForecast: "5-દિવસનો હવામાન અંદાજ",
        dailyOverview: "દૈનિક ઝાંખી",
        interactiveMapTitle: "🗺️ ઇન્ટરેક્ટિવ હવામાન નકશો",
        interactiveMapSubtitle: "સ્થળ પસંદ કરવા અને અલર્ટ જોવા માટે નકશા પર ગમે ત્યાં ક્લિક કરો",
        clickMapHint: "👇 સ્થળ પસંદ કરવા નકશા પર ક્લિક કરો",
        weatherAlertsTitle: "⚠️ હવામાન અલર્ટ્સ અને ચેતવણી",
        colorCodedSeverity: "રંગ-કોડેડ ગંભીરતા",
        noAlertsText: "આ સ્થળ માટે કોઈ ગંભીર હવામાન અલર્ટ સક્રિય નથી",
        humidity: "💧 ભેજ",
        wind: "💨 પવન",
        pressure: "🌡️ દબાણ",
        visibility: "👁️ દૃશ્યતા",
        clouds: "☁️ વાદળો",
        feelsLike: "🌡️ અનુભવાતું તાપમાન",
        sunrise: "સૂર્યોદય",
        sunset: "સૂર્યાસ્ત",
        chatTitle: "વેધરજીપીટી AI",
        chatStatus: "ઓનલાઇન · બહુભાષી અને અવાજ સક્ષમ",
        chatPlaceholder: "હવામાન વિશે પૂછો અથવા બોલવા માટે 🎤 ક્લિક કરો...",
        quickCurrent: "🌡️ વર્તમાન હવામાન",
        quickVisibility: "👁️ દૃશ્યતા",
        quickForecast: "📅 હવામાન અંદાજ",
        quickAlerts: "⚠️ અલર્ટ્સ",
        quickRain: "🌧️ શું વરસાદ પડશે?",
        advisoryGeneral: "સામાન્ય",
        advisoryAgriculture: "કૃષિ",
        advisoryAviation: "ઉડ્ડયન",
        advisoryMarine: "દરિયાઈ",
    }
};

function t(key) {
    const langDict = TRANSLATIONS[window.currentLang] || TRANSLATIONS.en;
    return langDict[key] || TRANSLATIONS.en[key] || key;
}

function applyLanguage(lang) {
    window.currentLang = lang;
    localStorage.setItem('weathergpt_lang', lang);

    const langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.value = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && t(key)) {
            el.textContent = t(key);
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && t(key)) {
            el.placeholder = t(key);
        }
    });

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.placeholder = t('chatPlaceholder');
    }

    if (typeof window.updateChatLanguageUI === 'function') {
        window.updateChatLanguageUI(lang);
    }
}

function setupLanguageSwitcher() {
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = window.currentLang;
        langSelect.addEventListener('change', (e) => {
            applyLanguage(e.target.value);
            if (window.lastWeatherData) {
                renderMetrics(window.lastWeatherData);
            }
        });
    }
    applyLanguage(window.currentLang);
}

// ── DOM Elements ───────────────────────────────────────────────
const searchBar = document.getElementById('search-bar');
const searchResults = document.getElementById('search-results');
const geoBtn = document.getElementById('geo-btn');
const bgGradient = document.getElementById('bg-gradient');
const loadingOverlay = document.getElementById('loading-overlay');
const welcomeScreen = document.getElementById('welcome-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

// ── Initialize ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    hideLoading();
    setupSearch();
    setupGeolocation();
    setupVoiceSearch();
    setupLanguageSwitcher();
});

// ── Loading ────────────────────────────────────────────────────
function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// ── Search ─────────────────────────────────────────────────────
function setupSearch() {
    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (searchTimeout) clearTimeout(searchTimeout);

        if (query.length < 2) {
            searchResults.classList.remove('active');
            return;
        }

        searchTimeout = setTimeout(() => searchCities(query), 300);
    });

    searchBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchBar.value.trim();
            if (query.length >= 2) {
                searchResults.classList.remove('active');
                loadWeatherByCity(query);
            }
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.remove('active');
        }
    });
}

async function searchCities(query) {
    try {
        const resp = await fetch(`${API_BASE}/api/weather/search?q=${encodeURIComponent(query)}&limit=5`);
        if (!resp.ok) return;
        const data = await resp.json();

        if (data.results.length === 0) {
            searchResults.classList.remove('active');
            return;
        }

        searchResults.innerHTML = data.results.map(city => `
            <div class="search-result-item" 
                 onclick="selectCity('${city.name}', ${city.lat}, ${city.lon}, '${city.country}', '${city.state || ''}')">
                <span>📍</span>
                <div>
                    <div class="city-name">${city.name}</div>
                    <div class="city-meta">${city.state ? city.state + ', ' : ''}${city.country}</div>
                </div>
            </div>
        `).join('');

        searchResults.classList.add('active');
    } catch (err) {
        console.error('City search failed:', err);
    }
}

function selectCity(name, lat, lon, country, state) {
    searchBar.value = `${name}${state ? ', ' + state : ''}, ${country}`;
    searchResults.classList.remove('active');
    loadWeather(lat, lon);
}

// ── Geolocation ────────────────────────────────────────────────
function setupGeolocation() {
    geoBtn.addEventListener('click', requestGeolocation);
}

function requestGeolocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    geoBtn.classList.add('loading');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            geoBtn.classList.remove('loading');
            loadWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            geoBtn.classList.remove('loading');
            console.error('Geolocation error:', error);
            alert('Could not get your location. Please search for a city instead.');
        },
        { timeout: 10000 }
    );
}

// ── Load Weather Data ──────────────────────────────────────────
async function loadWeatherByCity(city) {
    showLoading();
    try {
        const [weatherResp, forecastResp] = await Promise.all([
            fetch(`${API_BASE}/api/weather/current?city=${encodeURIComponent(city)}`),
            fetch(`${API_BASE}/api/weather/forecast?city=${encodeURIComponent(city)}`),
        ]);

        if (!weatherResp.ok) throw new Error('Weather fetch failed');
        if (!forecastResp.ok) throw new Error('Forecast fetch failed');

        const weather = await weatherResp.json();
        const forecast = await forecastResp.json();

        window.currentCity = weather.city;
        window.currentLat = weather.lat;
        window.currentLon = weather.lon;

        renderDashboard(weather, forecast);
        loadAlerts(weather.lat, weather.lon);
    } catch (err) {
        console.error('Failed to load weather:', err);
        alert('Failed to load weather data. Please check your API key and try again.');
    } finally {
        hideLoading();
    }
}

async function loadWeather(lat, lon) {
    showLoading();
    try {
        const [weatherResp, forecastResp] = await Promise.all([
            fetch(`${API_BASE}/api/weather/current?lat=${lat}&lon=${lon}`),
            fetch(`${API_BASE}/api/weather/forecast?lat=${lat}&lon=${lon}`),
        ]);

        if (!weatherResp.ok) throw new Error('Weather fetch failed');
        if (!forecastResp.ok) throw new Error('Forecast fetch failed');

        const weather = await weatherResp.json();
        const forecast = await forecastResp.json();

        window.currentCity = weather.city;
        window.currentLat = weather.lat;
        window.currentLon = weather.lon;
        searchBar.value = `${weather.city}, ${weather.country}`;

        renderDashboard(weather, forecast);
        loadAlerts(lat, lon);
    } catch (err) {
        console.error('Failed to load weather:', err);
        alert('Failed to load weather data. Please check your API key and try again.');
    } finally {
        hideLoading();
    }
}

async function loadAlerts(lat, lon) {
    try {
        const resp = await fetch(
            `${API_BASE}/api/alerts?lat=${lat}&lon=${lon}`
        );

        if (!resp.ok) {
            console.warn("Weather alerts are currently unavailable.");
            renderAlerts([]);
            return;
        }

        const data = await resp.json();

        if (data.alerts && data.alerts.length > 0) {
            renderAlerts(data.alerts);
        } else {
            renderAlerts([]);
        }
    } catch (err) {
        console.error("Failed to load alerts:", err);
        renderAlerts([]);
    }
}

function renderDashboard(weather, forecast) {
    welcomeScreen.style.display = 'none';
    dashboardScreen.style.display = 'grid';

    updateBackground(weather);
    renderHeroCard(weather);
    renderMetrics(weather);
    renderHourlyForecast(forecast);
    renderVisibilityGraph(weather, forecast);
    renderWeatherPieCharts(weather, forecast);
    renderDailyForecast(forecast);
    renderMap(weather.lat, weather.lon, weather.city);
}

function updateBackground(weather) {
    const mainCondition = weather.conditions[0]?.main?.toLowerCase() || 'clear';
    const now = Math.floor(Date.now() / 1000);
    const isNight = now < weather.sunrise || now > weather.sunset;

    bgGradient.className = 'bg-gradient';

    if (mainCondition.includes('thunder') || mainCondition.includes('storm')) {
        bgGradient.classList.add('stormy');
    } else if (mainCondition.includes('rain') || mainCondition.includes('drizzle')) {
        bgGradient.classList.add('rainy');
    } else if (mainCondition.includes('snow')) {
        bgGradient.classList.add('snowy');
    } else if (mainCondition.includes('cloud') || mainCondition.includes('mist') || mainCondition.includes('fog')) {
        bgGradient.classList.add('cloudy');
    } else if (isNight) {
        bgGradient.classList.add('clear-night');
    } else {
        bgGradient.classList.add('clear-day');
    }
}

function renderHeroCard(weather) {
    const localTime = new Date((weather.dt + weather.timezone) * 1000);
    const dayName = DAYS[localTime.getUTCDay()];
    const month = MONTHS[localTime.getUTCMonth()];
    const date = localTime.getUTCDate();
    const hours = localTime.getUTCHours();
    const minutes = localTime.getUTCMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;

    const sunriseTime = formatUnixTime(weather.sunrise, weather.timezone);
    const sunsetTime = formatUnixTime(weather.sunset, weather.timezone);

    document.getElementById('hero-card').innerHTML = `
        <div class="hero-location">
            <span>📍</span>
            <span class="hero-city">${weather.city}</span>
            <span class="hero-country">${weather.country}</span>
        </div>
        <div class="hero-datetime">${dayName}, ${month} ${date} · ${displayHour}:${minutes} ${ampm}</div>
        <div class="hero-temp-row">
            <div>
                <div style="display:flex;align-items:flex-start;">
                    <span class="hero-temp">${Math.round(weather.temperature)}</span>
                    <span class="hero-temp-unit">°C</span>
                </div>
                <div class="hero-condition">${weather.conditions[0]?.description || 'N/A'}</div>
                <div class="hero-feels">Feels like ${Math.round(weather.feels_like)}°C · H:${Math.round(weather.temp_max)}° L:${Math.round(weather.temp_min)}°</div>
            </div>
            <img class="hero-icon" src="${weather.icon_url}" alt="${weather.conditions[0]?.description || 'weather'}">
        </div>
        <div class="hero-sun-row">
            <div class="sun-item">
                <span class="icon">🌅</span>
                <span>Sunrise ${sunriseTime}</span>
            </div>
            <div class="sun-item">
                <span class="icon">🌇</span>
                <span>Sunset ${sunsetTime}</span>
            </div>
        </div>
    `;
}

function renderMetrics(weather) {
    window.lastWeatherData = weather;
    const windDir = getWindDirection(weather.wind_deg);

    document.getElementById('metrics-grid').innerHTML = `
        <div class="metric-item">
            <div class="metric-label">${t('humidity')}</div>
            <div class="metric-value">${weather.humidity}<span class="metric-unit">%</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">${t('wind')}</div>
            <div class="metric-value">${weather.wind_speed}<span class="metric-unit"> m/s ${windDir}</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">${t('pressure')}</div>
            <div class="metric-value">${weather.pressure}<span class="metric-unit"> hPa</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">${t('visibility')}</div>
            <div class="metric-value">${(weather.visibility / 1000).toFixed(1)}<span class="metric-unit"> km</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">${t('clouds')}</div>
            <div class="metric-value">${weather.clouds}<span class="metric-unit">%</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">${t('feelsLike')}</div>
            <div class="metric-value">${Math.round(weather.feels_like)}<span class="metric-unit">°C</span></div>
        </div>
    `;
}

function renderHourlyForecast(forecast) {
    const hourlyContainer = document.getElementById('hourly-scroll');
    // Show next 12 intervals (36 hours)
    const items = forecast.items.slice(0, 12);

    hourlyContainer.innerHTML = items.map(item => {
        const time = new Date(item.date_text.replace(' ', 'T') + 'Z');
        const hours = time.getUTCHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;

        return `
            <div class="hourly-card">
                <div class="hourly-time">${displayHour} ${ampm}</div>
                <img class="hourly-icon" src="${item.icon_url}" alt="${item.conditions[0]?.description || ''}">
                <div class="hourly-temp">${Math.round(item.temperature)}°</div>
            </div>
        `;
    }).join('');
}

function renderDailyForecast(forecast) {
    const forecastContainer = document.getElementById('forecast-scroll');

    // Group by day
    const dailyMap = {};
    forecast.items.forEach(item => {
        const day = item.date_text.substring(0, 10);
        if (!dailyMap[day]) {
            dailyMap[day] = { temps: [], conditions: [], icons: [], pops: [] };
        }
        dailyMap[day].temps.push(item.temperature);
        dailyMap[day].conditions.push(item.conditions[0]?.description || '');
        dailyMap[day].icons.push(item.icon_url);
        dailyMap[day].pops.push(item.pop);
    });

    const days = Object.entries(dailyMap);

    forecastContainer.innerHTML = days.map(([dateStr, data], index) => {
        const date = new Date(dateStr + 'T12:00:00Z');
        const dayName = index === 0 ? 'Today' : SHORT_DAYS[date.getUTCDay()];
        const monthDay = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
        const tempMax = Math.round(Math.max(...data.temps));
        const tempMin = Math.round(Math.min(...data.temps));
        // Pick the most common condition's icon (midday preferred)
        const midIcon = data.icons[Math.floor(data.icons.length / 2)];
        const condition = data.conditions[Math.floor(data.conditions.length / 2)];
        const maxPop = Math.round(Math.max(...data.pops) * 100);

        return `
            <div class="forecast-card ${index === 0 ? 'active' : ''}">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-date">${monthDay}</div>
                <img class="forecast-icon" src="${midIcon}" alt="${condition}">
                <div class="forecast-temp-range">
                    <span class="forecast-temp-high">${tempMax}°</span>
                    <span class="forecast-temp-low">${tempMin}°</span>
                </div>
                <div class="forecast-condition">${condition}</div>
                ${maxPop > 10 ? `<div class="forecast-rain">💧 ${maxPop}%</div>` : ''}
            </div>
        `;
    }).join('');
}

// ── Map Location Selection ─────────────────────────────────────
function renderMap(lat, lon, city) {
    if (!weatherMap) {
        weatherMap = L.map('weather-map').setView([lat, lon], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            className: 'map-tiles'
        }).addTo(weatherMap);

        // Click on map to fetch weather data & real-time alerts for selected point
        weatherMap.on('click', async (e) => {
            const clickedLat = e.latlng.lat;
            const clickedLon = e.latlng.lng;

            if (mapMarker) {
                mapMarker.setLatLng([clickedLat, clickedLon])
                         .bindPopup(`
                            <div style="font-family: sans-serif; text-align: center; padding: 4px;">
                                <b style="color: #0284c7;">📍 Selected Map Location</b><br>
                                <span style="font-size: 0.8rem; color: #64748b;">Lat: ${clickedLat.toFixed(4)}, Lon: ${clickedLon.toFixed(4)}</span><br>
                                <span style="font-size: 0.75rem; color: #f59e0b; font-weight: 600;">Fetching weather & alerts...</span>
                            </div>
                         `)
                         .openPopup();
            }

            await loadWeather(clickedLat, clickedLon);
        });
    } else {
        weatherMap.setView([lat, lon], 10);
    }

    if (mapMarker) {
        weatherMap.removeLayer(mapMarker);
    }

    mapMarker = L.marker([lat, lon]).addTo(weatherMap)
        .bindPopup(`
            <div style="font-family: sans-serif; text-align: center; padding: 4px;">
                <b style="font-size: 1rem; color: #0f172a;">${city}</b><br>
                <span style="font-size: 0.8rem; color: #64748b;">Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</span><br>
                <span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">✓ Active Location Selected</span>
            </div>
        `)
        .openPopup();

    setTimeout(() => {
        weatherMap.invalidateSize();
    }, 100);
}

// ── Real-Time Alerts ───────────────────────────────────────────
function renderAlerts(alerts) {
    const container = document.getElementById('alerts-container');
    const countBadge = document.getElementById('alerts-count');

    if (!alerts || alerts.length === 0) {
        container.innerHTML = `
            <div class="no-alerts">
                <div class="no-alerts-icon">✅</div>
                <div class="no-alerts-text">No extreme weather alerts active for this location</div>
            </div>
        `;
        countBadge.textContent = '';
        countBadge.style.display = 'none';
        return;
    }

    countBadge.textContent = `${alerts.length} Alert${alerts.length > 1 ? 's' : ''}`;
    countBadge.style.display = 'inline-flex';

    // Determine highest severity for badge color
    const hasRed = alerts.some(a => a.severity.toLowerCase() === 'red');
    const hasOrange = alerts.some(a => a.severity.toLowerCase() === 'orange');
    
    if (hasRed) {
        countBadge.className = 'alert-badge red';
    } else if (hasOrange) {
        countBadge.className = 'alert-badge orange';
    } else {
        countBadge.className = 'alert-badge yellow';
    }

    container.innerHTML = alerts.map(alert => {
        const severity = alert.severity.toLowerCase();
        const severityIcon = severity === 'red' ? '🔴' : severity === 'orange' ? '🟠' : '🟡';
        const startTime = new Date(alert.start * 1000).toLocaleString();
        const endTime = new Date(alert.end * 1000).toLocaleString();

        return `
            <div class="alert-item ${severity}">
                <div class="alert-header">
                    <span class="alert-badge ${severity}">${alert.severity}</span>
                    <span class="alert-event">${alert.event}</span>
                </div>
                <div class="alert-time">⏱️ ${startTime} — ${endTime}</div>
                <div class="alert-description">${alert.description.substring(0, 200)}${alert.description.length > 200 ? '...' : ''}</div>
            </div>
        `;
    }).join('');
}

// ── Utility Functions ──────────────────────────────────────────
function formatUnixTime(unix, tzOffset) {
    const d = new Date((unix + tzOffset) * 1000);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m} ${ampm}`;
}

function getWindDirection(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
}

// ── Quick City Buttons (Welcome Screen) ────────────────────────
function loadQuickCity(city) {
    searchBar.value = city;
    loadWeatherByCity(city);
}

// ── Visibility Graph ───────────────────────────────────────────
function renderVisibilityGraph(weather, forecast) {
    const currentVisKm = (weather.visibility / 1000).toFixed(1);
    
    // Process forecast items (next 12 intervals = 36 hours)
    const items = forecast.items ? forecast.items.slice(0, 12) : [];
    const labels = [];
    const dataVis = [];

    items.forEach(item => {
        const time = new Date(item.date_text.replace(' ', 'T') + 'Z');
        const hours = time.getUTCHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        labels.push(`${displayHour} ${ampm}`);
        
        const visKm = item.visibility ? (item.visibility / 1000) : (weather.visibility / 1000);
        dataVis.push(parseFloat(visKm.toFixed(1)));
    });

    if (dataVis.length === 0) {
        dataVis.push(parseFloat(currentVisKm));
        labels.push('Now');
    }

    const minVis = Math.min(...dataVis).toFixed(1);
    const maxVis = Math.max(...dataVis).toFixed(1);
    const avgVis = (dataVis.reduce((a, b) => a + b, 0) / dataVis.length).toFixed(1);

    document.getElementById('vis-current').textContent = `${currentVisKm} km`;
    document.getElementById('vis-min').textContent = `${minVis} km`;
    document.getElementById('vis-max').textContent = `${maxVis} km`;
    document.getElementById('vis-avg').textContent = `${avgVis} km`;

    // Status badge description
    const statusTextEl = document.getElementById('visibility-status-text');
    let statusLabel = 'Excellent Sight';

    if (currentVisKm >= 10) {
        statusLabel = `${currentVisKm} km (Excellent Sight)`;
    } else if (currentVisKm >= 6) {
        statusLabel = `${currentVisKm} km (Good Sight)`;
    } else if (currentVisKm >= 3) {
        statusLabel = `${currentVisKm} km (Moderate Haze)`;
    } else {
        statusLabel = `${currentVisKm} km (Low Sight / Fog)`;
    }

    if (statusTextEl) {
        statusTextEl.textContent = statusLabel;
    }

    // Canvas & Chart rendering
    const ctx = document.getElementById('visibility-chart');
    if (!ctx) return;

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library is not loaded');
        return;
    }

    if (visibilityChart) {
        visibilityChart.destroy();
    }

    const canvasCtx = ctx.getContext('2d');
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.02)');

    visibilityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Visibility (km)',
                data: dataVis,
                borderColor: '#06b6d4',
                borderWidth: 3,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#ffffff',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                backgroundColor: gradient,
                tension: 0.35,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Visibility: ${context.parsed.y} km`
                    },
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#60a5fa',
                    bodyColor: '#f9fafb',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    padding: 10,
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    suggestedMin: 0,
                    suggestedMax: 10,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 11 },
                        callback: (val) => `${val} km`
                    }
                }
            }
        }
    });
}

// ── Voice Search Assistant ─────────────────────────────────────
function setupVoiceSearch() {
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    if (!voiceSearchBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceSearchBtn.title = "Voice recognition not supported in this browser";
        voiceSearchBtn.style.opacity = "0.5";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    let isListening = false;

    voiceSearchBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }

        try {
            recognition.start();
            isListening = true;
            voiceSearchBtn.classList.add('recording');
            voiceSearchBtn.title = "Listening... Speak city name";
        } catch (err) {
            console.error("Speech recognition error:", err);
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
            searchBar.value = transcript;
            searchCities(transcript);
            loadWeatherByCity(transcript);
        }
    };

    recognition.onend = () => {
        isListening = false;
        voiceSearchBtn.classList.remove('recording');
        voiceSearchBtn.title = "Voice Search (Speak city name)";
    };

    recognition.onerror = (event) => {
        console.warn("Voice search error:", event.error);
        isListening = false;
        voiceSearchBtn.classList.remove('recording');
    };
}

// ── Weather Breakdown Pie Charts ───────────────────────────────
function renderWeatherPieCharts(weather, forecast) {
    if (typeof Chart === 'undefined') return;

    // 1. Forecast Condition Breakdown
    const condCounts = {};
    if (forecast && forecast.items) {
        forecast.items.forEach(item => {
            const main = item.conditions && item.conditions[0] ? item.conditions[0].main : 'Clear';
            condCounts[main] = (condCounts[main] || 0) + 1;
        });
    } else if (weather.conditions && weather.conditions[0]) {
        condCounts[weather.conditions[0].main] = 1;
    } else {
        condCounts['Clear'] = 1;
    }

    const labelsCond = Object.keys(condCounts);
    const dataCond = Object.values(condCounts);

    const colorMap = {
        'Clear': '#f59e0b',
        'Clouds': '#38bdf8',
        'Rain': '#3b82f6',
        'Drizzle': '#06b6d4',
        'Thunderstorm': '#8b5cf6',
        'Snow': '#e0e7ff',
        'Mist': '#94a3b8',
        'Fog': '#64748b',
        'Haze': '#cbd5e1'
    };

    const bgColorsCond = labelsCond.map(l => colorMap[l] || '#60a5fa');

    const ctx1 = document.getElementById('condition-pie-chart');
    if (ctx1) {
        if (conditionPieChart) conditionPieChart.destroy();

        conditionPieChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: labelsCond,
                datasets: [{
                    data: dataCond,
                    backgroundColor: bgColorsCond,
                    borderColor: 'rgba(17, 24, 39, 0.8)',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#9ca3af',
                            font: { family: 'Inter', size: 11 },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = Math.round((context.parsed / total) * 100);
                                return ` ${context.label}: ${pct}% (${context.parsed} intervals)`;
                            }
                        },
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                cutout: '58%'
            }
        });
    }

    // 2. Atmospheric & Cloud Composition
    const humidity = weather.humidity || 0;
    const cloudCover = weather.clouds || 0;
    const clearSkyRatio = Math.max(0, 100 - cloudCover);
    const rainProb = Math.round((forecast && forecast.items && forecast.items[0] ? forecast.items[0].pop : 0) * 100);

    const labelsAtm = ['Humidity (%)', 'Cloud Cover (%)', 'Clear Atmosphere (%)', 'Rain Chance (%)'];
    const dataAtm = [humidity, cloudCover, clearSkyRatio, rainProb];
    const bgColorsAtm = ['#06b6d4', '#94a3b8', '#f59e0b', '#3b82f6'];

    const ctx2 = document.getElementById('atmospheric-pie-chart');
    if (ctx2) {
        if (atmosphericPieChart) atmosphericPieChart.destroy();

        atmosphericPieChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: labelsAtm,
                datasets: [{
                    data: dataAtm,
                    backgroundColor: bgColorsAtm,
                    borderColor: 'rgba(17, 24, 39, 0.8)',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#9ca3af',
                            font: { family: 'Inter', size: 11 },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.label}: ${context.parsed}%`
                        },
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                cutout: '58%'
            }
        });
    }
}
