"use strict";

import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm";

const API_BASE = "/api/weather";

async function apiFetch(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!resp.ok) {
      const msg =
        resp.status === 401 ? "Invalid API credentials."
        : resp.status === 404 ? "City not found. Please check the spelling."
        : `Server error ${resp.status}. Please try again.`;
      return { error: msg };
    }
    return await resp.json();
  } catch {
    return { error: "Network error — please check your connection." };
  }
}

const fetchCurrentByCity   = (city)      => apiFetch(`${API_BASE}/current?city=${encodeURIComponent(city)}`);
const fetchCurrentByCoords = (lat, lon)  => apiFetch(`${API_BASE}/current?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
const fetchForecastByCoords= (lat, lon)  => apiFetch(`${API_BASE}/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
const fetchAirQuality      = (lat, lon)  => apiFetch(`${API_BASE}/air-quality?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
const fetchPrecipitation   = (lat, lon)  => apiFetch(`${API_BASE}/precipitation?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);

function deg2dir(deg) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg / 45) % 8];
}

function fmtTime(unix, tz = 0) {
  return new Date((unix + tz) * 1000).toUTCString().slice(17, 22);
}

function getEmoji(main = "") {
  const m = main.toLowerCase();
  if (m.includes("thunder")) return "⛈️";
  if (m.includes("drizzle")) return "🌦️";
  if (m.includes("rain"))    return "🌧️";
  if (m.includes("snow"))    return "❄️";
  if (m.includes("mist") || m.includes("fog") || m.includes("haze") ||
      m.includes("smoke") || m.includes("dust")) return "🌫️";
  if (m.includes("cloud"))   return "☁️";
  if (m.includes("clear"))   return "☀️";
  return "🌤️";
}

const AQI_META = {
  1: { label:"Good",      color:"#22c55e", bg:"rgba(34,197,94,0.10)"   },
  2: { label:"Fair",      color:"#84cc16", bg:"rgba(132,204,22,0.10)"  },
  3: { label:"Moderate",  color:"#eab308", bg:"rgba(234,179,8,0.10)"   },
  4: { label:"Poor",      color:"#f97316", bg:"rgba(249,115,22,0.10)"  },
  5: { label:"Very Poor", color:"#ef4444", bg:"rgba(239,68,68,0.10)"   },
};
const AQI_EMOJI = ["","😊","🙂","😐","😷","☠️"];

function parseAQI(raw) {
  if (!raw?.list?.length) return null;
  const e    = raw.list[0];
  const meta = AQI_META[e.main.aqi] || AQI_META[3];
  return {
    aqi:   e.main.aqi,
    ...meta,
    emoji: AQI_EMOJI[e.main.aqi],
    pm25:  e.components.pm2_5,
    pm10:  e.components.pm10,
    o3:    e.components.o3,
    no2:   e.components.no2,
    so2:   e.components.so2,
    co:    e.components.co,
  };
}

function parseRecentRain(raw) {
  const times         = raw?.hourly?.time          ?? [];
  const precipitation = raw?.hourly?.precipitation ?? [];
  const temperatures  = raw?.hourly?.temperature_2m ?? [];
  if (!times.length || !precipitation.length) return null;

  const now     = Date.now();
  const entries = times.map((time, i) => ({
    time,
    timestamp: new Date(time).getTime(),
    amount:    Number(precipitation[i]) || 0,
    temperature: Number(temperatures[i]),
  })).filter(e => Number.isFinite(e.timestamp));

  const past   = entries.filter(e => e.timestamp <= now);
  const future = entries.filter(e => e.timestamp >  now);
  const past24 = past.slice(-24);
  const next24 = future.slice(0, 24);
  const next48 = future.slice(0, 48);
  const lastWet = [...past24].reverse().find(e => e.amount > 0);
  const currentHour = past[past.length - 1] ?? null;

  const todayTemps = [...past24, ...next24]
    .filter(e => Math.abs(e.timestamp - now) <= 12 * 3600000)
    .map(e => e.temperature)
    .filter(Number.isFinite);

  const hoursAgo = lastWet
    ? Math.max(0, Math.round((now - lastWet.timestamp) / 3600000))
    : null;

  return {
    currentHourRain: currentHour?.amount ?? 0,
    lastRain: lastWet
      ? { amount: lastWet.amount,
          ago:    hoursAgo < 1 ? "Within the last hour" : `${hoursAgo} hours ago`,
          window: "Recent hourly history" }
      : null,
    rainIn24: next24.reduce((s, e) => s + e.amount, 0),
    rainIn48: next48.reduce((s, e) => s + e.amount, 0),
    dayMin: todayTemps.length ? Math.min(...todayTemps) : NaN,
    dayMax: todayTemps.length ? Math.max(...todayTemps) : NaN,
  };
}

