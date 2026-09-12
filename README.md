# WeatherGPT 🌦️

**Conversational AI for Weather Forecasting, Alerts, and Climate Information**

Inspired by IMD's Mausam app — Problem Statement #26068

---

## Features

- 🌡️ **Real-time Weather** — Current conditions for any city worldwide
- 📅 **5-Day Forecast** — 3-hour interval forecast with daily summaries
- ⚠️ **Color-coded Alerts** — Red/Orange/Yellow severity (Mausam-style)
- 🤖 **AI Chatbot** — Gemini-powered conversational weather assistant
- 🔍 **City Search** — Autocomplete-enabled global city search
- 📍 **Geolocation** — One-click weather for your current location
- 🎨 **Dynamic UI** — Background changes with weather conditions
- 📱 **Responsive** — Works on desktop, tablet, and mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python + FastAPI |
| **AI** | Google Gemini 2.0 Flash (function calling) |
| **Weather Data** | OpenWeatherMap API |
| **Frontend** | Vanilla HTML/CSS/JS |
| **Design** | Dark glassmorphism with gradients |

## Quick Start

### 1. Get API Keys

- **OpenWeatherMap**: [Sign up here](https://openweathermap.org/api) (free tier)
- **Google Gemini**: [Get key here](https://aistudio.google.com/apikey)

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run the Server

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 5. Open the App

Navigate to [http://localhost:8000](http://localhost:8000)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/weather/current?city=Mumbai` | Current weather |
| `GET` | `/api/weather/forecast?city=Mumbai` | 5-day forecast |
| `GET` | `/api/weather/search?q=Mum` | City autocomplete |
| `GET` | `/api/alerts?lat=19.07&lon=72.88` | Weather alerts |
| `POST` | `/api/chat` | AI chatbot |
| `GET` | `/docs` | Swagger API docs |

## Project Structure

```
weather-gpt/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings & env vars
│   │   ├── schemas.py           # Pydantic models
│   │   ├── routers/
│   │   │   ├── weather.py       # Weather endpoints
│   │   │   ├── alerts.py        # Alert endpoints
│   │   │   └── chat.py          # Chat endpoint
│   │   └── services/
│   │       ├── weather_service.py  # OpenWeatherMap wrapper
│   │       └── chat_service.py     # Gemini AI service
│   ├── .env
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── js/chat.js
└── README.md
```

## Color-coded Alert System

| Color | Severity | Action |
|-------|----------|--------|
| 🔴 **Red** | Extreme | Take immediate action |
| 🟠 **Orange** | Severe | Be prepared, stay alert |
| 🟡 **Yellow** | Moderate | Keep yourself updated |

## License

Built for the Smart India Hackathon — India Meteorological Department
