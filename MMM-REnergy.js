/* MagicMirror² Module: MMM-REnergy
 * Renewable Energy in Europe (first test subject: Germany)
 * Data source1: SMARD.de (Bundesnetzagentur) – CC BY 4.0
 * Data source2: https://www.energy-charts.info (Fraunhofer Institute for Solar Energy Systems ISE) – CC BY 4.0
 * Data source3:  battery-charts.de/battery-charts (RWTH Aachen University) – CC BY 4.0
 */

Module.register("MMM-REnergy", {

  // ── Default configuration ──────────────────────────────────────
  defaults: {
    fetchInterval:     24 * 60 * 60 * 1000, // data refresh interval (default: once per day)
    animationSpeed:    1000,
    showMiniChart:     true,
    chartDays:         30,

    // Display language: "de" (German) or "en" (English)
    language: "de",

    // Layout: number of tiles visible simultaneously (1 | 2 | 4)
    tilesVisible: 4,
    // Grid layout (only relevant when tilesVisible === 4)
    //   "1x4" → all four tiles in a single row
    //   "2x2" → two rows of two tiles
    gridLayout: "1x4",

    // Rotation: automatically cycle through tiles
    rotation:          false,
    rotationInterval:  8000,  // ms between tile changes
    rotationTransition: 600,  // ms fade duration

    // Tile order (all available tiles; future tiles can be added here)
    tiles: ["wind", "solar", "renewable", "production", "windExpansion", "solarExpansion", "monthlyMix", "batteryLongTerm", "weeklyMix", "renewableWeekly", "renewableEU"],

    // Fixed tile dimensions in pixels.
    // null = automatic (content-driven). Set both for a rigid, uniform layout.
    // Example: tileWidth: 180, tileHeight: 220
    tileWidth:  null,
    tileHeight: null,

    // Annual expansion targets (GW) used for the 2026 progress bar.
    // Adjust to match official national targets for your configured country.
    expansionTargets: {
      wind:  10.0,   // GW new wind capacity targeted for 2026
      solar: 22.0,   // GW new solar capacity targeted for 2026
    },
  },

  requiresVersion: "2.15.0",

  // ── Internal state ────────────────────────────────────────────
  energyData:     null,
  loaded:         false,
  error:          null,
  currentTileIdx: 0,
  rotationTimer:  null,

  // ── i18n strings ─────────────────────────────────────────────
  _i18n: {
    de: {
      title:         "Erneuerbare Energie in Deutschland",
      loading:       "Lade Energiedaten…",
      errorPrefix:   "Daten nicht verfügbar",
      windLabel:     "Windeinspeisung",
      solarLabel:    "Solareinspeisung",
      renewLabel:    "Erneuerbare",
      prodLabel:     "Stromproduktion",
      avgPower:      "Ø-Leistung",
      yesterday:     "gestern",
      gwPeak:        "GW Peak",
      share:         "Anteil",
      renewSub:      "des Stroms waren gestern erneuerbar",
      avg30:         "30-Tage-Durchschnitt",
      inclBiomass:   "inkl. Biomasse",
      prodSub:       "Strom wurden gestern in Deutschland erzeugt",
      dataSource:    "Daten: Bundesnetzagentur | SMARD.de",
      // expansion tiles
      windExpLabel:        "Ausbau Windenergie 2026",
      solarExpLabel:       "Ausbau Sonnenenergie 2026",
      expansionTarget:     "Ziel 2026",
      expansionProgress:   "neu installiert seit Jan 2026",
      expansionPrevYear:   "Ausbau 2025",
      expansionNoData:     "Noch keine Daten für 2026",
      // monthlyMix tile
      monthlyLabel:  "Strommix diesen Monat",
      monthlySub:    "Erzeugung laufender Monat",
      renewable:     "Erneuerbar",
      // battery tile
      batteryLabel:   "Batteriespeicher Ausbau",
      batterySub:     "Installierte Leistung in Deutschland",
      batterySource:  "Quelle: Fraunhofer ISE · energy-charts.info",
      // weeklyMix tile
      weeklyLabel:   "Strom diese Woche",
      weeklySub:     "Stündliche Einspeisung (7 Tage)",
      // renewableWeekly tile
      renewWeekLabel: "Erneuerbarer Anteil diese Woche",
      renewWeekSub:   "Wind + Solar + Biomasse vs. konventionell",
      // EU map tile
      euMapLabel: "Erneuerbare in Europa",
      euMapSub:   "Gestriger Ø-Anteil erneuerb. Strom",
      carriers: {
        wind:    "Wind",
        solar:   "Solar",
        coal:    "Kohle",
        gas:     "Erdgas",
        biomass: "Biomasse",
        other:   "Sonstige",
      }
    },
    en: {
      title:         "Renewable Energies in Germany",
      loading:       "Loading energy data…",
      errorPrefix:   "Data unavailable",
      windLabel:     "Wind Feed-in",
      solarLabel:    "Solar Feed-in",
      renewLabel:    "Renewables",
      prodLabel:     "Power Production",
      avgPower:      "Avg. power",
      yesterday:     "yesterday",
      gwPeak:        "GW Peak",
      share:         "Share",
      renewSub:      "of electricity was renewable yesterday",
      avg30:         "30-day average",
      inclBiomass:   "incl. biomass",
      prodSub:       "electricity generated in Germany yesterday",
      dataSource:    "Data: Federal Network Agency | SMARD.de",
      // expansion tiles
      windExpLabel:        "Wind Energy Expansion 2026",
      solarExpLabel:       "Solar Energy Expansion 2026",
      expansionTarget:     "Target 2026",
      expansionProgress:   "newly installed since Jan 2026",
      expansionPrevYear:   "Expansion 2025",
      expansionNoData:     "No data for 2026 yet",
      // monthlyMix tile
      monthlyLabel:  "Power Mix This Month",
      monthlySub:    "Generation current month",
      renewable:     "Renewable",
      // battery tile
      batteryLabel:   "Battery Storage Expansion",
      batterySub:     "Installed capacity in Germany",
      batterySource:  "Source: Fraunhofer ISE · energy-charts.info",
      // weeklyMix tile
      weeklyLabel:   "Power This Week",
      weeklySub:     "Hourly feed-in (7 days)",
      // renewableWeekly tile
      renewWeekLabel: "Renewable Share This Week",
      renewWeekSub:   "Wind + Solar + Biomass vs. conventional",
      // EU map tile
      euMapLabel: "Renewables in Europe",
      euMapSub:   "Yesterday's avg. renewable share",
      carriers: {
        wind:    "Wind",
        solar:   "Solar",
        coal:    "Coal",
        gas:     "Gas",
        biomass: "Biomass",
        other:   "Other",
      }
    }
  },

  // ── Lifecycle ─────────────────────────────────────────────────
  start() {
    Log.info(`[MMM-REnergy] Module started – language: ${this.config.language}, tiles: ${this.config.tilesVisible}, grid: ${this.config.gridLayout}, fetchInterval: ${this.config.fetchInterval / 1000}s`);
    this.scheduleUpdate();
  },

  stop() {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
  },

  scheduleUpdate() {
    this.sendSocketNotification("FETCH_ENERGY_DATA", { chartDays: this.config.chartDays });
    setInterval(() => {
      this.sendSocketNotification("FETCH_ENERGY_DATA", { chartDays: this.config.chartDays });
    }, this.config.fetchInterval);
  },

  socketNotificationReceived(notification, payload) {
    if (notification !== "ENERGY_DATA_RESULT") return;
    if (payload.error) {
      this.error = payload.error;
      Log.error(`[MMM-REnergy] Error from node_helper: ${payload.error}`);
    } else {
      this.energyData = payload;
      this.loaded     = true;
      this.error      = null;
      Log.info(`[MMM-REnergy] Data received – renewables: ${payload.renewablePercent}% | avg30: ${payload.renewableAvg30}%`);
    }
    this.updateDom(this.config.animationSpeed);

    // Only rotate if fewer tiles are visible than the total number of tiles
    if (this.loaded && this.config.rotation && !this.rotationTimer
        && this.config.tilesVisible < this.config.tiles.length) {
      this._startRotation();
    }
  },

  // ── DOM build ─────────────────────────────────────────────────
  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "mmm-renergy-wrapper";

    // Inject grid CSS inline to bypass MagicMirror CSS cache.
    // Re-inject whenever tileWidth changes (id includes width value).
    const styleId = `mmm-renergy-grid-style-${this.config.tileWidth || "auto"}`;
    if (!document.getElementById(styleId)) {
      // Remove any previous version first
      const prev = document.querySelector("[id^='mmm-renergy-grid-style']");
      if (prev) prev.remove();
      const col = this.config.tileWidth ? `${this.config.tileWidth}px` : "1fr";
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .mmm-renergy-wrapper { display: inline-block; width: fit-content; }
        .energyde-grid { display: grid; gap: 1px; width: fit-content; }
        .energyde-grid--1   { grid-template-columns: ${col}; }
        .energyde-grid--2   { grid-template-columns: repeat(2, ${col}); }
        .energyde-grid--1x4 { grid-template-columns: repeat(4, ${col}); }
        .energyde-grid--2x2 { grid-template-columns: repeat(2, ${col}); }
      `;
      document.head.appendChild(style);
    }

    const t = this._t();

    if (this.error) {
      wrapper.innerHTML = `<div class="energyde-error">⚡ ${t.errorPrefix}: ${this.error}</div>`;
      return wrapper;
    }
    if (!this.loaded || !this.energyData) {
      wrapper.innerHTML = `<div class="energyde-loading"><span class="energyde-spinner">◌</span> ${t.loading}</div>`;
      return wrapper;
    }

    const d   = this.energyData;
    const cfg = this.config;
    const all = cfg.tiles;
    const vis = cfg.tilesVisible;

    // Which tiles are visible right now?
    const visibleTiles = [];
    for (let i = 0; i < vis; i++) {
      visibleTiles.push(all[(this.currentTileIdx + i) % all.length]);
    }

    const grid = document.createElement("div");
    grid.className = `energyde-grid ${this._gridClass(vis, cfg.gridLayout)}`;

    visibleTiles.forEach(tileId => {
      try {
        const panel = this._buildTile(tileId, d, t);
        if (panel) grid.appendChild(panel);
      } catch (err) {
        Log.error(`[MMM-REnergy] Error rendering tile "${tileId}": ${err.message}`);
        const errPanel = this._createPanel("error");
        errPanel.innerHTML = `<div class="energyde-loading" style="color:#e74c3c">⚠ ${tileId}</div>`;
        grid.appendChild(errPanel);
      }
    });

    wrapper.appendChild(grid);

    // Navigation dots (shown during rotation)
    if (cfg.rotation && all.length > vis) {
      wrapper.appendChild(this._buildDots(all, vis));
    }

    const footer = document.createElement("div");
    footer.className = "energyde-footer";
    footer.textContent = `${t.dataSource} · ${d.lastUpdate}`;
    wrapper.appendChild(footer);

    return wrapper;
  },

  // ── Helpers ───────────────────────────────────────────────────
  _t() {
    const lang = this.config.language === "en" ? "en" : "de";
    return this._i18n[lang];
  },

  _gridClass(vis, gridLayout) {
    if (vis === 1) return "energyde-grid--1";
    if (vis === 2) return "energyde-grid--2";
    if (vis === 4) return gridLayout === "2x2" ? "energyde-grid--2x2" : "energyde-grid--1x4";
    return "energyde-grid--1x4";
  },

  _buildTile(tileId, d, t) {
    switch (tileId) {
      case "wind":         return this._buildWindPanel(d, t);
      case "solar":        return this._buildSolarPanel(d, t);
      case "renewable":    return this._buildRenewablePanel(d, t);
      case "production":   return this._buildProductionPanel(d, t);
      case "windExpansion":  return this._buildExpansionPanel("wind",  d, t);
      case "solarExpansion": return this._buildExpansionPanel("solar", d, t);
      case "monthlyMix":      return this._buildMonthlyMixPanel(d, t);
      case "batteryLongTerm": return this._buildBatteryPanel(d, t);
      case "weeklyMix":       return this._buildWeeklyStackedPanel(d, t);
      case "renewableWeekly": return this._buildRenewableWeeklyPanel(d, t);
      case "renewableEU":     return this._buildEuropeMapPanel(d, t);
      default:
        Log.warn(`[MMM-REnergy] Unknown tile: ${tileId}`);
        return null;
    }
  },

  // ── Tiles ─────────────────────────────────────────────────────
  _buildWindPanel(d, t) {
    const panel    = this._createPanel("wind");
    // Use SVG wind icon instead of Unicode glyph (fixes empty-box rendering)
    const windSvg  = `<svg class="energyde-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#00b4d8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`;
    const chartSvg = this._buildMiniChart(d.wind.history || [], "#00b4d8");

    panel.innerHTML = `
      <div class="energyde-panel-header">
        ${windSvg}
        <span class="energyde-label">${t.windLabel}</span>
      </div>
      <div class="energyde-big-number">${d.wind.avgGW.toFixed(1)} <span class="energyde-unit">GW</span></div>
      <div class="energyde-sub">${t.avgPower} <strong>${t.yesterday}</strong></div>
      <div class="energyde-stat-row">
        <div class="energyde-stat">
          <span class="energyde-stat-val energyde-col--wind">${d.wind.maxGW.toFixed(1)}</span>
          <span class="energyde-stat-label">${t.gwPeak}</span>
        </div>
        <div class="energyde-stat">
          <span class="energyde-stat-val">${d.wind.totalGWh.toFixed(0)}</span>
          <span class="energyde-stat-label">GWh</span>
        </div>
        <div class="energyde-stat">
          <span class="energyde-stat-val energyde-col--wind">${d.mix.wind} %</span>
          <span class="energyde-stat-label">${t.share}</span>
        </div>
      </div>
    `;
    if (this.config.showMiniChart && chartSvg) {
      const c = document.createElement("div");
      c.className = "energyde-minichart";
      c.innerHTML = chartSvg;
      panel.appendChild(c);
    }
    return panel;
  },

  _buildSolarPanel(d, t) {
    const panel    = this._createPanel("solar");
    // Solar chart uses the same yellow as the Peak value (#f4c430)
    const chartSvg = this._buildMiniChart(d.solar.history || [], "#f4c430");

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon energyde-icon--solar">☀</span>
        <span class="energyde-label">${t.solarLabel}</span>
      </div>
      <div class="energyde-big-number">${d.solar.avgGW.toFixed(1)} <span class="energyde-unit">GW</span></div>
      <div class="energyde-sub">${t.avgPower} <strong>${t.yesterday}</strong></div>
      <div class="energyde-stat-row">
        <div class="energyde-stat">
          <span class="energyde-stat-val energyde-col--solar">${d.solar.maxGW.toFixed(1)}</span>
          <span class="energyde-stat-label">${t.gwPeak}</span>
        </div>
        <div class="energyde-stat">
          <span class="energyde-stat-val">${d.solar.totalGWh.toFixed(0)}</span>
          <span class="energyde-stat-label">GWh</span>
        </div>
        <div class="energyde-stat">
          <span class="energyde-stat-val energyde-col--solar">${d.mix.solar} %</span>
          <span class="energyde-stat-label">${t.share}</span>
        </div>
      </div>
    `;
    if (this.config.showMiniChart && chartSvg) {
      const c = document.createElement("div");
      c.className = "energyde-minichart";
      c.innerHTML = chartSvg;
      panel.appendChild(c);
    }
    return panel;
  },

  _buildRenewablePanel(d, t) {
    const panel    = this._createPanel("renewable");
    const chartSvg = this._buildMiniChart(d.renewableHistory, "#2ecc71");

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon energyde-icon--renewable">⟳</span>
        <span class="energyde-label">${t.renewLabel}</span>
      </div>
      <div class="energyde-big-number">${d.renewablePercent} <span class="energyde-unit">%</span></div>
      <div class="energyde-sub">${t.renewSub}</div>
      <div class="energyde-sub" style="opacity:0.6;font-size:0.82em">${d.renewablePercentFull}% ${t.inclBiomass}</div>
      <div class="energyde-avg">${t.avg30}: <strong>${d.renewableAvg30} %</strong></div>
    `;
    if (this.config.showMiniChart && chartSvg) {
      const c = document.createElement("div");
      c.className = "energyde-minichart";
      c.innerHTML = chartSvg;
      panel.appendChild(c);
    }
    return panel;
  },

  _buildProductionPanel(d, t) {
    const panel = this._createPanel("production");

    const carriers = [
      { key: "wind",    color: "#00b4d8", value: d.mix.wind },
      { key: "solar",   color: "#f4c430", value: d.mix.solar },
      { key: "coal",    color: "#8b5e3c", value: d.mix.coal },
      { key: "gas",     color: "#9b59b6", value: d.mix.gas },
      { key: "biomass", color: "#4a7c59", value: d.mix.biomass },
      { key: "other",   color: "#555",    value: d.mix.other },
    ];

    const barsHtml = carriers.map(c => `
      <div class="energyde-bar-row">
        <span class="energyde-bar-label">${t.carriers[c.key]}</span>
        <div class="energyde-bar-track">
          <div class="energyde-bar-fill" style="width:${c.value}%;background:${c.color}"></div>
        </div>
        <span class="energyde-bar-pct">${c.value} %</span>
      </div>
    `).join("");

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon energyde-icon--production">⚡</span>
        <span class="energyde-label">${t.prodLabel}</span>
      </div>
      <div class="energyde-big-number">${d.totalTWh.toFixed(2)} <span class="energyde-unit">TWh</span></div>
      <div class="energyde-sub">${t.prodSub}</div>
      <div class="energyde-bars">${barsHtml}</div>
    `;
    return panel;
  },

  // ── Rotation ──────────────────────────────────────────────────
  _startRotation() {
    Log.info(`[MMM-REnergy] Rotation started (interval: ${this.config.rotationInterval}ms)`);
    this.rotationTimer = setInterval(() => {
      const total = this.config.tiles.length;
      const vis   = this.config.tilesVisible;
      this.currentTileIdx = (this.currentTileIdx + vis) % total;
      const wrapper = document.querySelector(".mmm-renergy-wrapper");
      if (wrapper) {
        wrapper.style.transition = `opacity ${this.config.rotationTransition}ms ease`;
        wrapper.style.opacity    = "0";
        setTimeout(() => {
          this.updateDom(0);
          setTimeout(() => {
            const w = document.querySelector(".mmm-renergy-wrapper");
            if (w) { w.style.transition = `opacity ${this.config.rotationTransition}ms ease`; w.style.opacity = "1"; }
          }, 50);
        }, this.config.rotationTransition);
      } else {
        this.updateDom(0);
      }
    }, this.config.rotationInterval);
  },

  _buildDots(all, vis) {
    const el      = document.createElement("div");
    el.className  = "energyde-dots";
    const steps   = Math.ceil(all.length / vis);
    const current = Math.floor(this.currentTileIdx / vis);
    for (let i = 0; i < steps; i++) {
      const dot = document.createElement("span");
      dot.className = "energyde-dot-item" + (i === current ? " energyde-dot-active" : "");
      el.appendChild(dot);
    }
    return el;
  },

  // ── Chart ─────────────────────────────────────────────────────
  _createPanel(type) {
    const div = document.createElement("div");
    div.className = `energyde-panel energyde-panel--${type}`;
    // Apply fixed dimensions if configured
    if (this.config.tileWidth)  div.style.width    = `${this.config.tileWidth}px`;
    if (this.config.tileHeight) {
      div.style.height   = `${this.config.tileHeight}px`;
      div.style.overflow = "hidden";   // clip content if tile is too small
      div.style.boxSizing = "border-box";
    }
    return div;
  },

  _buildMiniChart(history, color) {
    const data = (history || []).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (data.length < 2) return null;

    const W = 200, H = 55;
    const min   = Math.min(...data);
    const max   = Math.max(...data);
    const range = max - min || 1;

    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const lx = W;
    const ly = H - ((data[data.length - 1] - min) / range) * (H - 8) - 4;

    return `<svg viewBox="0 0 ${W} ${H}" class="energyde-svg" preserveAspectRatio="none" style="overflow:visible;width:100%;height:100%;">
      <defs>
        <linearGradient id="energyde-fill-${color.replace("#","")}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="0,${H} ${pts} ${W},${H}" fill="url(#energyde-fill-${color.replace("#","")})"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly.toFixed(1)}" r="2.5" fill="${color}"/>
    </svg>`;
  },

  // ── Expansion tiles: 2026 progress bar + 2025 summary ───────────────────────
  // Progress bar: GW newly installed in 2026 vs. annual target (config.expansionTargets)
  // Below: 2025 full-year expansion shown numerically for context.
  //
  // Gain calculation uses yearlyAnchors (SKIP-independent, from monthly year-end values):
  //   gain2026 = anchor[2026] − anchor[2025]   (or latest monthly 2026 point if no anchor yet)
  //   gain2025 = anchor[2025] − anchor[2024]
  _buildExpansionPanel(type, d, t) {
    const isWind  = type === "wind";
    const color   = isWind ? "#00b4d8" : "#f4c430";
    const typeKey = isWind ? "wind" : "solar";
    const label   = isWind ? t.windExpLabel : t.solarExpLabel;
    const icon    = isWind
      ? `<svg class="energyde-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`
      : `<span class="energyde-icon energyde-icon--solar">☀</span>`;

    const panel = this._createPanel(typeKey);

    if (!d.expansion?.series?.length) {
      panel.innerHTML = `<div class="energyde-loading">…</div>`;
      return panel;
    }

    const series  = d.expansion.series;
    const anchors = d.expansion.yearlyAnchors;
    const key     = isWind ? "windGW" : "solarGW";
    const target  = isWind
      ? (this.config.expansionTargets?.wind  ?? 10.0)
      : (this.config.expansionTargets?.solar ?? 22.0);

    // ── 2025 full-year gain ───────────────────────────────────────
    let gain2025 = null;
    if (anchors?.[2025] && anchors?.[2024]) {
      gain2025 = parseFloat((anchors[2025][key] - anchors[2024][key]).toFixed(2));
    }

    // ── 2026 progress ────────────────────────────────────────────
    let gain2026 = null;
    let monthLabel = "";
    if (anchors?.[2026] && anchors?.[2025]) {
      gain2026 = parseFloat((anchors[2026][key] - anchors[2025][key]).toFixed(2));
    } else if (anchors?.[2025]) {
      const pts2026 = series.filter((s) => s.year === 2026);
      if (pts2026.length) {
        const latest = pts2026[pts2026.length - 1];
        gain2026 = parseFloat((latest[key] - anchors[2025][key]).toFixed(2));
        const MN_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
        const MN_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        monthLabel = (this.config.language === "en" ? MN_EN : MN_DE)[latest.month] ?? "";
      }
    }

    // ── Progress bar ──────────────────────────────────────────────
    const pct2026     = gain2026 !== null ? Math.min(100, (gain2026 / target) * 100) : 0;
    const hasData2026 = gain2026 !== null && gain2026 > 0;

    // Day-of-year marker: where we "should" be if expansion were linear
    const now       = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
    const daysInYear = (now.getFullYear() % 4 === 0 && (now.getFullYear() % 100 !== 0 || now.getFullYear() % 400 === 0)) ? 366 : 365;
    const pctDay    = parseFloat((dayOfYear / daysInYear * 100).toFixed(1));

    // Format date as DD.MM. (DE) or MM/DD (EN)
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dateStr = this.config.language === "en" ? `${mm}/${dd}` : `${dd}.${mm}.`;

    // Marker label: centered under the marker line
    const markerBlock = `
      <div style="position:relative;height:18px;margin-top:2px">
        <div style="position:absolute;left:${pctDay}%;top:0;transform:translateX(-50%);width:1px;height:10px;background:rgba(255,255,255,0.35)"></div>
        <div style="position:absolute;left:${pctDay}%;top:10px;transform:translateX(-50%);font-size:6px;color:#506878;white-space:nowrap;font-family:'Exo 2',sans-serif">
          ${dateStr}: ${pctDay} %
        </div>
      </div>`;

    const progressBlock = hasData2026 ? `
      <div class="energyde-big-number">
        ${gain2026.toFixed(2)} <span class="energyde-unit">GW</span>
      </div>
      <div class="energyde-sub">${t.expansionProgress}${monthLabel ? " (" + monthLabel + ")" : ""}</div>
      <div class="energyde-progress-block">
        <div class="energyde-progress-label">
          <span class="energyde-goal">${t.expansionTarget} · ${target} GW</span>
          <span class="energyde-current-val">${pct2026.toFixed(1)} %</span>
        </div>
        <div class="energyde-progress-bar" style="overflow:visible;position:relative">
          <div class="energyde-progress-fill energyde-fill--${typeKey}" style="width:${pct2026.toFixed(1)}%;overflow:visible"></div>
          <div style="position:absolute;top:-3px;left:${pctDay}%;transform:translateX(-50%);width:1px;height:10px;background:rgba(255,255,255,0.4)"></div>
        </div>
        ${markerBlock}
      </div>` : `
      <div class="energyde-sub" style="margin-top:8px">${t.expansionNoData}</div>`;

    // ── 2025 summary ──────────────────────────────────────────────
    const prev2025Block = gain2025 !== null ? `
      <div class="energyde-stat-row" style="margin-top:10px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)">
        <div class="energyde-stat">
          <span class="energyde-stat-label">${t.expansionPrevYear}</span>
          <span class="energyde-stat-val energyde-col--${typeKey}">${gain2025.toFixed(2)} <span style="font-size:0.65em;font-weight:400;color:#7a9ab0">GW</span></span>
        </div>
      </div>` : "";

    panel.innerHTML = `
      <div class="energyde-panel-header">
        ${icon}
        <span class="energyde-label">${label}</span>
      </div>
      ${progressBlock}
      ${prev2025Block}
    `;
    return panel;
  },

  // ── Monthly mix tile: Donut chart (ZEIT-style) ───────────────
  _buildMonthlyMixPanel(d, t) {
    const panel = this._createPanel("production");
    if (!d.monthlyMix) {
      panel.innerHTML = `<div class="energyde-loading">…</div>`;
      return panel;
    }

    const m = d.monthlyMix;
    const carriers = [
      { key: "wind",    color: "#00b4d8", value: m.wind },
      { key: "solar",   color: "#f4c430", value: m.solar },
      { key: "biomass", color: "#4a7c59", value: m.biomass },
      { key: "gas",     color: "#9b59b6", value: m.gas },
      { key: "coal",    color: "#8b5e3c", value: m.coal },
      { key: "other",   color: "#556677", value: m.other },
    ];

    // ── Build SVG donut ───────────────────────────────────────
    const cx = 52, cy = 52, R = 44, r = 28;  // outer R, inner r
    const total = carriers.reduce((s, c) => s + c.value, 0) || 100;
    const GAP   = 1.5;  // degrees gap between segments

    let angle = -90;  // start at top
    const segments = carriers.map((c) => {
      const deg    = (c.value / total) * 360;
      const start  = angle + GAP / 2;
      const end    = angle + deg - GAP / 2;
      angle += deg;
      if (deg < 1) return "";  // skip invisible slices

      const toRad  = (d) => (d * Math.PI) / 180;
      const x1o = cx + R * Math.cos(toRad(start));
      const y1o = cy + R * Math.sin(toRad(start));
      const x2o = cx + R * Math.cos(toRad(end));
      const y2o = cy + R * Math.sin(toRad(end));
      const x1i = cx + r * Math.cos(toRad(end));
      const y1i = cy + r * Math.sin(toRad(end));
      const x2i = cx + r * Math.cos(toRad(start));
      const y2i = cy + r * Math.sin(toRad(start));
      const large = deg - GAP > 180 ? 1 : 0;

      return `<path d="M${x1o.toFixed(2)},${y1o.toFixed(2)} A${R},${R} 0 ${large},1 ${x2o.toFixed(2)},${y2o.toFixed(2)} L${x1i.toFixed(2)},${y1i.toFixed(2)} A${r},${r} 0 ${large},0 ${x2i.toFixed(2)},${y2i.toFixed(2)} Z" fill="${c.color}" opacity="0.92"/>`;
    }).join("");

    // Centre label: renewable %
    const renewPct = m.wind + m.solar + m.biomass;
    const donutSvg = `
      <svg viewBox="0 0 104 104" width="100" height="100" class="energyde-donut">
        ${segments}
        <text x="${cx}" y="${cy - 5}" text-anchor="middle" font-family="Rajdhani,sans-serif" font-weight="700" font-size="16" fill="#fff">${renewPct}</text>
        <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-family="Exo 2,sans-serif" font-size="6.5" fill="#7a9ab0">% ${t.renewable}</text>
      </svg>`;

    // ── Legend rows ───────────────────────────────────────────
    const legendHtml = carriers.filter((c) => c.value > 0).map((c) => `
      <div class="energyde-donut-row">
        <span class="energyde-donut-dot" style="background:${c.color}"></span>
        <span class="energyde-donut-label">${t.carriers[c.key]}</span>
        <span class="energyde-donut-pct">${c.value}%</span>
      </div>`).join("");

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon energyde-icon--production">⚡</span>
        <span class="energyde-label">${t.monthlyLabel}</span>
      </div>
      <div class="energyde-sub" style="margin-bottom:4px">${m.totalTWh.toFixed(1)} TWh · ${t.monthlySub}</div>
      <div class="energyde-donut-center">${donutSvg}</div>
      <div class="energyde-donut-legend energyde-donut-legend--below">${legendHtml}</div>
    `;
    return panel;
  },

  // ── Shared helper: build stacked-area SVG ────────────────────
  // Returns HTML string: stretching data SVG + fixed-height label row
  // layers = [{vals:[GW,...], color, label}]  (bottom → top stacking order)
  _stackedAreaSvg(layers, xLabels) {
    const W = 200, H = 48, PT = 3;
    const n = layers[0].vals.length;
    if (n < 2) return "";

    // Stacked cumulative per point
    const stacked = layers.map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      let cum = 0;
      for (let l = 0; l < layers.length; l++) {
        cum += layers[l].vals[i] || 0;
        stacked[l][i] = cum;
      }
    }
    const maxVal = Math.max(...stacked[stacked.length - 1]) || 1;
    const chartH = H - PT;

    const toX = (i) => ((i / (n - 1)) * W).toFixed(1);
    const toY = (v) => (PT + chartH - (v / maxVal) * chartH).toFixed(1);

    // Polygon paths (data only, no axis text)
    let svgPaths = "";
    for (let l = layers.length - 1; l >= 0; l--) {
      const top    = stacked[l];
      const bottom = l > 0 ? stacked[l - 1] : new Array(n).fill(0);
      const topPts = top.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
      const botPts = bottom.map((_, i) => `${toX(n - 1 - i)},${toY(bottom[n - 1 - i])}`).join(" ");
      svgPaths += `<polygon points="${topPts} ${botPts}" fill="${layers[l].color}" opacity="0.85"/>`;
    }
    // Baseline
    svgPaths += `<line x1="0" y1="${(PT + chartH).toFixed(1)}" x2="${W}" y2="${(PT + chartH).toFixed(1)}" stroke="#2a3a48" stroke-width="0.5"/>`;

    // X-axis labels as separate HTML div (not inside SVG, so they don't stretch)
    const labelItems = xLabels.map(({ idx, label }) => {
      const pct = ((idx / (n - 1)) * 100).toFixed(1);
      const align = idx === 0 ? "left" : idx >= n - 1 ? "right" : "center";
      return `<span style="position:absolute;left:${pct}%;transform:translateX(${idx === 0 ? "0" : idx >= n - 1 ? "-100%" : "-50%"});font-size:6.5px;color:#506878;font-family:Exo 2,sans-serif;white-space:nowrap">${label}</span>`;
    }).join("");

    return `<svg viewBox="0 0 ${W} ${H}" class="energyde-svg" preserveAspectRatio="none" style="overflow:visible;width:100%;height:100%;display:block;">${svgPaths}</svg><div style="position:relative;height:11px;margin-top:1px;">${labelItems}</div>`;
  },

  // ── #8 Weekly stacked area: all carriers per hour ─────────────
  _buildWeeklyStackedPanel(d, t) {
    const panel = this._createPanel("production");
    if (!d.weeklyStacked) {
      panel.innerHTML = `<div class="energyde-loading">…</div>`;
      return panel;
    }

    const w = d.weeklyStacked;
    const n = w.timestamps ? w.timestamps.length : (w.len || 0);

    // Downsample to max 84 points (every 2h) for performance
    const ds = (arr) => {
      if (!arr || !arr.length) return [];
      if (arr.length <= 84) return arr;
      const out = [];
      for (let i = 0; i < arr.length; i += 2) out.push((arr[i] + (arr[i+1] || arr[i])) / 2);
      return out;
    };

    const layers = [
      { vals: ds(w.coal),    color: "#6b4c30", label: t.carriers.coal    },
      { vals: ds(w.gas),     color: "#9b59b6", label: t.carriers.gas     },
      { vals: ds(w.biomass), color: "#4a7c59", label: t.carriers.biomass },
      { vals: ds(w.solar),   color: "#f4c430", label: t.carriers.solar   },
      { vals: ds(w.wind),    color: "#00b4d8", label: t.carriers.wind    },
    ];
    const dsLen = layers[0].vals.length;

    // X-axis: Mo / Mi / Fr / So labels (every 24h = 12 downsampled pts)
    const DAYS_DE = ["Mo","Di","Mi","Do","Fr","Sa","So","Mo","Di","Mi","Do","Fr","Sa","So"];
    const DAYS_EN = ["Mo","Tu","We","Th","Fr","Sa","Su","Mo","Tu","We","Th","Fr","Sa","Su"];
    const dayNames = this.config.language === "en" ? DAYS_EN : DAYS_DE;
    const step = Math.round(dsLen / 7);
    const xLabels = [];
    for (let i = 0; i < 7; i++) {
      const idx = Math.min(i * step, dsLen - 1);
      const dayOffset = 6 - (6 - i); // 0=6 days ago ... 6=today
      const d7 = new Date();
      d7.setDate(d7.getDate() - (6 - i));
      const dayName = dayNames[d7.getDay()];
      xLabels.push({ idx, label: dayName });
    }

    const chartSvg = this._stackedAreaSvg(layers, xLabels);

    // Legend: compact 2-column
    const legendHtml = [...layers].reverse().map((l) =>
      `<span class="energyde-stacked-leg"><span class="energyde-donut-dot" style="background:${l.color}"></span>${l.label}</span>`
    ).join("");

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon energyde-icon--production">⚡</span>
        <span class="energyde-label">${t.weeklyLabel}</span>
      </div>
      <div class="energyde-sub" style="margin-bottom:4px">${t.weeklySub}</div>
      <div class="energyde-minichart energyde-minichart--xaxis">${chartSvg}</div>
      <div class="energyde-stacked-legend">${legendHtml}</div>
    `;
    return panel;
  },

  // ── #9 Renewable share this week ──────────────────────────────
  // Two stacked areas: renewable (green) vs conventional (grey)
  _buildRenewableWeeklyPanel(d, t) {
    const panel = this._createPanel("renewable");
    if (!d.weeklyStacked) {
      panel.innerHTML = `<div class="energyde-loading">…</div>`;
      return panel;
    }

    const w = d.weeklyStacked;

    // Compute per-hour: renewable GW and conventional GW
    const renew = w.wind.map((v, i) => parseFloat((v + w.solar[i] + w.biomass[i]).toFixed(2)));
    const conv  = w.coal.map((v, i) => parseFloat((v + w.gas[i]).toFixed(2)));

    // Downsample
    const ds = (arr) => {
      if (!arr || !arr.length) return [];
      if (arr.length <= 84) return arr;
      const out = [];
      for (let i = 0; i < arr.length; i += 2) out.push((arr[i] + (arr[i+1] || arr[i])) / 2);
      return out;
    };
    const dsRenew = ds(renew);
    const dsConv  = ds(conv);
    const dsLen   = dsRenew.length;

    // Average renewable share over the week
    let sumR = 0, sumT = 0;
    for (let i = 0; i < renew.length; i++) {
      sumR += renew[i];
      sumT += renew[i] + conv[i];
    }
    const avgPct = sumT > 0 ? Math.round((sumR / sumT) * 100) : 0;

    const layers = [
      { vals: dsConv,  color: "#3d5263", label: t.carriers.coal + "/" + t.carriers.gas },
      { vals: dsRenew, color: "#00b89c", label: t.renewable },
    ];

    const DAYS_DE = ["Mo","Di","Mi","Do","Fr","Sa","So"];
    const DAYS_EN = ["Mo","Tu","We","Th","Fr","Sa","Su"];
    const dayNames = this.config.language === "en" ? DAYS_EN : DAYS_DE;
    const step = Math.round(dsLen / 7);
    const xLabels = [];
    for (let i = 0; i < 7; i++) {
      const idx = Math.min(i * step, dsLen - 1);
      const d7 = new Date();
      d7.setDate(d7.getDate() - (6 - i));
      xLabels.push({ idx, label: dayNames[d7.getDay()] });
    }

    const chartSvg = this._stackedAreaSvg(layers, xLabels);

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon energyde-icon--renewable">↗</span>
        <span class="energyde-label">${t.renewWeekLabel}</span>
      </div>
      <div class="energyde-big-number">${avgPct} <span class="energyde-unit">%</span></div>
      <div class="energyde-sub" style="margin-bottom:4px">${t.renewWeekSub}</div>
      <div class="energyde-minichart energyde-minichart--xaxis">${chartSvg}</div>
    `;
    return panel;
  },

  // ── Battery storage expansion tile ───────────────────────────
  // Data: Fraunhofer ISE Energy-Charts API (CC BY 4.0)
  // Shows cumulative installed battery capacity in Germany as area chart
  _buildBatteryPanel(d, t) {
    const panel = this._createPanel("renewable");
    if (!d.battery?.series?.length) {
      panel.innerHTML = `<div class="energyde-loading">…</div>`;
      return panel;
    }

    const series  = d.battery.series;
    const last    = series[series.length - 1];
    const vals    = series.map((s) => s.value);
    const unit    = d.battery.unit || "GW";

    const W = 200, H = 48, PT = 4;  // labels are outside SVG now
    const chartH = H - PT;
    const maxV   = Math.max(...vals) || 1;

    const toX = (i) => (series.length > 1 ? (i / (series.length - 1)) * W : W / 2).toFixed(1);
    const toY = (v) => (PT + chartH - (v / maxV) * chartH).toFixed(1);

    const linePts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
    const firstX  = toX(0);
    const lastXv  = toX(series.length - 1);
    const baseY   = (PT + chartH).toFixed(1);
    const areaPts = `${firstX},${baseY} ${linePts} ${lastXv},${baseY}`;

    // X-axis year labels as HTML (not inside SVG, so they don't stretch)
    let yearLabelHtml = "";
    let lastYear = null;
    series.forEach((s, i) => {
      if (s.year !== lastYear) {
        lastYear = s.year;
        const pct = series.length > 1 ? ((i / (series.length - 1)) * 100).toFixed(1) : "0";
        const shift = i === 0 ? "0" : i >= series.length - 2 ? "-100%" : "-50%";
        yearLabelHtml += `<span style="position:absolute;left:${pct}%;transform:translateX(${shift});font-size:6.5px;color:#506878;font-family:Exo 2,sans-serif;white-space:nowrap">${s.year}</span>`;
      }
    });

    const color  = "#4ecca3";
    const axisY  = (PT + chartH + 1).toFixed(1);
    const dotX   = toX(series.length - 1);
    const dotY   = toY(last.value);

    // Data SVG only — no text inside
    const chartSvg = `
      <svg viewBox="0 0 ${W} ${H}" class="energyde-svg" preserveAspectRatio="none" style="overflow:visible;width:100%;height:100%;display:block;">
        <defs>
          <linearGradient id="batfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="${axisY}" x2="${W}" y2="${axisY}" stroke="#2a3a48" stroke-width="0.5"/>
        <polygon points="${areaPts}" fill="url(#batfill)"/>
        <polyline points="${linePts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="${dotX}" cy="${dotY}" r="2.5" fill="${color}"/>
      </svg>
      <div style="position:relative;height:11px;margin-top:1px;">${yearLabelHtml}</div>`;

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon" style="color:${color}">⚡</span>
        <span class="energyde-label">${t.batteryLabel}</span>
      </div>
      <div class="energyde-big-number">${last.value.toFixed(2)} <span class="energyde-unit">${unit}</span></div>
      <div class="energyde-sub" style="margin-bottom:4px">${t.batterySub}</div>
      <div class="energyde-minichart energyde-minichart--xaxis">${chartSvg}</div>
      <div class="energyde-datasource">${t.batterySource}</div>
    `;
    return panel;
  },

  // ── EU Renewable Share Map tile ──────────────────────────────────────────
  // Choropleth: yesterday's renewable share per country (energy-charts API)
  // Mercator-projected SVG paths, colour-coded red→yellow→green
  _buildEuropeMapPanel(d, t) {
    const panel = this._createPanel("renewable");
    if (!d.europeRenShare || Object.keys(d.europeRenShare).length === 0) {
      panel.innerHTML = `<div class="energyde-loading">…</div>`;
      return panel;
    }
    const map = d.europeRenShare;

    // Colour: 0%=deep red, 50%=amber, 100%=bright green
    const pctColor = (pct) => {
      if (pct == null) return "#182530";
      const p = Math.max(0, Math.min(100, pct)) / 100;
      let r, g, b;
      if (p < 0.5) {
        const t = p / 0.5;
        r = Math.round(190 - t * 60);  g = Math.round(50  + t * 100); b = 35;
      } else {
        const t = (p - 0.5) / 0.5;
        r = Math.round(130 - t * 100); g = Math.round(150 + t * 55);  b = Math.round(35 + t * 40);
      }
      return `rgb(${r},${g},${b})`;
    };

    // Mercator-projected country paths (Natural Earth simplified, lon -12..35, lat 34.5..71.5)
    const PATHS = {
      "pt": "M16.0,223.0 L37.0,223.5 L31.9,234.8 L25.5,248.1 L19.1,248.6 L16.0,244.2 L17.2,235.8 Z",
      "es": "M17.2,213.5 L65.1,215.6 L97.7,220.9 L97.0,233.7 L77.9,243.2 L73.4,247.6 L63.8,249.5 L41.5,252.9 L35.1,247.1 L28.7,248.1 L21.1,243.2 L19.1,235.8 L22.3,224.0 L37.0,223.5 L16.0,223.0 Z",
      "fr": "M47.9,187.8 L65.1,198.7 L88.1,201.5 L96.4,215.6 L114.9,217.2 L124.5,214.0 L121.9,211.3 L120.0,202.0 L102.1,194.1 L92.6,184.3 L77.2,181.9 L65.1,186.6 L47.9,187.8 Z",
      "gb": "M40.2,177.7 L56.8,169.1 L76.0,169.7 L87.4,161.6 L79.8,154.5 L67.0,146.5 L63.8,139.6 L54.3,129.1 L47.9,121.8 L44.7,129.1 L51.1,146.5 L54.3,156.4 L47.9,168.5 L40.2,177.7 Z",
      "ie": "M12.8,169.1 L25.5,169.1 L38.3,166.0 L38.3,149.8 L25.5,143.1 L12.8,153.1 L12.8,169.1 Z",
      "nl": "M97.7,169.7 L105.3,169.1 L121.3,166.0 L122.6,157.7 L108.5,156.4 L102.1,160.3 L97.7,169.7 Z",
      "be": "M92.6,181.3 L117.4,181.3 L115.5,173.4 L107.9,169.1 L97.7,169.7 L92.6,173.4 L92.6,181.3 Z",
      "lu": "M113.0,181.9 L118.1,181.9 L118.1,177.1 L113.0,177.1 L113.0,181.9 Z",
      "de": "M115.5,172.2 L127.7,155.8 L140.4,145.8 L167.9,153.1 L172.3,171.6 L153.8,176.5 L159.6,193.0 L153.2,191.8 L143.6,197.0 L137.2,193.0 L124.5,192.4 L117.4,193.0 L115.5,173.4 L115.5,172.2 Z",
      "dk": "M128.3,147.1 L143.6,144.4 L157.7,140.3 L156.4,136.2 L143.6,129.1 L130.9,132.6 L128.3,136.2 L128.3,147.1 Z",
      "ch": "M114.3,201.5 L143.6,198.7 L143.6,193.6 L137.2,193.0 L130.9,191.3 L121.3,192.4 L114.3,198.7 L114.3,201.5 Z",
      "at": "M137.2,193.0 L153.8,191.8 L159.6,193.0 L172.3,190.1 L186.4,190.1 L186.4,194.7 L175.5,195.8 L166.0,199.2 L153.2,198.1 L143.6,197.0 L137.2,193.0 Z",
      "it": "M120.0,212.4 L164.0,213.5 L175.5,223.5 L178.7,233.2 L176.2,243.7 L156.4,245.6 L143.6,240.7 L137.2,229.2 L137.2,220.4 L137.2,212.4 L127.7,212.4 L124.5,213.5 L120.0,212.4 Z",
      "si": "M164.0,204.2 L181.9,198.7 L178.7,196.4 L172.3,195.3 L164.0,198.7 L164.0,204.2 Z",
      "hr": "M162.8,205.3 L185.1,202.6 L191.5,204.2 L197.9,207.0 L194.7,215.1 L188.3,217.7 L178.7,215.1 L162.8,205.3 Z",
      "ba": "M176.8,205.9 L199.1,207.0 L201.1,215.1 L194.7,220.4 L188.3,218.8 L176.8,205.9 Z",
      "rs": "M196.6,200.3 L213.8,200.3 L220.2,212.4 L217.0,221.4 L207.4,223.0 L201.1,215.1 L196.6,200.3 Z",
      "me": "M194.7,220.4 L201.1,215.1 L207.4,220.4 L204.3,224.0 L197.9,225.6 L194.7,220.4 Z",
      "al": "M200.4,223.0 L207.4,223.0 L207.4,228.7 L201.1,235.3 L197.9,233.2 L200.4,223.0 Z",
      "mk": "M207.4,220.4 L220.2,221.4 L217.0,228.2 L207.4,230.7 L207.4,220.4 Z",
      "gr": "M207.4,223.0 L220.2,221.4 L245.7,225.6 L242.6,233.2 L223.4,238.3 L217.0,248.1 L210.6,245.6 L217.0,240.7 L207.4,233.2 L207.4,223.0 Z",
      "bg": "M220.2,212.4 L255.3,214.0 L258.5,217.7 L252.1,228.2 L245.7,225.6 L220.2,221.4 L220.2,212.4 Z",
      "ro": "M220.2,190.1 L248.9,190.1 L268.1,201.5 L255.3,214.0 L220.2,212.4 L204.3,204.2 L220.2,195.8 L220.2,190.1 Z",
      "hu": "M180.0,190.1 L220.2,190.1 L220.2,195.8 L204.3,204.2 L181.9,198.7 L180.0,190.1 Z",
      "sk": "M186.4,190.1 L220.2,190.1 L220.2,181.3 L194.7,181.3 L186.4,190.1 Z",
      "cz": "M153.8,172.2 L172.3,171.6 L194.7,181.3 L186.4,190.1 L172.3,190.1 L153.8,176.5 L153.8,172.2 Z",
      "pl": "M167.9,153.1 L229.8,149.8 L226.6,166.0 L229.8,175.3 L220.2,181.3 L194.7,181.3 L172.3,171.6 L153.8,172.2 L167.9,153.1 Z",
      "ee": "M213.8,129.1 L255.3,129.1 L255.3,114.2 L223.4,114.2 L213.8,129.1 Z",
      "lv": "M210.6,139.6 L213.8,129.1 L255.3,129.1 L255.3,139.6 L210.6,139.6 Z",
      "lt": "M210.6,153.1 L245.7,153.1 L245.7,139.6 L210.6,139.6 L210.6,153.1 Z",
      "fi": "M201.1,110.4 L268.1,102.5 L261.7,28.7 L236.2,63.8 L217.0,68.4 L204.3,81.7 L201.1,110.4 Z",
      "se": "M146.8,143.1 L169.1,143.1 L194.7,121.8 L201.1,110.4 L191.5,86.0 L178.7,59.0 L185.1,34.0 L217.0,39.2 L217.0,68.4 L204.3,81.7 L201.1,110.4 L191.5,129.1 L146.8,143.1 Z",
      "no": "M105.3,125.4 L127.7,129.1 L128.3,121.8 L146.8,118.0 L146.8,86.0 L166.0,63.8 L178.7,23.2 L204.3,11.9 L252.1,17.6 L236.2,63.8 L217.0,68.4 L185.1,34.0 L178.7,59.0 L169.1,86.0 L156.4,98.5 L146.8,118.0 L111.7,118.0 L105.3,125.4 Z"
    };

    let svgPaths = "";
    for (const [cc, pathD] of Object.entries(PATHS)) {
      const pct    = map[cc];
      const fill   = pctColor(pct);
      const isDE   = cc === "de";
      const stroke = isDE ? "#ffffff" : "#0d1a26";
      const sw     = isDE ? "1.8" : "0.4";
      const lbl    = pct != null ? `${cc.toUpperCase()}: ${pct}%` : cc.toUpperCase();
      svgPaths += `<path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"><title>${lbl}</title></path>`;
    }

    // Stats
    const vals  = Object.values(map).filter((v) => v != null);
    const euAvg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    const deVal = map["de"] != null ? `${map["de"]}%` : "–";

    // Gradient legend
    const legend = `
      <svg viewBox="0 0 130 14" width="130" height="14" style="display:block;margin:2px auto 0">
        <defs>
          <linearGradient id="euleg2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="rgb(190,50,35)"/>
            <stop offset="50%"  stop-color="rgb(130,150,35)"/>
            <stop offset="100%" stop-color="rgb(30,205,75)"/>
          </linearGradient>
        </defs>
        <rect x="8" y="2" width="114" height="6" rx="2" fill="url(#euleg2)"/>
        <text x="8"   y="13" font-family="Exo 2,sans-serif" font-size="5.5" fill="#7a9ab0">0%</text>
        <text x="65"  y="13" font-family="Exo 2,sans-serif" font-size="5.5" fill="#7a9ab0" text-anchor="middle">50%</text>
        <text x="122" y="13" font-family="Exo 2,sans-serif" font-size="5.5" fill="#7a9ab0" text-anchor="end">100%</text>
      </svg>`;

    panel.innerHTML = `
      <div class="energyde-panel-header">
        <span class="energyde-icon energyde-icon--renewable">🌍</span>
        <span class="energyde-label">${t.euMapLabel}</span>
      </div>
      <div class="energyde-sub" style="margin-bottom:1px">${t.euMapSub} · <span style="color:#4ecf90">DE ${deVal}</span> · <span style="color:#7a9ab0">Ø ${euAvg}%</span></div>
      <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:1px 0">
        <svg viewBox="0 0 300 260" style="width:100%;height:100%;max-height:155px;overflow:visible">${svgPaths}</svg>
      </div>
      ${legend}
    `;
    return panel;
  },

  getStyles()  { return ["MMM-REnergy.css"]; },
  getScripts() { return []; },
  getHeader () {
    const lang = (this.config.language === "en") ? "en" : "de";
    return this._i18n[lang].title;
  },
});