function getLastRainInfo(weather, recentRain) {
  if (recentRain?.lastRain) {
    return {
      ago:    recentRain.lastRain.ago,
      window: recentRain.lastRain.window,
      amount: recentRain.lastRain.amount.toFixed(2),
      unit:   "mm of rainfall depth",
      status: recentRain.lastRain.amount > 0 ? "recent" : "none",
    };
  }
  const rain1h = weather.rain?.["1h"] || 0;
  const rain3h = weather.rain?.["3h"] || 0;
  const desc   = (weather.weather[0].description || "").toLowerCase();
  if (rain1h > 0) return { ago:"Current observation", window:"Within last hour",  amount:rain1h.toFixed(2), unit:"mm", status:"now" };
  if (rain3h > 0) return { ago:"Within last 3 hours",  window:"1–3 hours ago",    amount:rain3h.toFixed(2), unit:"mm", status:"recent" };
  if (desc.includes("drizzle") || desc.includes("shower"))
    return { ago:"Possibly recent", window:"Current observation", amount:"Trace", unit:"mm", status:"trace" };
  return { ago:null, window:"Not in current data", amount:"0", unit:"No rainfall in observation window", status:"none" };
}

function analyzeRain(list = []) {
  const next24 = list.slice(0, 8);
  const next48 = list.slice(0, 16);
  return {
    rainIn24:  next24.reduce((s, e) => s + (e.rain?.["3h"] || 0), 0),
    rainIn48:  next48.reduce((s, e) => s + (e.rain?.["3h"] || 0), 0),
    firstRain: next48.find(e => (e.rain?.["3h"] || 0) > 0) || null,
  };
}

function getForecastTempRange(forecast, recentRain, weather) {
  if (Number.isFinite(recentRain?.dayMin) && Number.isFinite(recentRain?.dayMax))
    return { min: recentRain.dayMin, max: recentRain.dayMax, label: "24-hour range" };
  const next24 = (forecast?.list ?? []).slice(0, 8)
    .map(e => e.main?.temp).filter(Number.isFinite);
  if (next24.length)
    return { min: Math.min(...next24), max: Math.max(...next24), label: "Forecast range" };
  return { min: weather.main.temp_min, max: weather.main.temp_max, label: "Current area" };
}

function buildDailyForecast(list = []) {
  const days = {};
  list.forEach(item => {
    const d = new Date(item.dt * 1000);
    const key = d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
    if (!days[key]) days[key] = { temps: [], pops: [], icons: [], descs: [] };
    days[key].temps.push(item.main.temp);
    days[key].pops.push((item.pop || 0) * 100);
    days[key].icons.push(item.weather[0].main);
    days[key].descs.push(item.weather[0].description);
  });
  return Object.entries(days).slice(0, 7).map(([key, v]) => {
    const [dayName] = key.split(",");
    return {
      day:    dayName,
      hi:     Math.max(...v.temps),
      lo:     Math.min(...v.temps),
      pop:    Math.round(Math.max(...v.pops)),
      icon:   getEmoji(v.icons[Math.floor(v.icons.length / 2)]),
      desc:   v.descs[Math.floor(v.descs.length / 2)],
    };
  });
}

const state = {
  primary:     null,
  comparison:  null,
  compareMode: false,
  chart:       null,
};

const $ = id => document.getElementById(id);

