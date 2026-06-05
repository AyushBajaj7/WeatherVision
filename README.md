# WeatherVision 🌐

WeatherVision is a high-performance, responsive weather analytics dashboard designed to visualize real-time atmospheric data, air quality index, hourly precipitation trends, and cross-city comparison profiles.

Built with a **zero-dependency Python standard library backend** and a lightweight, GPU-accelerated frontend using Vanilla ES6+ JS, CSS3, and Motion One animations.

---

## 🔗 Live Production Deployment

The project is hosted in the cloud and auto-deploys on every commit:
*   **Production URL**: [https://weathervision.onrender.com/](https://weathervision.onrender.com/)
*   **Hosting Platform**: Render (Web Service)
*   **Configuration**: Reads the API credentials directly from Render's secure Environment Variables (`OPENWEATHER_API_KEY`).

---

## 🚀 Local Development (Quick Start)

You can run a local instance of the server on your machine for development and testing.

### 1. Prerequisites
Ensure you have **Python 3.8+** installed locally.

### 2. Configure Local Credentials
Create a `.env` file in the root directory (this file is excluded from Git tracking):
```env
OPENWEATHER_API_KEY=your_openweather_api_key_here
```

### 3. Launch the Local Server
Start the local server by running:
```bash
python server.py
```

By default, the server will bind to `0.0.0.0` (all network interfaces) and fallback to port `8080` if no `PORT` environment variable is specified.

Open your browser and navigate to:
*   [http://localhost:8080](http://localhost:8080) (or `http://127.0.0.1:8080`)

---

## 🛠️ Technology Stack

*   **Backend**: Python 3 Standard Library (`http.server`, `urllib`, `json`, `os`).
*   **Frontend UI**: HTML5, Vanilla CSS3, Bootstrap 5 (Grid & Base Layouts).
*   **Frontend Logic**: Vanilla JavaScript (ES6 Modules).
*   **Animations**: Motion One (lightweight, hardware-accelerated WAAPI wrapper).
*   **Data Visualization**: Chart.js.
*   **APIs**:
    *   [OpenWeather API](https://openweathermap.org/api) (Current weather, 5-Day forecast, AQI).
    *   [Open-Meteo API](https://open-meteo.com) (Precipitation history & forecasts).

---

## 📁 Project Structure

```text
├── .env                  # API credentials for local development (git-ignored)
├── .gitignore            # Excluded directories and files
├── app.js                # Frontend controller (DOM manipulation, API handling, Chart rendering)
├── index.html            # Main markup document
├── README.md             # Project documentation
├── server.py             # Custom Python HTTP Server & API Gateway Proxy
└── style.css             # Main styling rules, CSS custom properties, and glow keyframes
```
