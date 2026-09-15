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
let searchTimeout = null;
let weatherMap = null;
let mapMarker = null;

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
        if (typeof window.checkWeatherAlerts === 'function') {
            window.checkWeatherAlerts();
        }
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
        if (typeof window.checkWeatherAlerts === 'function') {
            window.checkWeatherAlerts();
        }
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
    console.log("WEATHER DATA RECEIVED BY FRONTEND:", weather);
    const conditionText = weather.conditions?.[0]?.description || 'N/A';
    console.log("CONDITION TEXT:", conditionText);
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
                <div class="hero-condition">${conditionText}</div>
                <div class="hero-feels">Feels like ${Math.round(weather.feels_like)}°C · H:${Math.round(weather.temp_max)}° L:${Math.round(weather.temp_min)}°</div>
            </div>
        <img class="hero-icon"
             src="${weather.icon_url}"
             alt="${conditionText}">
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
    const windDir = getWindDirection(weather.wind_deg);

    document.getElementById('metrics-grid').innerHTML = `
        <div class="metric-item">
            <div class="metric-label">💧 Humidity</div>
            <div class="metric-value">${weather.humidity}<span class="metric-unit">%</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">💨 Wind</div>
            <div class="metric-value">${weather.wind_speed}<span class="metric-unit"> m/s ${windDir}</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">🌡️ Pressure</div>
            <div class="metric-value">${weather.pressure}<span class="metric-unit"> hPa</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">👁️ Visibility</div>
            <div class="metric-value">${(weather.visibility / 1000).toFixed(1)}<span class="metric-unit"> km</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">☁️ Clouds</div>
            <div class="metric-value">${weather.clouds}<span class="metric-unit">%</span></div>
        </div>
        <div class="metric-item">
            <div class="metric-label">🌡️ Feels Like</div>
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

// ── Map ────────────────────────────────────────────────────────
function renderMap(lat, lon, city) {
    if (!weatherMap) {
        weatherMap = L.map('weather-map').setView([lat, lon], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            className: 'map-tiles'
        }).addTo(weatherMap);

        // Detect clicks on the map
        weatherMap.on('click', async function (event) {
            console.log('Map clicked!');
            const clickedLat = event.latlng.lat;
            const clickedLon = event.latlng.lng;

            const popup = L.popup()
                .setLatLng([clickedLat, clickedLon])
                .setContent('Loading weather...')
                .openOn(weatherMap);

            try {
                const response = await fetch(
                    `${API_BASE}/api/weather/current?lat=${clickedLat}&lon=${clickedLon}`
                );

                if (!response.ok) {
                    throw new Error('Weather request failed');
                }

                const weather = await response.json();

                const condition =
                    weather.conditions?.[0]?.description || 'N/A';

                popup.setContent(`
    <div class="map-weather-popup">
        <h3>${weather.city || 'Selected location'}</h3>

        <p><strong>Temperature:</strong> ${Math.round(weather.temperature)}°C</p>
        <p><strong>Condition:</strong> ${condition}</p>
        <p><strong>Humidity:</strong> ${weather.humidity}%</p>
        <p><strong>Wind:</strong> ${weather.wind_speed} m/s</p>

        <button id="ask-map-weather">
    Ask Chatbot
</button>
    </div>
`);

                document
                    .getElementById('ask-map-weather')
                    ?.addEventListener('click', () => {
                        console.log("ASK CHATBOT BUTTON CLICKED");
                        if (typeof window.openWeatherChat === 'function') {
                            window.openWeatherChat();
                        } else {
                            console.error('openWeatherChat is not available.');
                            return;
                        }
                        const question = `
Give me detailed weather information for ${weather.city || 'this selected location'}.
The current temperature is ${weather.temperature}°C.
The condition is ${condition}.
Humidity is ${weather.humidity}%.
Wind speed is ${weather.wind_speed} m/s.

Explain the weather in simple language and give useful precautions.
        `.trim();

                        if (typeof window.sendMessage === 'function') {
                            window.sendMessage(question);
                        } else {
                            console.error('Chatbot sendMessage function is not available.');
                        }

                    });
            } catch (error) {
                console.error('Map weather error:', error);

                popup.setContent(
                    'Unable to load weather for this location.'
                );
            }
        });
    } else {
        weatherMap.setView([lat, lon], 10);
    }

    if (mapMarker) {
        weatherMap.removeLayer(mapMarker);
    }

    mapMarker = L.marker([lat, lon])
        .addTo(weatherMap)
        .bindPopup(`<b>${city}</b>`)
        .openPopup();

    setTimeout(() => {
        weatherMap.invalidateSize();
    }, 100);
}

// ── Alerts ─────────────────────────────────────────────────────
function renderAlerts(alerts) {
    const container = document.getElementById('alerts-container');
    const countBadge = document.getElementById('alerts-count');

    if (!container || !countBadge) {
        return;
    }

    if (!alerts || alerts.length === 0) {
        container.innerHTML = `
            <div class="no-alerts">
                <div class="no-alerts-icon">✅</div>
                <div class="no-alerts-text">
                    No active weather alerts for this area
                </div>
            </div>
        `;

        countBadge.textContent = '';
        countBadge.style.display = 'none';
        return;
    }

    countBadge.textContent = alerts.length;
    countBadge.style.display = 'inline-flex';

    container.innerHTML = alerts.map(alert => {
        const severity = (alert.severity || 'yellow').toLowerCase();
        const title = alert.title || 'Weather Alert';
        const message = alert.message || 'Please stay updated.';

        return `
            <div class="alert-item ${severity}">
                <div class="alert-header">
                    <span class="alert-badge ${severity}">
                        ${title}
                    </span>

                    <span class="alert-event">
                        ${severity.toUpperCase()}
                    </span>
                </div>

                <div class="alert-description">
                    ${message}
                </div>
            </div>
        `;
    }).join('');
    console.log("NEW renderAlerts is running");
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