const DOM = {
  cityInput:       $("city-input"),
  btnSearch:       $("btn-search"),
  btnLocate:       $("btn-locate"),
  btnCompare:      $("btn-compare-toggle"),
  dashboard:       $("dashboard"),
  welcomeState:    $("welcome-state"),
  errorBanner:     $("error-banner"),
  loadingOverlay:  $("loading-overlay"),
  rowCompare:      $("row-compare"),
  heroCity:        $("hero-city"),
  heroCountry:     $("hero-country"),
  heroIcon:        $("hero-icon"),
  heroTemp:        $("hero-temp"),
  heroCondition:   $("hero-condition"),
  heroFeels:       $("hero-feels"),
  heroRange:       $("hero-range"),
  heroPills:       $("hero-pills"),
  aqiScoreLabel:   $("aqi-score-label"),
  aqiBarFill:      $("aqi-bar-fill"),
  aqiPollutants:   $("aqi-pollutants"),
  aqiContent:      $("aqi-content"),
  aqiEmpty:        $("aqi-empty"),
  compareInput:    $("compare-input"),
  btnCompareGo:    $("btn-compare-go"),
  compareLoading:  $("compare-loading"),
  compareMatrix:   $("compare-matrix"),
  tempChart:       $("temp-chart"),
  chartLegend:     $("chart-legend"),
  rainGrid:        $("rain-grid"),
  stripRow:        $("strip-row"),
  stripWrap:       $("strip-wrap"),
  forecastRow:     $("forecast-row"),
};

function showError(msg) {
  DOM.errorBanner.textContent = msg;
  DOM.errorBanner.classList.remove("d-none");
}
function clearError() {
  DOM.errorBanner.textContent = "";
  DOM.errorBanner.classList.add("d-none");
}
function setLoading(on) {
  DOM.loadingOverlay.classList.toggle("d-none", !on);
}

function showDashboard() {
  DOM.welcomeState.classList.add("d-none");
  DOM.dashboard.classList.remove("d-none");

  animate(
    "#dashboard .wv-card",
    { opacity: [0, 1], scale: [0.96, 1] },
    { 
      delay: stagger(0.08), 
      duration: 0.5, 
      easing: "ease-out"
    }
  );
}

function html(strings, ...vals) {
  return String.raw(strings, ...vals);
}

function renderHero(weather, recentRain) {
  const w        = weather;
  const rr       = recentRain;
  const forecast = state.primary?.forecast || null;
  const range    = getForecastTempRange(forecast, rr, w);

  DOM.heroCity.textContent      = w.name;
  DOM.heroCountry.textContent   = w.sys.country;
  DOM.heroIcon.textContent      = getEmoji(w.weather[0].main);
  DOM.heroTemp.textContent      = `${Math.round(w.main.temp)}°`;
  DOM.heroCondition.textContent = w.weather[0].description;
  DOM.heroFeels.textContent     = `Feels like ${Math.round(w.main.feels_like)}°C`;
  DOM.heroRange.textContent     = `${range.label}: ↓ ${Math.round(range.min)}° · ↑ ${Math.round(range.max)}°`;

  DOM.heroPills.innerHTML = [
    `<span class="wv-pill">💧 ${w.main.humidity}%</span>`,
    `<span class="wv-pill">💨 ${w.wind.speed.toFixed(1)} m/s ${deg2dir(w.wind.deg)}</span>`,
    `<span class="wv-pill">🌡️ ${w.main.pressure} mb</span>`,
    `<span class="wv-pill">☁️ ${w.clouds?.all ?? 0}% cloud</span>`,
    `<span class="wv-pill">👁️ ${w.visibility ? (w.visibility/1000).toFixed(1)+"km" : "N/A"}</span>`,
    `<span class="wv-pill">🌄 ${fmtTime(w.sys.sunrise, w.timezone)} / ${fmtTime(w.sys.sunset, w.timezone)}</span>`,
  ].join("");
}

