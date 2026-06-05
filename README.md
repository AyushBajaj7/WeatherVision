# WeatherVision 🌐

**Live Link**: [https://weathervision.onrender.com/](https://weathervision.onrender.com/)

WeatherVision is a high-performance, responsive weather analytics dashboard designed to visualize real-time atmospheric data, air quality index, hourly precipitation trends, and cross-city comparison profiles.

Built with a **zero-dependency Python standard library backend** and a lightweight, GPU-accelerated frontend using Vanilla ES6+ JS, CSS3, and Motion One.

---

## 🚀 Key Features

*   **Real-Time Weather Analytics**: Instant queries for temperature, humidity, wind velocity, atmospheric pressure, visibility, and sunrise/sunset times.
*   **Air Quality Index (AQI) Monitor**: Displays detailed pollutant levels ($PM_{2.5}$, $PM_{10}$, $O_3$, $NO_2$, $SO_2$, $CO$) with dynamic safety ratings.
*   **Hourly Precipitation Tracker**: Aggregates past history and forecast trends using Open-Meteo to show when it last rained and estimate next rainfall events.
*   **Cross-City Comparison**: Compare weather conditions, air quality, and temperature trends of two cities side-by-side.
*   **Dynamic Visualizations**: Beautiful, responsive line charts visualizing hourly forecasts via Chart.js.
*   **Premium Dark UI**: Smooth micro-interactions, floating visual elements, and staggered reveal animations using Motion One.

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
├── .env                  # API configuration credentials (git-ignored)
├── .gitignore            # Excluded directories and files
├── app.js                # Frontend controller (DOM manipulation, API handling, Chart rendering)
├── index.html            # Main markup document
├── README.md             # Project documentation
├── server.py             # Custom Python HTTP Server & API Gateway Proxy
└── style.css             # Main styling rules, CSS custom properties, and glow keyframes
```

---

## ⚙️ Quick Start

### 1. Prerequisites
Ensure you have **Python 3.8+** installed on your machine.

### 2. Configure Credentials
1. Create a `.env` file in the root directory:
   ```env
   OPENWEATHER_API_KEY=your_openweather_api_key_here
   ```
2. Save your API key in it.

### 3. Launch the Server
Start the local server by running:
```bash
python server.py
```

Open your browser and navigate to:
```text
http://localhost:8080
```