function renderAQI(aqi) {
  if (!aqi) {
    DOM.aqiContent.classList.add("d-none");
    DOM.aqiEmpty.classList.remove("d-none");
    return;
  }
  DOM.aqiEmpty.classList.add("d-none");
  DOM.aqiContent.classList.remove("d-none");

  DOM.aqiScoreLabel.textContent = `${aqi.emoji} AQI ${aqi.aqi} — ${aqi.label}`;
  DOM.aqiScoreLabel.style.color = aqi.color;

  DOM.aqiBarFill.style.width      = `${(aqi.aqi / 5) * 100}%`;
  DOM.aqiBarFill.style.background =
    `linear-gradient(90deg, #22c55e 0%, ${aqi.color} 100%)`;

  const pollutants = [
    { label:"PM2.5", val:aqi.pm25.toFixed(1), unit:"µg/m³",
      warn: aqi.pm25 > 75 ? "High" : aqi.pm25 > 35 ? "Moderate" : "Normal" },
    { label:"PM10",  val:aqi.pm10.toFixed(1), unit:"µg/m³",
      warn: aqi.pm10 > 150 ? "High" : "Normal" },
    { label:"O₃",   val:aqi.o3.toFixed(0),   unit:"µg/m³",
      warn: aqi.o3 > 120 ? "Elevated" : "Normal" },
    { label:"NO₂",  val:aqi.no2.toFixed(1),  unit:"µg/m³",
      warn: aqi.no2 > 80 ? "Elevated" : "Normal" },
    { label:"SO₂",  val:aqi.so2.toFixed(1),  unit:"µg/m³",
      warn: aqi.so2 > 20 ? "Elevated" : "Normal" },
    { label:"CO",   val:(aqi.co/1000).toFixed(2), unit:"mg/m³",
      warn: "Normal" },
  ];

  DOM.aqiPollutants.innerHTML = pollutants.map(p => {
    const cls = p.warn === "Normal" ? "wv-ps-ok"
              : p.warn === "Moderate" ? "wv-ps-warn"
              : "wv-ps-crit";
    return `<div class="wv-pollutant">
      <span class="wv-poll-label">${p.label}</span>
      <span class="wv-poll-val">${p.val} <small>${p.unit}</small></span>
      <span class="wv-poll-status ${cls}">${p.warn}</span>
    </div>`;
  }).join("");
}

function renderRain(weather, forecast, recentRain) {
  const rr     = recentRain;
  const fRain  = forecast ? analyzeRain(forecast.list) : { rainIn24:0, rainIn48:0, firstRain:null };
  const rains  = {
    rainIn24:  rr?.rainIn24   ?? fRain.rainIn24,
    rainIn48:  rr?.rainIn48   ?? fRain.rainIn48,
    firstRain: fRain.firstRain,
  };
  const rain1h = rr?.currentHourRain ?? weather?.rain?.["1h"] ?? 0;
  const last   = getLastRainInfo(weather, rr);

  const rainPillClass = rain1h > 5 ? "wv-pill-red" : rain1h > 0 ? "wv-pill-blue" : "wv-pill-muted";
  const rainPillLabel = rain1h > 7.5 ? "Heavy Rain" : rain1h > 2.5 ? "Moderate" : rain1h > 0 ? "Light Rain" : "None";

  const firstRainStr = rains.firstRain
    ? new Date(rains.firstRain.dt * 1000).toLocaleTimeString("en-US",
        { hour:"2-digit", minute:"2-digit", hour12:true })
    : "None in 48h";
  const firstRainSub = rains.firstRain
    ? new Date(rains.firstRain.dt * 1000).toLocaleDateString("en-US",
        { weekday:"short", day:"numeric", month:"short" })
    : "";

  DOM.rainGrid.innerHTML = `
    <div class="wv-rain-block">
      <div class="wv-rain-block-label">Last Rainfall</div>
      <div class="wv-rain-block-main">${last.amount}<span class="mm-note"> mm</span></div>
      <div class="wv-rain-block-sub">${last.ago ? last.ago : "No recent rainfall"}</div>
      <div class="wv-rain-block-sub" style="font-size:0.65rem;color:var(--text-dim)">${last.window}</div>
    </div>
    <div class="wv-rain-block">
      <div class="wv-rain-block-label">Now (1h)</div>
      <div class="wv-rain-block-main">${rain1h.toFixed(2)} mm</div>
      <span class="wv-rain-pill ${rainPillClass}">${rainPillLabel}</span>
    </div>
    <div class="wv-rain-block">
      <div class="wv-rain-block-label">Expected (24h)</div>
      <div class="wv-rain-block-main">${rains.rainIn24.toFixed(1)} mm</div>
      <div class="wv-rain-block-sub">Forecast accumulation</div>
    </div>
    <div class="wv-rain-block">
      <div class="wv-rain-block-label">Next Rain Event</div>
      <div class="wv-rain-block-main ${!rains.firstRain ? 'text-muted' : ''}">${firstRainStr}</div>
      ${firstRainSub ? `<div class="wv-rain-block-sub">${firstRainSub}</div>` : ""}
    </div>
  `;

  if (forecast?.list?.length) {
    const tz = weather.timezone;
    DOM.stripRow.innerHTML = forecast.list.slice(0, 8).map(s => {
      const rain = s.rain?.["3h"] || 0;
      return `<div class="wv-strip-slot ${rain > 0 ? 'wv-slot-wet' : ''}">
        <span class="wv-slot-time">${new Date(s.dt * 1000).toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit", hour12:true})}</span>
        <span class="wv-slot-icon">${getEmoji(s.weather[0].main)}</span>
        <span class="wv-slot-temp">${Math.round(s.main.temp)}°</span>
        ${rain > 0 ? `<span class="wv-slot-rain">${rain.toFixed(1)}mm</span>` : ""}
      </div>`;
    }).join("");
    DOM.stripWrap.classList.remove("d-none");
  } else {
    DOM.stripWrap.classList.add("d-none");
  }
}

function renderForecast(forecast) {
  if (!forecast?.list?.length) {
    DOM.forecastRow.innerHTML = `<p style="color:var(--text-dim);font-size:.85rem">Forecast unavailable</p>`;
    return;
  }
  const daily = buildDailyForecast(forecast.list);
  DOM.forecastRow.innerHTML = daily.map(d => `
    <div class="wv-forecast-card">
      <div class="wv-fc-day">${d.day}</div>
      <div class="wv-fc-icon">${d.icon}</div>
      <div class="wv-fc-hi-lo">
        <span class="wv-fc-hi">${Math.round(d.hi)}°</span>
        <span class="wv-fc-sep">/</span>
        <span class="wv-fc-lo">${Math.round(d.lo)}°</span>
      </div>
      ${d.pop > 5 ? `<div class="wv-fc-precip">💧 ${d.pop}%</div>` : ""}
      <div class="wv-fc-desc">${d.desc}</div>
    </div>
  `).join("");
}

function buildChartDatasets(primaryForecast, compForecast = null) {
  const slice = (list, n = 12) => list.slice(0, n);

  const primaryList = slice(primaryForecast?.list ?? []);
  const labels = primaryList.map(e =>
    new Date(e.dt * 1000).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true })
  );
  const primaryTemps = primaryList.map(e => +e.main.temp.toFixed(1));

  const datasets = [
    {
      label:           state.primary?.weather?.name ?? "City 1",
      data:            primaryTemps,
      borderColor:     "#00F0FF",
      backgroundColor: "rgba(0,240,255,0.08)",
      borderWidth:     2.5,
      tension:         0.4,
      fill:            true,
      pointBackgroundColor: "#00F0FF",
      pointRadius:     3,
      pointHoverRadius: 6,
    },
  ];

  if (compForecast?.list?.length) {
    const compList  = slice(compForecast.list);
    const compTemps = compList.map(e => +e.main.temp.toFixed(1));
    datasets.push({
      label:           state.comparison?.weather?.name ?? "City 2",
      data:            compTemps,
      borderColor:     "#f97316",
      backgroundColor: "rgba(249,115,22,0.07)",
      borderWidth:     2.5,
      tension:         0.4,
      fill:            true,
      pointBackgroundColor: "#f97316",
      pointRadius:     3,
      pointHoverRadius: 6,
    });
  }

  return { labels, datasets };
}

function renderChart() {
  const { labels, datasets } = buildChartDatasets(
    state.primary?.forecast,
    state.comparison?.forecast ?? null
  );

  DOM.chartLegend.innerHTML = datasets.map(d =>
    `<span style="color:${d.borderColor};margin-right:.6rem">● ${d.label}</span>`
  ).join("");

  if (state.chart) {
    state.chart.data.labels   = labels;
    state.chart.data.datasets = datasets;
    state.chart.update("active");
    return;
  }

  state.chart = new Chart(DOM.tempChart, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(11,19,43,0.95)",
          borderColor:     "rgba(0,240,255,0.3)",
          borderWidth:     1,
          titleColor:      "#8AA2BA",
          bodyColor:       "#fff",
          padding:         10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}°C`,
          },
        },
      },
      scales: {
        x: {
          ticks:  { color:"#8AA2BA", font:{ size:10 }, maxTicksLimit:8 },
          grid:   { color:"rgba(255,255,255,0.04)" },
          border: { color:"transparent" },
        },
        y: {
          ticks:  { color:"#8AA2BA", font:{ size:11 }, callback: v => v+"°" },
          grid:   { color:"rgba(255,255,255,0.06)" },
          border: { color:"transparent" },
        },
      },
    },
  });
}

function renderCompareMatrix() {
  const p = state.primary;
  const c = state.comparison;

  if (!p || !c) {
    DOM.compareMatrix.classList.add("d-none");
    return;
  }

  const aqiP = parseAQI(p.aqi);
  const aqiC = parseAQI(c.aqi);

  const blockHTML = (data, aqi) => {
    const w = data.weather;
    const rows = [
      ["Temperature",  `${Math.round(w.main.temp)}°C`],
      ["Feels Like",   `${Math.round(w.main.feels_like)}°C`],
      ["Humidity",     `${w.main.humidity}%`],
      ["Wind Speed",   `${w.wind.speed.toFixed(1)} m/s ${deg2dir(w.wind.deg)}`],
      ["Pressure",     `${w.main.pressure} mb`],
      ["Visibility",   w.visibility ? (w.visibility/1000).toFixed(1)+"km" : "N/A"],
      ["Condition",    w.weather[0].description],
      ["AQI",          aqi ? `${aqi.emoji} ${aqi.aqi} — ${aqi.label}` : "N/A"],
    ];
    return `<div class="wv-compare-city-block">
      <div class="wv-cmp-city-name">${w.name}, ${w.sys.country}</div>
      ${rows.map(([k,v]) => `<div class="wv-cmp-row">
        <span class="wv-cmp-key">${k}</span>
        <span class="wv-cmp-val">${v}</span>
      </div>`).join("")}
    </div>`;
  };

  DOM.compareMatrix.innerHTML = blockHTML(p, aqiP) + blockHTML(c, aqiC);
  DOM.compareMatrix.classList.remove("d-none");
}

async function loadCity(weatherPromise) {
  clearError();
  setLoading(true);

  const w = await weatherPromise;
  if (w.error) {
    showError(w.error);
    setLoading(false);
    return;
  }

  const [forecast, aqiRaw, precipRaw] = await Promise.all([
    fetchForecastByCoords(w.coord.lat, w.coord.lon),
    fetchAirQuality(w.coord.lat, w.coord.lon),
    fetchPrecipitation(w.coord.lat, w.coord.lon),
  ]);

  state.primary = {
    weather:      w,
    forecast:     forecast.error ? null : forecast,
    aqi:          aqiRaw.error   ? null : aqiRaw,
    precipitation: precipRaw.error ? null : precipRaw,
  };

  const recentRain = parseRecentRain(state.primary.precipitation);
  const aqi        = parseAQI(state.primary.aqi);

  setLoading(false);
  showDashboard();

  renderHero(w, recentRain);
  renderAQI(aqi);
  renderRain(w, state.primary.forecast, recentRain);
  renderForecast(state.primary.forecast);
  renderChart();

  if (state.compareMode && state.comparison) {
    renderCompareMatrix();
    renderChart();
  }

  DOM.cityInput.value = w.name;
}

async function loadComparisonCity(city) {
  DOM.compareLoading.classList.remove("d-none");
  DOM.compareMatrix.classList.add("d-none");

  const w = await fetchCurrentByCity(city);
  if (w.error) {
    showError(`Comparison: ${w.error}`);
    DOM.compareLoading.classList.add("d-none");
    return;
  }

  const [forecast, aqiRaw] = await Promise.all([
    fetchForecastByCoords(w.coord.lat, w.coord.lon),
    fetchAirQuality(w.coord.lat, w.coord.lon),
  ]);

  state.comparison = {
    weather:  w,
    forecast: forecast.error ? null : forecast,
    aqi:      aqiRaw.error   ? null : aqiRaw,
  };

  DOM.compareLoading.classList.add("d-none");
  renderCompareMatrix();
  renderChart();

  animate(
    "#compare-card",
    { opacity: [0, 1], scale: [0.96, 1] },
    { duration: 0.4, easing: "ease-out" }
  );
}

function initEvents() {
  DOM.btnSearch.addEventListener("click", () => {
    const city = DOM.cityInput.value.trim();
    if (!city) { showError("Please enter a city name."); return; }
    loadCity(fetchCurrentByCity(city));
  });

  DOM.cityInput.addEventListener("keydown", e => {
    if (e.key === "Enter") DOM.btnSearch.click();
  });

  DOM.btnLocate.addEventListener("click", () => {
    if (!navigator.geolocation) { showError("Geolocation not supported by your browser."); return; }
    clearError();
    navigator.geolocation.getCurrentPosition(
      pos => loadCity(fetchCurrentByCoords(pos.coords.latitude, pos.coords.longitude)),
      ()  => showError("Location access denied. Please search manually.")
    );
  });

  DOM.btnCompare.addEventListener("click", () => {
    state.compareMode = !state.compareMode;
    DOM.btnCompare.classList.toggle("active", state.compareMode);
    DOM.btnCompare.setAttribute("aria-pressed", state.compareMode);
    DOM.rowCompare.classList.toggle("visible", state.compareMode);

    if (!state.compareMode) {
      state.comparison = null;
      DOM.compareMatrix.classList.add("d-none");
      DOM.compareInput.value = "";
      renderChart();
    }
  });

  DOM.btnCompareGo.addEventListener("click", async () => {
    const compCity = DOM.compareInput.value.trim();
    if (!compCity) { showError("Enter a city name to compare."); return; }
    if (!state.primary) { showError("Search a primary city first."); return; }

    clearError();
    DOM.compareLoading.classList.remove("d-none");

    const [freshPrimary, compWeather] = await Promise.all([
      fetchCurrentByCity(state.primary.weather.name),
      fetchCurrentByCity(compCity),
    ]);

    if (compWeather.error) {
      showError(`Comparison: ${compWeather.error}`);
      DOM.compareLoading.classList.add("d-none");
      return;
    }

    const [compForecast, compAQI] = await Promise.all([
      fetchForecastByCoords(compWeather.coord.lat, compWeather.coord.lon),
      fetchAirQuality(compWeather.coord.lat, compWeather.coord.lon),
    ]);

    state.comparison = {
      weather:  compWeather,
      forecast: compForecast.error ? null : compForecast,
      aqi:      compAQI.error      ? null : compAQI,
    };

    DOM.compareLoading.classList.add("d-none");
    renderCompareMatrix();
    renderChart();
  });

  DOM.compareInput.addEventListener("keydown", e => {
    if (e.key === "Enter") DOM.btnCompareGo.click();
  });
}

initEvents();

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => loadCity(fetchCurrentByCoords(pos.coords.latitude, pos.coords.longitude)),
    () => { },
    { timeout: 5000 }
  );
}

if (!DOM.welcomeState.classList.contains("d-none")) {
  animate(
    ".wv-welcome",
    { opacity: [0, 1], scale: [0.95, 1] },
    { duration: 0.8, easing: "ease-out" }
  );
}

