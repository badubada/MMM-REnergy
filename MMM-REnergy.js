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

    // Natural Earth 50m — Mercator projection — lon[-25..35.5] lat[33.5..72] → 500×440
    const PATHS = {
      "al": "M366.5,373.4 L366.5,373 L366.6,372.3 L366.5,372.1 L366.6,371.7 L366.4,371.2 L366,370.8 L366.4,370.2 L366.9,369.4 L367.5,368.8 L368.1,368.1 L368.6,367.5 L369,366.9 L369.5,366.8 L369.6,366.9 L369.8,367.1 L369.7,367.8 L369.9,368.1 L370.1,368.2 L370.7,368.2 L371.4,368 L372.3,367.6 L372.4,367.6 L372.8,367.8 L373.4,368.7 L373.9,369.4 L374.8,369.7 L375.3,369.9 L375.9,370.4 L376.2,370.8 L376.7,372.2 L376.7,373 L376.6,373.4 L376.5,373.4 L376.1,374.8 L376.2,375.4 L376.2,375.9 L375.8,376 L375.6,376.3 L376,377.4 L375.9,377.9 L375.9,378.4 L376.6,379.6 L377,380 L377.3,380.2 L377.8,381.3 L378,381.5 L379.1,381.4 L379.6,381.5 L379.8,381.7 L379.9,381.9 L379.8,382.5 L380.1,383 L380.4,383.5 L380.4,383.8 L380.2,384.3 L379.8,384.9 L379.2,385.1 L378.6,385.3 L378.3,385.7 L378.1,386.2 L377.8,386.5 L377.7,386.9 L377.4,387.7 L377.3,388 L376.9,388.3 L376.2,388.4 L375.7,388.4 L375.3,388.5 L375.1,388.8 L374.7,389 L374.5,389.1 L374.5,389.3 L374.8,389.8 L375.1,390.2 L375.1,390.6 L374.9,390.7 L374.4,390.6 L374.3,390.7 L374.3,391.1 L374.2,391.4 L374,391.6 L373.6,391.8 L373,391.7 L372.4,391.4 L372.1,391.3 L371.9,391.3 L371.9,390.6 L371.6,390 L370.7,388.6 L367.6,387.2 L366.9,386.6 L366.6,386.1 L366.3,385.6 L366.6,385.6 L366.9,385.7 L367.3,385.9 L367.4,385.6 L367.3,385.1 L366.5,383.8 L366.4,383.5 L366.8,382.4 L367.4,381.2 L367.4,379.8 L367.6,378.7 L367.4,378 L367.3,377.1 L367.7,376 L368.2,375.7 L368.4,375.3 L368.4,374.1 L367.5,373.5 L366.5,373.4 Z",
      "at": "M285.4,325.7 L286,324.5 L286.2,323.9 L285.6,323.4 L285.3,323.3 L285.5,323.2 L286.4,323.3 L286.9,323.1 L287.2,322.8 L287.9,323.1 L289,323.5 L289.5,323.8 L289.8,324 L289.9,324.2 L289.8,324.5 L290.1,324.7 L290.6,324.7 L290.9,324.8 L290.8,325.2 L290.8,325.6 L291.2,325.5 L291.8,325.3 L292.3,324.8 L292.6,324.3 L292.8,323.2 L292.9,323.1 L293.2,323.2 L294.7,323.1 L295.4,323.3 L296.5,323.4 L296.4,323.5 L296.7,323.8 L297.1,324.2 L297.4,324.5 L297.9,324.5 L298.7,324.4 L299.1,324.2 L299.3,324.3 L300,324.2 L300.6,323.9 L300.8,323.7 L301.4,323.5 L302.3,323.1 L303.4,322.8 L307.3,322.4 L307.5,322.2 L307.4,321.6 L307.5,321.5 L308,321.7 L308.8,321.8 L309.4,322 L309.8,322.3 L310.1,322.3 L310.7,322.1 L311.4,322 L312.2,322.2 L312.4,322.5 L312.2,322.7 L312.2,322.9 L312.5,323.1 L313.1,323.5 L313.8,323.8 L314.2,323.7 L314.3,323.5 L314.4,322.8 L314.5,322.1 L314.3,321.7 L313.9,321.6 L313.5,321.6 L313.2,321.5 L313.3,321.2 L313.7,320.7 L313.7,319.9 L312.8,319 L312.1,318.2 L312.1,317.9 L312.5,317.4 L313.2,316.9 L314.7,316.3 L315.2,316.1 L315.8,316 L316.7,315.7 L317.2,315.5 L317.4,315.2 L317.8,313.5 L318,313.5 L318.1,313.4 L319.6,313.9 L319.8,313.8 L320,313.7 L320.5,313.3 L320.6,313 L320.6,312.4 L320.7,311.8 L320.8,311.6 L321,311.7 L321.7,312 L322.2,312.3 L322.7,313.2 L323.9,313.4 L325.3,313.4 L325.9,313 L326.3,312.9 L326.9,313.1 L328,313.2 L328.2,312.5 L328.8,311.8 L329.1,311.5 L329.9,311.6 L330.2,311 L330.3,309.5 L330.5,309.4 L331.1,309.4 L331.7,309.7 L331.9,309.9 L332.2,309.9 L332.7,309.7 L333.1,309.6 L333.9,309.8 L335.5,310.5 L336.4,310.7 L336.9,310.7 L337.4,310.7 L339.3,311.7 L340.7,311.9 L341.9,311.9 L342.3,311.6 L342.8,311.3 L343.3,311.3 L343.8,311.5 L344.7,311.9 L345.2,312 L345.7,312.1 L346.1,312.2 L346.5,313 L346.7,313.2 L346.7,313.3 L346.6,313.7 L346.3,314.1 L346,314.7 L346,315.2 L346.9,317 L347.7,318.1 L347.8,318.5 L348.3,318.8 L347.8,319.2 L347.7,319.8 L347.4,320.1 L347.4,320.4 L347.5,320.7 L347.5,321.1 L347.7,321.6 L346.9,321.7 L346,321.7 L345.7,321.7 L345.3,321.9 L345,321.8 L344.2,321.3 L343.7,321.2 L343.4,321.2 L343.2,321.4 L342.7,321.7 L342.3,321.9 L342.4,322.1 L344.1,322.5 L344.4,323.2 L344.1,323.8 L344,324 L343.6,324.2 L343.1,324.4 L342.5,324.5 L342.4,324.8 L342.7,325.6 L342.5,325.8 L342.3,326.1 L342.5,326.8 L342.8,326.9 L342.9,327 L342.9,327.3 L342.8,327.6 L342.7,328 L342.6,328.1 L342.4,328.2 L341.6,328.1 L340.9,328.4 L339.6,329.4 L339.1,329.6 L338.6,330 L338.7,330.9 L338.6,331 L338.5,331.1 L336.9,330.8 L336.9,330.8 L335.8,330.9 L335.1,331.4 L334.2,331.6 L332.4,331.4 L330.6,331.6 L330.2,331.7 L329.7,331.8 L329.3,332 L329,332.4 L328.6,332.8 L327.9,333.1 L327.2,333.3 L327.1,333.6 L326.9,333.7 L326.5,333.5 L326.2,333.5 L325.8,333.4 L324.5,333.3 L323.1,333.1 L322.5,332.9 L321.7,332.8 L320.9,332.7 L320.2,332.6 L319.8,332.6 L318.1,332.3 L316.9,332.2 L315.4,332.1 L312.5,331.6 L311.6,331.4 L310.7,331.4 L309.7,331.2 L309,330.9 L308.5,330.4 L308,329.7 L307.1,328.8 L306.9,328.3 L307.2,327.9 L307.5,327.6 L307.4,327.5 L307.2,327.4 L305.5,327.8 L303.9,328.3 L303.3,328.3 L302.7,328.2 L301.9,328.2 L301.1,328.3 L299.5,328.4 L298.6,328.8 L298.1,329.5 L297.7,330 L297.5,330.2 L296.9,330.3 L296.1,330.2 L295.5,330.1 L295,329.6 L294,329.5 L293.2,329.5 L293,329.4 L293,329.1 L292.7,328.5 L292.1,328.3 L290.7,329.4 L290.3,329.5 L289.2,329.2 L288.2,328.8 L288.1,328.4 L288,328.1 L287.1,327.8 L286.1,327.6 L285.8,327.6 L285.9,327.5 L286,327.2 L285.9,327 L285.7,326.7 L285.6,326.5 L285.6,326.2 L285.5,326 L285.4,325.8 L285.4,325.7 Z",
      "ba": "M365.2,359.2 L365,359.1 L364.6,359.2 L364.3,359.3 L363.9,359.2 L363.4,359.1 L363.2,359.2 L363.2,359.5 L363.4,359.9 L363.9,360.7 L363.9,361.2 L363.5,361.3 L363.1,360.8 L362.8,360.7 L362.4,360.8 L361.6,361.3 L361,361.8 L360.8,362.1 L360.6,362.4 L360.5,362.7 L360.5,363.5 L359.4,363.7 L359.2,363.8 L359,364 L359.1,365.1 L359.2,365.7 L359.9,366.6 L359.9,366.8 L359.8,367 L359.3,367.4 L359.1,367.5 L359,367.5 L358.2,367.3 L357.9,367.2 L356.4,366.4 L355.7,366 L354.7,365.4 L354,365.1 L353.7,364.6 L353.2,364.5 L352.6,364.6 L351.9,364.3 L352.4,364.1 L352.5,363.9 L352.5,363.7 L352.3,363.4 L350.4,362 L349.5,361.1 L349.4,360.8 L349.4,359.9 L349.2,359.7 L347.8,359.3 L346.3,358.1 L344.7,357 L344.5,356.7 L343.7,355.8 L342.7,355.1 L342,354.6 L341.3,354 L340.6,353.2 L340.2,352 L339.9,350.9 L339.7,350.5 L339.3,350.4 L337.9,349.1 L336.7,348.4 L336.7,347.5 L336.9,346.2 L337.1,344.7 L337.4,344.5 L337.9,344.3 L338.5,344.4 L339.1,344.6 L340.2,345.6 L340.8,346 L341.3,346.2 L341.9,345.8 L342.6,344.8 L343.2,344.3 L345.4,344.5 L346.4,343.8 L348.2,344.7 L348.8,344.9 L349.3,344.8 L349.8,344.8 L351,345.1 L351.3,345.2 L351.6,345.2 L352.5,344.8 L352.8,344.9 L353.8,345.6 L354.3,345.6 L354.9,345.3 L355.3,345 L356.5,345.2 L357.2,345.1 L357.7,345.1 L358.3,345.2 L358.9,345.4 L359.4,345.5 L360.9,345.6 L361.5,346 L361.8,346.5 L361.8,346.7 L361.9,347 L362.3,347.3 L363.2,347.5 L363.7,347.4 L364,347.4 L364.7,347.2 L365.6,347 L366.2,347.2 L366.5,347.3 L366.6,347.5 L366.4,348.2 L366,349 L365.5,349.7 L364.9,350.5 L364.7,350.8 L364.7,351.5 L364.6,351.9 L364.7,352.2 L364.9,352.4 L365.6,352.6 L366.4,353.1 L367.2,353.7 L368.2,354.4 L368.4,354.7 L368.4,355 L368.2,355.2 L367.3,355.3 L366.5,355.2 L366.2,355.2 L365.9,355.2 L365.7,355.4 L365.8,355.6 L366.6,356.4 L367.7,357.7 L367.7,358.2 L367.6,358.6 L367.4,358.9 L366.9,358.9 L366.6,358.6 L366.1,358.6 L365.7,358.7 L365.2,359.2 Z",
      "be": "M241.5,285.9 L242.2,286.2 L242.7,286.2 L243,286.1 L242.8,285.5 L243.3,285.2 L243.8,285 L244.1,285.3 L244.5,285.6 L244.9,285.6 L245.9,284.9 L246.1,285 L246.4,285.3 L246.4,285.5 L246.5,285.7 L246.7,285.8 L247.5,285.7 L247.9,285.3 L248.2,285.1 L248.4,285.3 L248.5,285.7 L248.8,286.3 L249.7,287 L250.5,287.2 L251.5,287.1 L251.9,287 L252.1,287.1 L252.4,287.4 L253,287.8 L254.1,288.1 L254.5,288.3 L254.8,288.6 L254.7,289 L254.1,289.9 L254.1,290.2 L254.1,290.3 L254,290.5 L253.3,291.1 L253.2,291.4 L253.5,291.7 L253.7,292.1 L254.1,292.2 L254.5,292.3 L255.3,292.3 L256.1,292.3 L256.3,292.5 L257.2,293 L257.5,293.4 L258.2,293.8 L257.6,294.3 L257.7,294.6 L257.9,294.8 L258.6,294.9 L259,295.3 L259.1,295.8 L259.2,296.6 L257.7,297.4 L257.2,298.3 L257.2,298.5 L257.1,298.5 L256.9,298.2 L256.6,298.2 L256,298.1 L255.1,298.9 L254.7,299.6 L254.4,300.1 L254.1,300.5 L254,300.9 L254.1,301.1 L253.9,301.3 L253.9,301.6 L254.4,302 L254.6,302.3 L255.2,303.2 L255,303.5 L254.9,303.8 L254.7,304 L254.5,304.2 L253.8,304.2 L253,304.3 L252.4,304.5 L252.1,304.5 L251.5,304 L250.9,303.4 L250.4,303.1 L250.2,302.8 L249.7,302.7 L249,302.4 L248.4,302.1 L248,301.9 L247.4,301.8 L246.9,301.8 L246.7,301.2 L246.6,300.5 L246.2,300.1 L246.8,298.4 L246.4,298.2 L246,298.3 L245.5,298.8 L245.2,299.2 L245.1,299.7 L244.2,300.1 L242.7,300.2 L241.1,300.1 L240.9,300 L240.8,299.9 L240.8,299.7 L240.9,299.5 L241.2,299.2 L241.3,298.8 L241,298.4 L240.8,298.3 L240.9,298 L241.1,297.5 L241.1,297.3 L240,296.5 L239.3,296.4 L238.5,296.4 L237.9,296.3 L237.6,296.3 L237.4,296.5 L237.1,296.7 L236.9,296.5 L236.6,295.2 L236.3,295 L235.3,294.8 L234,294.7 L233.7,294.5 L233.5,293.9 L233.3,293.2 L232.9,292.5 L232.7,292.3 L232.3,292 L231.6,292.1 L230.8,292.5 L230.3,292.6 L230.1,292.7 L229.4,292.3 L228.7,291.7 L228.1,291.1 L227.9,290.7 L228.1,290.3 L227.9,289.9 L227.6,289.3 L227.5,288.8 L231.1,287.2 L233.3,286.3 L234.3,286 L234.5,286.9 L234.7,287.2 L235,287.4 L235.3,287.4 L235.7,287.2 L236.2,287 L237,287.1 L237.7,287.3 L237.9,287.5 L238.3,287.7 L238.8,287.7 L240,287.3 L241.1,286.7 L241.4,286.3 L241.5,285.9 Z",
      "bg": "M438.1,372.5 L437,372.4 L436.6,372.4 L436.4,372.7 L435.9,372.6 L435.2,372.6 L434.6,372.9 L434.2,372.9 L433.7,372.7 L432.7,372.1 L432.2,371.6 L431.8,371.5 L431.3,371.6 L429.9,371.8 L429.5,372 L428.8,372.4 L428.1,372.5 L427.1,372.6 L426.6,372.6 L426.3,372.7 L426,373.1 L425.9,373.6 L425.7,373.8 L424.5,374 L424.2,374.2 L424.1,374.4 L424.1,374.7 L423.1,374.4 L422.4,374.6 L422.2,374.8 L422,375 L422.1,375.3 L422.4,375.6 L422.7,376.3 L422.8,377 L422.6,377.5 L422,377.7 L420.8,378.1 L419.7,377.9 L419.2,378 L418.4,378.1 L417.6,378.2 L416.4,378.5 L415.3,378.6 L414.3,378 L413.2,377.6 L411.9,377.4 L411.5,377.6 L411.4,377.7 L410.3,377.2 L409.9,377 L409.7,376.8 L409.2,376.1 L409,376 L408.2,376.3 L407.4,376.3 L406.9,376.2 L405.4,376.3 L405.2,376.8 L405,376.8 L404.7,376.9 L404,376.9 L403,377.2 L402,377.4 L401.1,377.5 L400.3,377.3 L399.8,377.4 L398.7,377.5 L398,378 L396.9,378 L396,377.9 L396.1,377.7 L396.3,375.6 L396.7,374.7 L396.7,374.5 L396.6,374.3 L396.2,374.2 L395.9,373.7 L395.3,372.3 L395,372.1 L394.1,371.8 L393.2,371.4 L392.5,370.9 L391.3,369.6 L391.9,369.5 L392.1,369.2 L392.8,368.5 L392.8,368.2 L392.8,368 L392.3,367.7 L392,366.9 L392.3,366.2 L392.3,365.9 L392.1,365.5 L392.3,365.1 L392.8,364.9 L393.1,364.8 L394.3,364.8 L395,363.9 L395.5,363.6 L396,363.1 L396.2,362.9 L396.4,362.5 L396.5,362.1 L395.5,361.6 L395.2,361.2 L394.8,360.7 L394.2,360.4 L393,359.8 L392.5,359.3 L392.3,358.6 L392,358 L391.7,357.6 L391.6,357.3 L391.5,357 L391.4,356.3 L391.7,355.3 L391.9,355 L392.3,354.9 L393.4,354.4 L393.4,353.8 L393.6,353.4 L393.9,353.2 L394.2,353 L394.8,353.4 L396.2,354 L396.9,354.4 L396.9,354.7 L396.6,354.9 L396,355.2 L395.6,355.5 L395.5,356 L395.6,356.3 L396,356.5 L398.6,356.2 L401.1,356.4 L404.5,357 L406.8,357.2 L408.5,356.9 L411.6,357.4 L414.5,357.8 L417.3,358 L418.9,357.6 L420,357.1 L420.9,356.2 L423.3,355 L425.5,354.3 L428.5,353.8 L430.5,353.6 L430.8,353.8 L433.3,354.9 L434.4,354.9 L435.3,355.1 L435.6,355.4 L435.9,355.5 L437.1,355.2 L437.6,355.8 L438.4,356.6 L439.9,357.1 L441.1,357.3 L441.5,357.3 L442.9,357.3 L442.7,359.4 L441.8,360.4 L440.7,360.1 L439.1,360.3 L438.3,361.4 L437.8,361.8 L437.4,362.2 L437.1,363.6 L437.1,365.9 L436.5,366.2 L436,366.3 L433.8,368.3 L435,368.9 L435.6,369.3 L436.6,370.5 L437.9,371.9 L438.1,372.5 Z",
      "ch": "M285.3,323.3 L285.6,323.4 L286.2,323.9 L286,324.5 L285.4,325.7 L285,326.6 L285,327.3 L285,327.6 L285.1,327.6 L285.8,327.6 L286.1,327.6 L287.1,327.8 L288,328.1 L288.1,328.4 L288.2,328.8 L289.2,329.2 L290.3,329.5 L290.7,329.4 L292.1,328.3 L292.7,328.5 L293,329.1 L293,329.4 L292.6,330.6 L292.6,331.3 L292.9,331.7 L292.9,332 L292.8,332.3 L292.3,332.3 L291.5,332.2 L290.9,331.7 L290.4,331.7 L290,331.8 L289.8,332.3 L289.6,332.9 L289.6,333.2 L289.9,333.5 L290.2,334 L290.3,334.7 L290.5,335 L290.3,335.1 L289.9,335.2 L289.6,335.2 L289,334.3 L288.7,334 L288.3,334 L287.5,334.2 L286.3,334.6 L285.8,334.6 L285.4,334.5 L285,334.1 L284.6,333.4 L284.5,332.9 L284.3,332.9 L283.5,332.8 L283.1,333 L283.1,333.7 L283.1,334.7 L282.7,335.3 L281.6,336.4 L281.2,336.8 L281,337.2 L281,337.5 L281.2,338 L281.4,338.4 L281.2,338.7 L280.6,338.8 L280.2,338.5 L280.1,338 L279.2,337.3 L279.5,336.8 L279.5,336.6 L278,336.3 L277.4,335.9 L276.5,335.1 L276.3,334.7 L276.4,333.7 L276.3,333.4 L276.2,333.3 L275.8,333.3 L275.2,333.6 L274.6,334.2 L273.5,334.9 L273.4,335 L273.8,335.6 L273.7,335.8 L272.9,336.8 L272.7,337.2 L271.5,337.8 L271,338 L269.4,337.6 L268.9,337.5 L268.2,337.8 L267.2,338.1 L265.5,338.4 L264.9,338.2 L264.6,338 L264.5,337.7 L264.1,337.2 L263.6,336.8 L263.3,336.5 L262.9,336.1 L262.6,335.8 L262.9,334.8 L262.7,334.5 L262.5,334 L262.6,333.6 L262.5,333.5 L261,333.3 L259.7,333.4 L258.9,333.7 L258.1,334.3 L258,334.4 L258.1,334.5 L258.5,335 L257.9,335.6 L256.9,336 L256.3,336 L256,335.9 L256,335.4 L256.5,335.2 L257,334.8 L257.1,334.2 L257.2,333.9 L256.7,333.4 L256.8,333.1 L257.1,332.6 L257.3,332.1 L257.5,331.7 L258.5,331.1 L259.6,330.4 L259.7,329.7 L259.8,328.8 L260,328.6 L261.4,328.1 L261.7,327.9 L261.9,327.6 L263,326.7 L264.1,325.7 L264.3,325.4 L264.5,325.2 L264.5,325 L264.3,324.9 L263.8,324.8 L263.6,324.5 L264.2,324 L264.9,323.6 L265.6,323.6 L265.9,323.8 L265.8,324 L266.1,324.2 L266.7,324.2 L267.3,324.2 L267.9,323.9 L268.3,323.5 L268.5,323.1 L269.6,322.7 L270.2,322.9 L272.1,322.9 L273.5,322.8 L274.4,322.5 L275.4,322.5 L276.2,322.7 L276.3,322.7 L276.5,322.6 L276.7,322.5 L277.3,322.4 L277.4,322.3 L277.4,322.1 L277.3,322.1 L276.5,322.1 L276.1,322 L276.1,321.8 L276.3,321.4 L276.9,321.1 L277.5,321 L277.8,321.1 L278.7,321.7 L279,321.7 L279.1,321.6 L279.3,321.5 L279.6,321.6 L279.9,322 L280,322.1 L282,321.9 L282.5,321.9 L283.9,322.6 L285.3,323.3 Z",
      "cz": "M362.3,304.5 L362.1,304.5 L361.6,304.6 L361,304.7 L360.3,304.7 L359.8,304.9 L359.3,305.3 L358.8,305.6 L358.5,305.9 L358.4,306.1 L356.7,306.9 L356.5,307.2 L356.3,307.7 L356.2,308.2 L356.1,308.8 L355.8,309 L354.9,309.3 L354.6,309.4 L354.5,309.7 L354,310.1 L353.4,310.4 L352.3,310.9 L351.1,311 L349.6,310.9 L348.7,310.7 L348.2,310.9 L347.6,311.5 L347,312.5 L346.7,313.2 L346.5,313 L346.1,312.2 L345.7,312.1 L345.2,312 L344.7,311.9 L343.8,311.5 L343.3,311.3 L342.8,311.3 L342.3,311.6 L341.9,311.9 L340.7,311.9 L339.3,311.7 L337.4,310.7 L336.9,310.7 L336.4,310.7 L335.5,310.5 L333.9,309.8 L333.1,309.6 L332.7,309.7 L332.2,309.9 L331.9,309.9 L331.7,309.7 L331.1,309.4 L330.5,309.4 L330.3,309.5 L330.2,311 L329.9,311.6 L329.1,311.5 L328.8,311.8 L328.2,312.5 L328,313.2 L326.9,313.1 L326.3,312.9 L325.9,313 L325.3,313.4 L323.9,313.4 L322.7,313.2 L322.2,312.3 L321.7,312 L321,311.7 L320.8,311.6 L320.4,311.1 L319.7,310.6 L318.6,309.8 L317.7,309.8 L317.4,309.6 L317.2,309.3 L316.9,308.8 L316.4,308.4 L315.9,308.3 L315.2,307.9 L314.2,306.9 L313.3,306.2 L312.5,306.2 L312,305.9 L311.4,305.4 L311,304.9 L310.4,303.8 L309.9,303.2 L309.6,302.8 L309.2,302.5 L309,302.2 L309.5,301.7 L309.7,301.3 L309.9,301.1 L310,300.9 L310,300.7 L309.6,300.1 L309,299.7 L308.1,299.3 L307.5,298.7 L307.3,298.2 L307.2,298 L306.8,297.6 L306.5,297.1 L306.5,296.7 L306.6,296.6 L306.9,296.6 L307.2,296.9 L307.7,297.3 L308.1,297.9 L308.3,297.7 L308.7,297 L309.5,296.3 L310.3,295.8 L311,295.8 L311.6,295.7 L312.1,295.5 L313,295.5 L313.6,295.7 L313.8,295.6 L314,295.2 L314.2,294.9 L315.5,294.7 L316,294 L316.3,294 L316.6,293.9 L316.9,293.7 L317.2,293.6 L317.4,293.7 L317.7,293.8 L318,293.6 L318.4,292.9 L318.6,292.8 L319.8,292.6 L321.5,292.2 L322.3,291.8 L323.1,291.6 L324,291.2 L325.4,290.8 L325.4,290.7 L324.8,290.3 L324.6,290 L324.4,289.8 L324.7,289.5 L325,289.4 L325.3,289.5 L326.5,289.7 L326.8,289.9 L326.9,290.3 L327.2,290.6 L327.5,290.7 L327.4,291.3 L327.7,291.5 L328.3,291.7 L328.6,291.6 L328.9,291.4 L329,291.2 L329.7,291.2 L330.4,290.9 L330.5,290.5 L330.5,289.8 L330.5,289.7 L331.6,289.9 L332.7,290.2 L332.9,291 L333.2,291.3 L333.5,291.7 L333.8,291.8 L334.4,291.9 L335.9,292.3 L336.6,292.4 L337.4,292.7 L338,293 L338.4,293.1 L338.6,293.4 L338.9,293.7 L339.4,293.5 L341.2,293.2 L341.8,293.6 L342.2,293.9 L342.3,294.1 L342.1,294.4 L342,294.6 L341.8,294.8 L341.2,294.9 L340.8,295.2 L340.6,295.5 L340.8,295.8 L341.3,296 L341.6,296.1 L341.7,296.3 L342.9,297.3 L343.8,298.5 L344.1,298.7 L344.5,298.7 L344.8,298.6 L345.3,298.2 L345.8,297.9 L346.3,297.7 L347,297.4 L347.1,297.2 L346.4,296.3 L346,295.6 L346.1,295.5 L346.9,295.6 L348.4,296 L350.5,297.2 L350.9,297.2 L351.7,297.1 L352.5,296.9 L352.9,296.7 L353.1,296.8 L353.2,297.4 L353,297.8 L352,298.2 L352,298.3 L352.3,298.6 L352.7,298.7 L353.3,299.1 L353.7,299.6 L354,299.9 L354.3,300 L355.2,299.7 L355.5,299.5 L355.6,299.3 L355.8,299.4 L356.1,299.6 L356.2,299.8 L357.1,300 L357.6,300.4 L357.9,300.5 L358.2,300.4 L359.6,300.7 L360,300.9 L360.1,301.2 L360.1,301.5 L360.3,302.1 L362.1,303.5 L362.2,304.2 L362.3,304.5 Z",
      "de": "M285.3,323.3 L283.9,322.6 L282.5,321.9 L282,321.9 L280,322.1 L279.9,322 L279.6,321.6 L279.3,321.5 L279.1,321.6 L279,321.7 L278.7,321.7 L277.8,321.1 L277.5,321 L276.9,321.1 L276.3,321.4 L276.1,321.8 L276.1,322 L276.5,322.1 L277.3,322.1 L277.4,322.1 L277.4,322.3 L277.3,322.4 L276.7,322.5 L276.5,322.6 L276.3,322.7 L276.2,322.7 L275.4,322.5 L274.4,322.5 L273.5,322.8 L272.1,322.9 L270.2,322.9 L269.6,322.7 L269.1,322.5 L268.8,321.9 L268.9,321 L269.4,319.8 L269.5,318.8 L269.3,318.3 L269.6,317.4 L270.3,316.2 L270.8,315 L271,313.7 L271.4,312.8 L272.1,312.3 L273.7,310.6 L273.9,310.5 L273.8,309.6 L273.4,309.5 L272.7,309.3 L271.1,309 L269.5,308.8 L268.8,308.6 L268.2,307.9 L267.8,307.9 L267.1,308.1 L266.1,308.3 L265.4,308.2 L265,308.2 L264.8,308.3 L264.6,308.2 L264.5,307.7 L264.1,307.5 L263.6,307.4 L263.2,307.4 L263,307.7 L262.6,307.9 L262.3,307.8 L261.2,306.6 L261,306.3 L260.9,306 L260.6,305.6 L260,305.1 L259.3,305 L259.1,305 L259.1,304.4 L259.3,303.6 L259.6,303.2 L259.9,302.8 L260.2,302.5 L260.3,302.1 L260.2,301.7 L259.9,301.6 L258.9,301.3 L258.3,300.9 L257.9,300.5 L257.4,299.9 L257.1,299.4 L257.1,298.8 L257.2,298.5 L257.2,298.3 L257.7,297.4 L259.2,296.6 L259.1,295.8 L259,295.3 L258.6,294.9 L257.9,294.8 L257.7,294.6 L257.6,294.3 L258.2,293.8 L257.5,293.4 L257.2,293 L256.3,292.5 L256.1,292.3 L256.6,290.8 L256.3,290.3 L255.8,290.1 L255.3,290 L255.1,289.8 L255,289.5 L255.1,289.4 L255.7,289.4 L255.9,289.2 L257.3,288.3 L257.3,288.2 L257.1,288.1 L256.9,288 L256.8,287.8 L256.8,287.6 L257.6,286.3 L257.8,285.7 L257.8,285.3 L257.8,284.9 L257.4,284.3 L256.9,283.8 L256.9,283.4 L256.6,283.2 L255.8,282.1 L255.8,281.7 L256.3,281.4 L256.9,281.2 L257.2,281 L257.6,280.9 L258.7,281.2 L259.1,281.5 L259.3,281.4 L259.7,281.2 L260.5,281.2 L262.3,280.6 L262.6,280.3 L262.8,280 L262.8,279.9 L262.1,279.4 L262.1,279.1 L262.2,278.9 L262.4,278.7 L262.8,278.6 L263.3,278.3 L264.3,277.6 L264.6,277 L264.7,276.3 L264.8,275.8 L264.5,275.4 L264.2,275.2 L263.8,275.2 L263.1,275.2 L262.4,274.9 L262,274.6 L261.9,274.3 L262.1,274.1 L262.1,273.8 L262,273.6 L262.1,273.4 L262.4,273.2 L264.6,273.2 L264.7,273 L264.9,272 L265.4,270.6 L266,269.7 L266,269.4 L266,267.4 L266.1,266.4 L265.7,266 L264.9,265.4 L265.1,264.4 L265.4,263.5 L266.2,262.5 L266.8,262.2 L269.7,262 L272.8,262.1 L274.1,263.7 L273.6,264.5 L274.4,264.8 L274.8,264.7 L275,264 L275.2,263.2 L275.5,263 L276.5,263.6 L276.8,264 L276.8,265.2 L277.2,263.5 L276.9,262.3 L277.1,261.2 L277.5,260.5 L277.9,260.1 L280.1,260.6 L282.7,260.3 L283.7,260.8 L285.8,263.1 L286.5,263.4 L287.5,263.6 L286.2,263.1 L283.6,260.3 L282.8,260 L281.6,259.9 L280.8,259.6 L280.3,259.2 L280.2,258.8 L280.2,256 L279.8,255.6 L279.2,255.5 L278.8,255.6 L278.1,255.7 L277.9,255 L278.1,254.5 L279.6,254.2 L280.6,253.8 L280.7,253 L280,252.4 L279.3,251.3 L278.4,250.3 L278.3,249 L279.8,249.1 L280.2,249.1 L282.5,249.7 L283.1,250.1 L283.8,250.1 L285.1,249.7 L286.1,249.6 L286.5,249.8 L287,249.9 L287.1,249.9 L287.2,250.1 L288.4,250.4 L288.9,250.8 L289.4,251.5 L289.5,252.6 L288.8,253.3 L288.2,253.7 L290.4,253.6 L290.7,254 L291,254.4 L292.2,254.1 L295.3,255.4 L297.2,254.8 L297.6,254.7 L298.1,255.8 L297.6,256.9 L295.9,258 L296.3,258.7 L296.8,258.9 L298.4,258.7 L300.8,259.4 L301.3,259.2 L303.3,257.6 L304.1,257.3 L306.7,257 L307.2,256.4 L308.2,255.8 L308.9,255.1 L310.6,253.8 L312.2,254 L313.2,254.3 L314.3,254.4 L315.3,255.8 L317.8,257.3 L320,257.2 L320.8,258.6 L321.2,260.4 L321.9,260.9 L322.5,261.3 L324.4,261.7 L324.4,261.7 L324.5,261.9 L324.6,262.8 L324.8,263.5 L325.8,266.4 L325.7,267.1 L325.7,267.3 L325.4,268.3 L324.7,269.1 L323.9,269.6 L323.5,270.1 L323.4,270.7 L324.4,271.7 L326.6,273.1 L327.4,274.3 L327,275.3 L326.9,276 L327.1,276.5 L327.4,276.9 L327.9,277.1 L328.1,277.6 L328,278.2 L328.1,278.6 L328.5,278.9 L328.5,279 L328.3,279.4 L328,280.1 L327.9,280.7 L327.3,281.4 L327.5,282.1 L328,282.8 L328.3,283.1 L328.4,283.5 L328.2,284.3 L328.3,284.6 L329.8,285.2 L330,285.4 L330.2,286 L330.7,287.3 L330.3,288.9 L329.9,289.7 L329.1,291.1 L329,291.2 L328.9,291.4 L328.6,291.6 L328.3,291.7 L327.7,291.5 L327.4,291.3 L327.5,290.7 L327.2,290.6 L326.9,290.3 L326.8,289.9 L326.5,289.7 L325.3,289.5 L325,289.4 L324.7,289.5 L324.4,289.8 L324.6,290 L324.8,290.3 L325.4,290.7 L325.4,290.8 L324,291.2 L323.1,291.6 L322.3,291.8 L321.5,292.2 L319.8,292.6 L318.6,292.8 L318.4,292.9 L318,293.6 L317.7,293.8 L317.4,293.7 L317.2,293.6 L316.9,293.7 L316.6,293.9 L316.3,294 L316,294 L315.5,294.7 L314.2,294.9 L314,295.2 L313.8,295.6 L313.6,295.7 L313,295.5 L312.1,295.5 L311.6,295.7 L311,295.8 L310.3,295.8 L309.5,296.3 L308.7,297 L308.3,297.7 L308.1,297.9 L307.7,297.3 L307.2,296.9 L306.9,296.6 L306.6,296.6 L306.5,296.7 L306.5,297.1 L306.8,297.6 L307.2,298 L307.3,298.2 L307.5,298.7 L308.1,299.3 L309,299.7 L309.6,300.1 L310,300.7 L310,300.9 L309.9,301.1 L309.7,301.3 L309.5,301.7 L309,302.2 L309.2,302.5 L309.6,302.8 L309.9,303.2 L310.4,303.8 L311,304.9 L311.4,305.4 L312,305.9 L312.5,306.2 L313.3,306.2 L314.2,306.9 L315.2,307.9 L315.9,308.3 L316.4,308.4 L316.9,308.8 L317.2,309.3 L317.4,309.6 L317.7,309.8 L318.6,309.8 L319.7,310.6 L320.4,311.1 L320.8,311.6 L320.7,311.8 L320.6,312.4 L320.6,313 L320.5,313.3 L320,313.7 L319.8,313.8 L319.6,313.9 L318.1,313.4 L318,313.5 L317.8,313.5 L317.4,315.2 L317.2,315.5 L316.7,315.7 L315.8,316 L315.2,316.1 L314.7,316.3 L313.2,316.9 L312.5,317.4 L312.1,317.9 L312.1,318.2 L312.8,319 L313.7,319.9 L313.7,320.7 L313.3,321.2 L313.2,321.5 L313.5,321.6 L313.9,321.6 L314.3,321.7 L314.5,322.1 L314.4,322.8 L314.3,323.5 L314.2,323.7 L313.8,323.8 L313.1,323.5 L312.5,323.1 L312.2,322.9 L312.2,322.7 L312.4,322.5 L312.2,322.2 L311.4,322 L310.7,322.1 L310.1,322.3 L309.8,322.3 L309.4,322 L308.8,321.8 L308,321.7 L307.5,321.5 L307.4,321.6 L307.5,322.2 L307.3,322.4 L303.4,322.8 L302.3,323.1 L301.4,323.5 L300.8,323.7 L300.6,323.9 L300,324.2 L299.3,324.3 L299.1,324.2 L298.7,324.4 L297.9,324.5 L297.4,324.5 L297.1,324.2 L296.7,323.8 L296.4,323.5 L296.5,323.4 L295.4,323.3 L294.7,323.1 L293.2,323.2 L292.9,323.1 L292.8,323.2 L292.6,324.3 L292.3,324.8 L291.8,325.3 L291.2,325.5 L290.8,325.6 L290.8,325.2 L290.9,324.8 L290.6,324.7 L290.1,324.7 L289.8,324.5 L289.9,324.2 L289.8,324 L289.5,323.8 L289,323.5 L287.9,323.1 L287.2,322.8 L286.9,323.1 L286.4,323.3 L285.5,323.2 L285.3,323.3 Z M319.9,254.7 L320.1,255.4 L319.9,255.8 L319,255.2 L318,255.2 L317.5,256.1 L317.1,256.2 L315.6,255.3 L315.4,254.9 L315.3,254.6 L315.5,253.3 L315.5,253 L316,252.5 L316,251.9 L316.8,251.3 L317.5,251.3 L317.8,251.8 L318.1,252.2 L319.3,252.6 L319.5,252.8 L319.6,253.1 L319,253.6 L318.9,253.8 L319,254.3 L319.9,254.7 Z M324.1,259.3 L323.9,259.7 L324.1,260.2 L323.7,260.2 L322.7,260.3 L321.7,260.1 L321.5,259.5 L321.7,258.8 L321.3,258.4 L320.9,258.2 L320.8,257.8 L320.9,257.5 L322.6,258.5 L324.1,259.3 Z M299.9,254.3 L298.6,254.3 L298.1,253.9 L297.6,253.8 L297.9,253.3 L298.2,253.1 L299.5,253.4 L299.8,254.1 L299.9,254.3 Z M275.3,250.3 L275.1,250.5 L275.2,249 L276.1,247.4 L276.5,247.4 L276.1,247.8 L275.9,248.1 L275.8,248.8 L275.9,249.1 L277.9,249.2 L277.7,249.5 L275.6,249.7 L275.3,250.3 Z M277.6,251.1 L277.3,251.4 L276.5,251.4 L276,251.1 L276.2,250.8 L276.6,250.6 L276.9,250.6 L277.5,250.7 L277.6,251.1 Z",
      "dk": "M310.5,239.3 L310.5,240.4 L310.3,240.8 L310,241 L309.2,241.2 L308.4,241.5 L307.8,242.1 L307.6,242.9 L308.1,243.4 L309,243.7 L309.2,244.9 L308.4,245.4 L306.5,245.9 L306.3,247.2 L306.4,248.2 L306.4,249 L306.2,250 L304.7,250.5 L303.6,248.9 L303.6,248.3 L303.3,247.6 L303.3,246.9 L302.9,245.9 L301.4,245.7 L300.9,245.6 L300.1,245.8 L299.9,245.8 L298.9,244.4 L299.1,242.9 L298.6,242.1 L298.5,241.7 L298.5,241.4 L298.1,241 L297.6,240.9 L297.3,240 L297.9,239.8 L299.4,239.9 L299.8,239.8 L300.2,239.7 L301.4,238.2 L301.3,237.9 L301.4,237.5 L302.7,237.4 L303.3,237.9 L303.2,238.8 L303.2,239.9 L304,240.2 L304.3,240.3 L304.6,239.5 L304.8,239 L305.1,238.8 L305.3,238.1 L305.1,237.6 L304.7,237.3 L306.1,236.3 L307.6,235.6 L308.5,235.5 L309.3,235.7 L310.1,235.9 L310.6,236.2 L310.8,236.5 L310.3,237.4 L310.1,237.8 L310.5,239.3 Z M287.1,249.9 L287,249.9 L286.5,249.8 L286.1,249.6 L285.1,249.7 L283.8,250.1 L283.1,250.1 L282.5,249.7 L280.2,249.1 L279.8,249.1 L278.3,249 L278.2,248.1 L278,247.5 L277.5,246.5 L278.3,246.3 L278.1,244.4 L277.8,243.4 L275.6,242.4 L273.8,241.4 L274.2,238 L274.4,237.1 L273.7,235.3 L273.8,233.3 L274.1,230 L274.6,229.9 L275.1,229.9 L276.6,230.5 L277.3,230.6 L277.7,231.1 L278.3,231.3 L278.7,230.7 L278.8,229.8 L280.1,228.5 L280.9,228.1 L281.5,227.9 L282.1,228.4 L282.6,228.9 L282.7,227.7 L283.1,225.4 L281.9,225 L280.9,225.3 L280,226.8 L279.1,228.7 L277.7,228.8 L276.6,229.4 L275.6,228.8 L274.9,228.3 L274.9,227.6 L275.1,227.2 L276.2,225.7 L277.9,224.2 L279.4,224.2 L280.6,223.8 L281.3,223.7 L283.4,223.8 L284.6,223.5 L285.6,222.8 L287.7,219.9 L289,218.7 L291.4,218.3 L293.7,216.9 L294.3,216.9 L293.2,218 L293.1,218.3 L292.9,219 L293.7,220.3 L293.5,221.1 L293.6,222.7 L292.9,223.5 L292,225.3 L291.7,225.5 L291.6,227.5 L291.7,228 L291.6,229.9 L292.4,230.6 L293.3,231 L296.2,231 L296.5,231.3 L296.9,231.9 L296.7,232.8 L296.3,233.6 L295.5,234.2 L294.4,234.6 L293.7,234.6 L292.8,233.8 L292.3,234 L291.9,234.5 L291.1,236.8 L290.8,238.4 L290.6,238.5 L290.1,238.3 L289.4,238.3 L288.5,238.7 L289,239 L289.5,239.6 L289.2,239.9 L288.4,240.2 L287.7,240.8 L287.4,241.3 L286.5,241.8 L285.9,242.5 L286.2,243.4 L286.3,244.2 L286.5,245.1 L286.3,245.7 L285.2,246.7 L284.8,247.6 L285.7,247.5 L286.3,247.7 L286.7,248 L287,248.3 L286.8,248.8 L287.1,249.9 Z M294.6,241.3 L294.9,241.8 L295.3,243.1 L296,244.4 L295.7,245 L295.9,245.8 L295.7,246.5 L294.4,247.4 L292.9,247.5 L291.4,247 L289.2,246.2 L289,245.7 L288.7,245.5 L288.1,244.1 L288.1,242.3 L289.2,242.1 L291.6,241.3 L292.2,241.4 L292.8,241.8 L293.4,241.8 L294.4,241.2 L294.6,241.3 Z M300.5,249.2 L302,249.9 L303,249.8 L303.6,250.1 L303.8,250.5 L303.9,251.5 L303.1,251.8 L302.4,251.7 L301.3,252 L297.8,250.5 L297.9,249.2 L298,248.6 L299.7,248.5 L300.5,249.2 Z M295.3,250.7 L295,250.8 L294.5,249.9 L294.4,249.6 L295,249 L295.3,248.4 L296.3,247.4 L296.9,246.2 L297.1,246.3 L296.9,247.3 L295.6,250.2 L295.3,250.7 Z M310.3,248.4 L310,248.5 L308.7,248.4 L307.3,249.2 L306.8,248.9 L307,248.4 L307.1,248.3 L307.6,248.1 L307.9,247.8 L308.1,247.3 L308.3,247.5 L309.2,247.6 L309.7,247.8 L310,248 L310.3,248.4 Z M311.3,241.4 L310.5,241.9 L310.3,241.9 L310.1,241.2 L310.5,240.8 L310.7,240.5 L310.9,240.5 L311.1,240.8 L311.3,241.4 Z M293.3,249.7 L292.7,249.8 L292.1,249.5 L291,248.6 L290.9,248.4 L291.5,248.6 L292.1,249 L292.7,249.1 L293.4,249.5 L293.3,249.7 Z M289.8,249.2 L288.9,249.4 L288.5,249.1 L287.6,249 L287.4,247.3 L287.4,247.2 L287.9,247.4 L289.2,248.1 L289.7,249 L289.8,249.2 Z M294.3,239.3 L294.1,239.5 L293.6,239.3 L293.6,238.6 L293.7,237.9 L293.5,237.4 L293.8,237 L294.5,237.9 L294.7,238.3 L294.5,238.8 L294.3,239.3 Z M298,222.6 L297.6,222.8 L296.5,222.5 L297,221.9 L298.2,221.7 L298.9,221.8 L298.1,222.3 L298,222.6 Z M331.3,247.8 L331,247.9 L329.6,247.6 L328,246.9 L328.2,245.4 L328.6,244.7 L331.7,246.4 L331.7,247 L331.3,247.8 Z",
      "ee": "M432.7,219.4 L432.4,219.4 L431.3,219.2 L430,218.8 L429.5,218.4 L428.9,218.4 L428.3,218.6 L425.9,219.3 L425.3,219.2 L423.9,218.5 L423.3,217.8 L421.7,216.3 L421.6,216 L421.4,215.7 L419.8,215.4 L419.2,214.8 L418.7,214.7 L418,214.5 L416,213.3 L415.5,213.2 L415.4,213.4 L415.5,213.7 L415.4,213.9 L415.1,213.8 L414.7,213.4 L414.1,213.1 L412.5,213.8 L411.9,213.9 L411.4,214 L408.8,214.9 L408,215.4 L407.6,215.3 L407.7,214.9 L408.8,212.5 L409,210.7 L409.4,210.4 L409.5,210.2 L409.3,209.6 L408.2,209.2 L407.8,209.3 L407.3,209.9 L406.9,210.3 L405.9,210.6 L405,210.2 L403.1,209.5 L402.5,208.6 L402.4,207.8 L401.4,206.9 L400.9,205.9 L401.1,205.2 L402,204.8 L402.3,204.4 L401.1,204.4 L400.8,204.3 L400.8,204 L400.3,202.7 L400.7,202.2 L400.9,201.8 L400.6,201.4 L400.7,200.9 L401,200.4 L400.8,199.4 L402,198.8 L403.2,198.4 L405.6,198.2 L405.4,197.2 L406.4,197.2 L408.1,196 L409.8,196.2 L412.2,195.4 L416.9,195.4 L417.5,194.9 L417.4,194.4 L417.4,193.9 L418.3,194 L419.8,194 L425.3,194.9 L426.6,194.9 L428.5,196 L429.5,196.2 L432.5,196.2 L437.1,196.7 L438,196 L438.1,195.8 L438.5,196.2 L439.1,196.8 L439.3,197.2 L439.1,197.4 L438.5,197.6 L438.4,197.7 L438.2,198.1 L437.5,198.1 L437.2,198.4 L436.8,199.4 L436,201.1 L434.9,202.4 L434,203.2 L433.6,203.7 L433.3,204.4 L433.3,205 L434.1,208.6 L434.1,209.3 L433.9,209.9 L433.8,210.6 L433.9,211.2 L434.5,212.2 L435.1,213.6 L435.3,214.6 L435.7,214.9 L436.1,215.2 L436.2,215.3 L436.2,215.5 L436,215.7 L434.2,216.2 L434,216.6 L433.8,217.1 L433.1,217.7 L432.8,218.4 L432.7,219.1 L432.7,219.4 Z M393.5,206.4 L394.1,206.6 L394.7,206.6 L395.2,206.4 L396.4,206.5 L399.1,208 L399.4,208.4 L397.8,208.6 L397.4,209.1 L397,209.4 L396.5,209.5 L395.7,210.1 L394.7,210.7 L394.5,211 L392.5,211 L391.5,211.2 L390.6,211.9 L390.3,213.2 L389.7,214.2 L389.1,214.6 L388.4,214.6 L388.2,214.2 L388.3,213.9 L389.7,212.4 L390,212 L389.3,211.7 L388.7,211.3 L387.5,210.7 L387.2,210.2 L387.5,210.2 L387.8,210 L388.1,209.6 L388.3,209.2 L387.3,207.9 L387.8,207.7 L388.4,207.7 L389.1,208.1 L389.8,207.6 L390.1,207.6 L390.6,207.7 L391.2,206.9 L392.3,206.6 L392.9,206.3 L393.5,206.4 Z M396.1,203.9 L395.4,204.5 L395,204.2 L394.8,203.9 L393.9,205.3 L392.9,205.5 L392.3,205.3 L392.4,204.8 L391.8,203.4 L391,203 L389.8,203 L388.9,202.5 L392.3,202.1 L392.6,201.4 L393.3,200.8 L393.8,200.7 L394.2,200.8 L394.3,201.4 L394.4,201.6 L395.9,201.9 L396.5,202.7 L396.8,203.8 L396.1,203.9 Z M399.5,207.2 L398.9,207.3 L397.2,206.5 L397.6,205.9 L398.1,205.7 L399.5,206 L399.6,206.9 L399.5,207.2 Z",
      "es": "M219.8,399.7 L219.6,399.8 L219.1,399.7 L218.2,399.7 L218.2,399.4 L218.3,399.2 L218.5,399 L219,399.4 L219.8,399.5 L219.8,399.7 Z M232.6,390.7 L233.4,390.9 L234.2,390.7 L234.7,390.8 L235.1,390.9 L235.2,391.4 L234.8,392 L234.3,392.6 L233.8,393.2 L233.4,394 L232.7,394.4 L232,394.6 L230.6,394.1 L229.7,394 L229.5,393.8 L229.3,392.9 L228.9,392.7 L228.4,392.6 L227.9,392.8 L227.3,393.2 L226.9,392.8 L226.4,392.7 L226.2,392.4 L226.2,392.1 L229.6,390.1 L230.6,389.7 L232.7,389.2 L233,389.3 L232.8,389.6 L232.8,389.7 L233,389.8 L233,390.1 L232.7,390.3 L232.6,390.7 Z M242.1,390.2 L241.9,390.3 L239.4,389.4 L238.6,389.3 L238.4,389.1 L238.4,388.6 L238.5,388.4 L240.2,388.3 L241.5,388.7 L242.3,389.6 L242.3,389.8 L242.1,390.2 Z M218.6,397.8 L218.3,398.2 L217,398.1 L216.7,397.9 L217,397.3 L217.4,397.2 L217.4,396.8 L217.8,396.4 L219.5,396.1 L220,396.4 L220,396.8 L219,397.6 L218.6,397.8 Z M191.8,360.2 L191.8,360.5 L192.1,361 L192.5,361.1 L193.2,361.3 L193.7,361.3 L194.5,361.5 L195,361.7 L195,362.1 L194.8,362.5 L194.5,362.8 L194.4,363.1 L194.5,363.3 L194.8,363.4 L195.1,363.5 L195.3,363.4 L195.4,363.2 L195.7,362.9 L195.9,362.9 L195.9,363 L196,363.2 L196.9,363.6 L198.9,364.2 L199.7,364.2 L200.3,364.3 L200.5,364.5 L201.8,365.5 L202.1,365.5 L202.6,365.5 L203.3,365.4 L203.8,365.2 L204.1,365.2 L204.5,365.4 L204.9,365.6 L205.5,365.9 L205.9,366.3 L206.3,366.4 L208.3,366.2 L208.7,366.4 L209.2,366.4 L209.7,366.3 L210.9,366.5 L211.8,366.4 L211.9,366.3 L212,365.5 L212.2,365.2 L212.4,365.1 L212.9,365.1 L215,365.6 L215.8,366 L216.6,366.2 L217.3,366.2 L217.8,366.4 L218.4,367.2 L218.3,367.6 L218.3,367.8 L218.4,368.1 L218.4,368.4 L218.6,368.6 L218.9,368.6 L219.3,368.5 L219.7,368.4 L220.5,368.1 L220.7,368 L222,368.4 L222.5,368.7 L222.8,369 L223,369.2 L223.4,369.3 L223.9,369 L224.8,368.7 L226.2,369 L227.8,369.4 L228.5,369.4 L228.6,369.2 L228.7,368.9 L228.9,368.8 L229.3,368.8 L229.9,368.6 L230.5,368.4 L231.1,368.3 L231.8,368.5 L232.7,368.6 L233.2,368.6 L233.4,369.2 L233.8,369.4 L233.9,369.8 L233.2,370.1 L232.8,370.1 L232.7,370.9 L232.8,371.1 L233.3,371.3 L233.4,371.6 L233.5,372.8 L232.6,373.5 L231.4,374.2 L225.7,376.8 L224.3,378 L223.8,378.3 L219.6,379 L216.6,379.9 L215.1,380.2 L213.4,381.6 L212.5,382.2 L213.2,382.3 L214,383 L213.7,383.3 L212.6,383.7 L212.1,383.9 L211.8,383.8 L211.5,383.9 L209.6,386.3 L207.9,388.1 L207,388.8 L206,390 L203.9,392.9 L203.9,393.7 L204.9,396.6 L205.5,397.3 L206.3,398 L207.9,398.5 L208.3,399 L207.7,399.5 L206.2,400.4 L203.5,401.6 L202.3,402.6 L202.1,403.5 L201.3,403.9 L201,405.2 L200.5,406 L200.4,406.3 L199.9,407 L199.8,407.4 L200.6,408.1 L200.2,408.3 L199.8,408.5 L198.9,408.5 L195.6,408.6 L193.1,410 L191.8,411.2 L190.6,413.5 L189.2,414.8 L188.5,415.1 L187.6,414.5 L186.3,414.4 L185.1,414.6 L184.6,415 L183.6,415.3 L182.6,415.1 L180.6,414.9 L179.7,415 L178.2,415.3 L177,415.1 L175,415 L170.5,415.3 L170,415.4 L169.4,416 L168,416.9 L165.8,417 L163.9,417.6 L163.4,418 L162.6,419 L162.3,419.8 L162.1,419.8 L161.9,419.6 L161.6,419.7 L161.5,420.3 L160.7,420.6 L160.1,420.7 L158.6,420.2 L157.4,419.5 L156.7,419.4 L155.6,418.3 L155.2,417.5 L154.8,416.8 L154.9,416.5 L154.8,416.2 L153.8,415.9 L153.6,415.2 L154.3,414.2 L154.9,413.8 L155.2,413.7 L154.4,413.8 L153.8,414.4 L153,413.4 L149.7,411.5 L149.9,411.1 L149.9,410.8 L149.4,411.4 L149,411.5 L147.3,411.4 L145.4,411.6 L144.9,409.7 L144.7,408.9 L144.6,408.4 L145.1,407.3 L145.6,406.8 L146.3,405.9 L147.2,405.1 L148.2,404.9 L148.6,404.8 L148.9,404.2 L149.1,403.6 L149,403.6 L147.9,403.7 L145.9,401.5 L146,401.1 L146.2,400.6 L146.4,399.9 L146.4,399.4 L146.9,398.9 L147.7,398.5 L148.4,397.8 L148.7,397.2 L148.8,396.6 L148.4,396.2 L147.3,396 L146.2,394.3 L146,393.3 L145.8,393.2 L145.1,392.7 L144.4,391.9 L144.3,391.7 L145,391.6 L147.8,391.5 L148.4,391.4 L148.5,391.3 L149,390.6 L149.5,389.5 L149.6,388.8 L149.4,388.5 L148.5,387.8 L148.5,387.6 L148.6,387.2 L149.2,386.9 L149.9,386.5 L150.3,386.1 L150.2,385.8 L150,385.6 L150,385.3 L150.1,385 L150.2,383.8 L150.3,383.5 L150.1,382.5 L149.9,381.7 L149.4,380.6 L149.5,380.4 L149.7,380.2 L150.6,379.8 L151.3,378.9 L152.4,378.1 L153.7,377.5 L154.6,376.9 L155,376.4 L155.3,376.2 L155.2,376 L155,375.6 L154.5,375.3 L153.8,375.1 L153,375.1 L152.5,375.1 L152.4,374.8 L152.4,374.1 L152.4,373.3 L152.3,373 L151.9,372.8 L151.2,372.8 L150.6,372.6 L150.1,372.6 L149.9,372.7 L148.5,372.7 L148,372.6 L147.5,372.4 L147.3,372.5 L147.2,372.7 L147.1,372.9 L147,373.2 L146.5,373.4 L145.4,373.7 L144.5,373.7 L143.7,373.5 L143.4,373.3 L143,373.2 L141.3,373.4 L141.1,373.3 L140.6,373.5 L139.7,373.9 L139.2,373.9 L139.1,373.8 L139,373.7 L138.6,373.2 L138.7,372.9 L139.4,372.1 L139.4,371.9 L139.1,371.7 L138.8,371.3 L138.7,371.2 L138.3,371.1 L137.8,371.3 L136.1,371.7 L135.6,371.8 L134.9,372.2 L134.1,372.8 L133.5,372.9 L133.2,372.7 L133.2,371.4 L134.1,370.5 L134.8,370 L134.5,369.9 L133.8,369.9 L133.8,369.4 L134.1,369.3 L134.5,368.8 L134.1,368.6 L133.8,368.3 L133.8,367.5 L133.9,367.2 L133.8,366.8 L132.3,367.3 L131.9,367.2 L131.9,366.6 L132.8,365.8 L132.8,365.5 L131.9,365.4 L131.2,364.9 L130.8,364.5 L130.3,364 L130.3,363.4 L130.8,362.3 L131.4,361.9 L132,361.7 L133.3,360.9 L135,361 L136.1,360.9 L137,360.4 L137.6,360.3 L138.4,360 L138.4,359.5 L138.1,359.1 L138.4,358.7 L139.4,358.3 L140.5,357.8 L141.7,357.6 L143,357.1 L143.8,357.5 L144.6,357.4 L145.5,357.7 L146.6,358.6 L148.3,359 L149.6,358.7 L151.9,358.6 L153.1,358.7 L155.2,358.5 L156.4,358.6 L158.3,358.2 L159.8,358.7 L162.7,359 L164.4,359.4 L169.2,360.2 L171,360.2 L173.4,359.8 L174.5,359.4 L175.4,359.6 L176.8,359.3 L177.5,359.3 L178.4,359.9 L181.5,360.6 L182.3,360 L182.9,359.8 L185.1,360.2 L187.3,360.9 L188.4,361 L190.1,360.8 L191.5,360.3 L191.8,360.2 Z M71.6,477.6 L70.9,479.2 L70.3,479.8 L69.9,480 L68.9,480.2 L67.8,479.2 L67.2,478.2 L66.9,477.8 L67.4,477.6 L68.2,477.6 L69.8,477.4 L70.1,477.3 L71.7,476.3 L73.4,476.2 L73.4,476.5 L71.6,477.6 Z M93.3,473.7 L92.7,474.2 L92.1,474 L92.4,473 L92.6,472.7 L93.8,472.3 L94.8,472.1 L95,471.6 L95.4,471.4 L95.7,471.7 L95.4,472 L95.2,473.1 L94.6,473.4 L93.3,473.7 Z M89.3,479.1 L88.2,479.9 L87,479.7 L86.8,479.5 L88,479.3 L89,478.7 L89.6,477.4 L90.7,475.9 L90.9,475.2 L91.3,475 L91.8,474.9 L92.1,475 L92.3,475.3 L92.3,476.1 L92.1,477.3 L91.5,478.4 L89.3,479.1 Z M79.3,479.2 L79.3,479.8 L79.5,480.3 L79.4,481.2 L79,481.6 L78,482.1 L77.2,482 L76.8,481.8 L76,481.1 L76,480.3 L76.7,479.8 L77,479.2 L78.9,479.3 L79.1,479.2 L79.2,479.1 L79.3,479.2 Z M64.6,480.1 L64.3,480.2 L63.8,480 L63.4,479.4 L63.7,479 L64,478.8 L64.4,478.8 L65,479.2 L65.3,479.5 L65.3,479.7 L64.6,480.1 Z M58.8,481.6 L58,482.8 L57,482.3 L56.7,482.2 L56.5,482 L57.5,481.9 L58.5,481.3 L58.8,481.6 Z M59.2,476.7 L59,476.8 L58.8,476.2 L57.8,474.8 L58.4,474.2 L59.5,474.2 L60,474.6 L60.1,475.1 L59.9,475.3 L60,475.9 L59.9,476.2 L59.2,476.7 Z",
      "fi": "M406.2,109 L405.4,106.1 L404.9,105 L404.2,103.7 L402.9,103 L402.7,102.6 L402.5,102 L402.4,101.2 L402.2,100 L402.3,99.1 L402.5,98.5 L403.1,98.1 L403.9,97 L404,96.1 L404.1,94.9 L404.4,93.8 L404.9,93.2 L404.7,92.8 L404.5,92.1 L403.9,91.3 L403,90.1 L402.3,89.1 L402,88.1 L401.8,87.2 L401.9,86.4 L402.1,85.9 L403,85.2 L403.1,84.9 L402.8,83.3 L402.2,83 L401.1,82.9 L400.6,82.9 L400.5,82.7 L400.4,82.4 L400.6,81.8 L400.8,81 L401.1,80.6 L401.2,80.2 L400.8,78.8 L400.7,77.2 L400.8,75.9 L401.9,74.9 L402,74.5 L400.6,73.5 L399.6,72.3 L399.3,71.6 L398.2,71.5 L397.5,69.4 L396.5,68.4 L395.5,67.5 L394.9,67.2 L391.4,65.9 L390,65.7 L388.4,64.9 L387.2,64 L386.2,63.4 L385.3,62.7 L384,62 L383.7,61.4 L382.3,60.3 L381.7,59.6 L379.5,58.3 L379.4,57.7 L379.4,57.2 L379.3,57 L377,56 L377.5,55.4 L379.2,55.4 L380.7,55.9 L381,55.7 L381.2,55.2 L380.6,53.3 L380.7,52.8 L381.4,52.2 L382.4,51.8 L384,51.7 L385.1,51.8 L385.3,51.8 L386.9,53.9 L388.4,55.9 L389.1,56.7 L390.9,59.1 L391.6,60.5 L391.8,61.5 L392.6,61.5 L395.1,61.9 L397.3,62.3 L397.9,62.8 L399.4,62.7 L400.5,62.2 L402.5,61.6 L403.1,60.8 L403.8,60 L404.9,60.1 L406.2,60.8 L407.7,61.6 L409,62 L410.8,62.7 L411.6,63.5 L412.8,63.7 L413.9,62.9 L414.7,60.7 L415.3,59.7 L416.2,59 L417.2,58.7 L418,58.6 L418.6,58 L419.4,56.8 L419.6,55.3 L419.4,52.5 L419.6,51.6 L420.2,50.1 L421.2,46.1 L421.6,45 L422.1,44.3 L422.8,43.9 L424,42.6 L425.8,40.2 L426.3,40 L427.6,39.9 L429.2,40 L430.7,40.4 L430.8,40.4 L431.5,40.2 L432.6,39.4 L434.6,37.9 L435.9,37.5 L437.1,37.5 L438.4,39.2 L440.2,41 L441.4,41.9 L444.6,43.6 L447.4,44.6 L449,48.2 L448.2,49.6 L447.9,50.1 L446.5,51.5 L445,53.5 L444.9,54.5 L445.4,55.5 L446,56.2 L445.4,56.4 L443.7,57.3 L442.7,57.9 L441.4,58.3 L441.8,58.8 L443.8,58.9 L444.2,59.1 L444.4,59.4 L444.4,59.9 L444.2,60.6 L442,64.6 L441.9,65.5 L442.7,67.8 L443.7,70.6 L446.8,71.8 L449.1,72.7 L450.6,75 L453.1,77.9 L454.4,78.9 L454.4,79.3 L454,81.3 L452.5,83.3 L451,84.9 L449.5,86.9 L448.3,88.6 L447,90.7 L446.8,91.3 L446.8,91.9 L447.1,92.6 L448.7,95.1 L449.3,96.3 L450.1,97.6 L450.8,99.1 L451.2,100.4 L451.8,101.7 L452.2,102.3 L452.9,103.2 L453.7,104.6 L454,105.6 L455.3,109.2 L455.4,110.2 L455.3,110.8 L454.8,111 L453.6,111.1 L452.3,111.6 L452.2,111.7 L453.1,112.6 L452.3,114 L452.2,116.1 L451.4,117.2 L451.3,117.4 L451.3,117.6 L451.5,117.8 L453,118.1 L453.1,118.4 L453.1,118.9 L453,119.5 L452.2,119.9 L451.4,120.5 L451.3,121.1 L451.3,121.6 L451.5,122.4 L452.1,123.4 L452.8,124 L455.1,124.6 L455.4,125.1 L455.6,125.7 L455.5,126.4 L454.4,127.7 L454.4,128.1 L454.9,129.3 L455.4,130.4 L457.8,131.6 L458.6,132.3 L458.8,132.9 L458.9,133.7 L458.9,134.6 L458.7,135.4 L458,136.5 L456.3,138.5 L454.6,139.3 L454.5,139.5 L455,140.2 L458,142.8 L460,144 L462.6,145.6 L464.3,146.9 L464.8,147.8 L465.6,148.9 L466.4,149.7 L467,150.4 L467.3,150.9 L467.2,151.4 L466.4,152.9 L466,154.1 L465.2,155.8 L464.3,156.9 L462.3,159.1 L459.2,161.7 L458.5,162.5 L457.1,163.9 L454.6,166.7 L454,167.3 L452,169.5 L451.1,170.2 L450.4,170.8 L448.4,172.9 L446.2,174.4 L444.1,175.8 L443.5,176.6 L442.7,177.1 L441.8,177.6 L441.4,178 L439.3,179.9 L436.3,182.6 L436,182.6 L435.3,183.1 L434.1,183.2 L433.6,183.5 L431.8,182.6 L431.4,182.5 L430.4,182.7 L429.4,183.4 L427.4,183.6 L426.5,183.8 L425.9,184.1 L425.8,183.4 L426.1,182.5 L426.5,181.8 L426.5,181.4 L426.2,181.4 L425.6,182.4 L425.2,183.5 L424.6,184 L423.2,184.2 L421.8,183.4 L421.1,183.4 L421.5,184 L421.8,184.7 L421.8,185.1 L421.1,185 L420.2,185.4 L419.5,186 L419.1,186 L418.6,185.2 L417.7,185.6 L417,186.1 L415.4,186.2 L414.5,186.9 L412.9,187.4 L412,187.4 L409.9,187.9 L409.2,188.8 L408.6,189.1 L407.8,188.9 L405.2,189.3 L402.7,189.8 L401.6,189.8 L400.5,189.5 L399.4,190.3 L398.2,191.3 L396.9,191.7 L396.4,191.6 L396.8,191 L397.6,190.5 L398.3,189.7 L398.3,189.1 L397.9,188.9 L397.4,188.8 L396.7,188.1 L396,186.7 L395.6,186.7 L395.4,187 L395.2,188.1 L395,188.4 L394.6,188.7 L394.2,188.9 L393.8,189 L392.3,189 L392,188.5 L392,188.2 L392.3,187.5 L392.1,187.4 L392.3,186.8 L392.7,186.9 L393.1,186.8 L393.3,186.5 L393.3,186.2 L392.7,186.1 L392.7,185.8 L393.2,184.8 L393.3,184.6 L393.1,184.5 L392.7,184.6 L390.6,184.3 L387.9,183 L387.2,183 L386.8,181.8 L386.2,182 L385.2,182.6 L384.5,182.2 L383.8,181.8 L383.6,181.3 L383.6,180.5 L383.5,179.6 L383.3,178.6 L383.1,177 L383.3,175.8 L383.9,175 L384.1,174.4 L384.4,172.9 L384.5,171.3 L384.3,170.7 L384.4,170.3 L384.8,170.3 L384.7,170 L384.5,169.8 L384.3,169.4 L384.5,169.2 L385.1,169.2 L385.1,169 L385.2,168.9 L384.7,167.9 L384.7,167.4 L384,166 L383.4,164.6 L382.3,163.6 L382.7,161.9 L383.1,160.4 L383,159.7 L382.8,158.8 L381.5,157.9 L381.3,156.5 L381,155 L381.2,154.1 L381.4,153.4 L381.8,152.7 L384,150.5 L384.1,149.4 L385.6,149.3 L384.9,148.3 L384.7,147.7 L384.7,147 L386.8,146.5 L387.6,146.9 L389.4,146.4 L391.1,145.5 L391,145 L390.8,144.6 L390.4,143.7 L390.7,143.5 L391.3,143.6 L391,143.2 L391.1,142.8 L391.7,143 L392.8,141.7 L392.8,140.7 L394.7,140.2 L396.8,138.3 L397.8,137.7 L398.7,137.2 L400.8,135.2 L401.7,135.2 L402.1,133.8 L403.8,132 L404.3,131.8 L405.1,130.2 L407.2,128.3 L408.6,125.8 L409.3,125 L409.6,124.1 L410.4,124 L411.1,123.3 L412.8,122.8 L414.3,123 L415,123.3 L415.6,123.2 L415.5,122.4 L415.1,121.8 L415.5,121.4 L416.3,121 L416.2,120.2 L416,119.6 L415.3,119 L415.7,117.5 L415.8,115.8 L416.1,113.9 L415.2,112.9 L411.9,111.2 L411.3,111.2 L410.5,111 L409.8,109.7 L410.1,108.6 L410.2,108.1 L409.8,108.2 L409.4,108.7 L408.3,109.3 L406.9,108.8 L406.2,109 Z M388.4,185.1 L387.8,185.2 L386.9,184.5 L386.8,184.3 L387.2,184.2 L386.9,183.7 L387,183.4 L387.7,183.8 L388,184.3 L387.7,184.4 L388.3,184.9 L388.4,185.1 Z M382,146.5 L382,146.7 L382.6,146.7 L383.2,146.2 L383.7,146.4 L383.6,147.1 L383.3,147 L383.2,146.9 L382.8,147.3 L382.7,147.6 L382.3,147.7 L381.4,147 L380.9,146 L382.1,146 L382,146.2 L382,146.5 Z M389.9,184.7 L390.9,185 L391.4,184.9 L391.9,185.5 L391,186 L390.9,186.5 L391.3,186.8 L391.4,187.3 L390.6,187.3 L390.2,186.9 L390,186.4 L389.6,186 L389.1,185.8 L389.3,185.4 L389.5,184.9 L389.9,184.7 Z M383.9,182.7 L383.8,183.3 L383.2,183.2 L382.6,183.3 L382.2,182.7 L381.9,181.7 L382,181.5 L382.4,181.3 L382.6,181.8 L383.9,182.7 Z M387,187.6 L386.2,188 L385.9,187.9 L386,187.2 L386.5,186.9 L387.3,186.8 L387,187.6 Z M385.3,188 L384.6,188.2 L384.2,187.8 L384.4,187.5 L384.9,187.2 L385.4,187.3 L385.5,187.6 L385.3,188 Z M412,121.3 L410.7,121.7 L409.7,121.4 L409.7,120.5 L410.3,120 L411.4,119.8 L413,120.3 L413.2,120.6 L412.3,120.7 L412,121.3 Z",
      "fr": "M285,365.4 L284.8,366.7 L284.9,367 L285.2,367.3 L285.4,367.6 L285.6,370.9 L285.5,371.2 L284.5,372.5 L284.3,372.9 L284.3,374.6 L284.1,375 L283.7,375.4 L283.1,376.8 L282.5,377.5 L281,376.7 L280.1,376.4 L279.7,376 L279.4,375.8 L279.6,375.4 L280,375.1 L280.1,374.8 L279.1,374.5 L278.7,374.3 L278.7,373.9 L279,373.4 L278.8,372.9 L278.3,372.9 L277.9,372.9 L277.8,372.6 L278.1,372.3 L278.5,371.9 L278.5,371.5 L278,371.3 L277.6,370.9 L277.4,370.4 L277.8,370.1 L278.3,369.9 L277.9,369.4 L277.6,369.4 L277.4,369.3 L277.6,369 L278,368.7 L278.6,367.6 L279.5,367.1 L280.9,366.8 L281.4,366.7 L281.7,366.3 L282.1,366.1 L282.6,366.1 L283.1,366.2 L283.4,366.4 L283.6,366.2 L283.8,365.8 L283.7,365.4 L283.7,364.2 L284,363.6 L284.4,363.6 L284.8,363.9 L284.8,364.2 L284.9,365 L285,365.4 Z M269.6,322.7 L268.5,323.1 L268.3,323.5 L267.9,323.9 L267.3,324.2 L266.7,324.2 L266.1,324.2 L265.8,324 L265.9,323.8 L265.6,323.6 L264.9,323.6 L264.2,324 L263.6,324.5 L263.8,324.8 L264.3,324.9 L264.5,325 L264.5,325.2 L264.3,325.4 L264.1,325.7 L263,326.7 L261.9,327.6 L261.7,327.9 L261.4,328.1 L260,328.6 L259.8,328.8 L259.7,329.7 L259.6,330.4 L258.5,331.1 L257.5,331.7 L257.3,332.1 L257.1,332.6 L256.8,333.1 L256.7,333.4 L257.2,333.9 L257.1,334.2 L257,334.8 L256.5,335.2 L256,335.4 L256,335.9 L256.3,336 L256.9,336 L257.9,335.6 L258.5,335 L258.1,334.5 L258,334.4 L258.1,334.3 L258.9,333.7 L259.7,333.4 L261,333.3 L262.5,333.5 L262.6,333.6 L262.5,334 L262.7,334.5 L262.9,334.8 L262.6,335.8 L262.9,336.1 L263.3,336.5 L263.6,336.8 L264.1,337.2 L264.5,337.7 L264.6,338 L264,338.5 L262.9,339 L262.7,339.3 L262.7,339.6 L262.9,339.9 L263.5,340.3 L264.1,341.1 L264.6,341.8 L265.5,342.5 L265.7,342.7 L265.7,342.9 L265.4,343.2 L265.1,344.1 L264.7,344.3 L264.3,344.4 L263.2,345.1 L262.7,345 L261.9,345 L261.4,345.2 L261.4,345.7 L261.9,346.1 L262.2,346.5 L262.3,347 L262.8,347.3 L263.5,347.5 L264,347.5 L264.2,347.6 L264.4,347.8 L264.7,348.8 L264.5,349 L264.1,349.1 L263.9,349.5 L263.4,350.1 L263.2,350.6 L263.5,351 L263.6,351.3 L263.4,351.7 L263.6,352.1 L264.2,352.6 L265.7,353.3 L267.1,353.9 L267.5,354 L269.4,353.6 L269.7,353.6 L270,354.1 L270.1,354.4 L269.9,354.8 L269.3,355.4 L268.8,355.9 L268.5,356.3 L268.5,356.6 L268.5,357.1 L268.1,357.3 L268.1,357.2 L267.9,357.1 L267.7,357.1 L267.6,357.2 L267.6,357.4 L266.6,357.7 L266,358.1 L263.3,360 L262.1,360.5 L261.9,360.9 L261.6,361.5 L260.9,362 L260.3,362.3 L258.7,362.6 L257.1,363.1 L256.5,362.9 L254.6,362.9 L253.5,362.2 L251.3,361.8 L250.6,360.8 L249.6,360.7 L248.9,360.7 L248.5,360.6 L248.4,360.3 L248.4,359.9 L247.7,360.1 L247.2,360.1 L246.9,360.2 L246.6,360.4 L246.3,360.3 L246.2,360.3 L246.2,360.5 L245.5,360.5 L244.9,360.4 L243,359.9 L242.8,359.8 L241.5,359.6 L241,359.4 L240.6,358.9 L240.3,358.7 L240.1,358.6 L238.9,358.9 L238.5,359.3 L237.9,359.8 L233.6,362.1 L232.7,363.1 L231.8,364.5 L231.8,365.1 L232.2,367.3 L233,368.4 L233.2,368.6 L232.7,368.6 L231.8,368.5 L231.1,368.3 L230.5,368.4 L229.9,368.6 L229.3,368.8 L228.9,368.8 L228.7,368.9 L228.6,369.2 L228.5,369.4 L227.8,369.4 L226.2,369 L224.8,368.7 L223.9,369 L223.4,369.3 L223,369.2 L222.8,369 L222.5,368.7 L222,368.4 L220.7,368 L220.8,367.8 L221,367.5 L221,367.4 L220.7,367.1 L219.6,366.9 L219,366.8 L218.7,367 L218.4,367.2 L217.8,366.4 L217.3,366.2 L216.6,366.2 L215.8,366 L215,365.6 L212.9,365.1 L212.4,365.1 L212.2,365.2 L212,365.5 L211.9,366.3 L211.8,366.4 L210.9,366.5 L209.7,366.3 L209.2,366.4 L208.7,366.4 L208.3,366.2 L206.3,366.4 L205.9,366.3 L205.5,365.9 L204.9,365.6 L204.5,365.4 L204.1,365.2 L203.8,365.2 L203.3,365.4 L202.6,365.5 L202.1,365.5 L201.8,365.5 L200.5,364.5 L200.3,364.3 L199.7,364.2 L198.9,364.2 L196.9,363.6 L196,363.2 L195.9,363 L195.9,362.9 L195.7,362.9 L195.4,363.2 L195.3,363.4 L195.1,363.5 L194.8,363.4 L194.5,363.3 L194.4,363.1 L194.5,362.8 L194.8,362.5 L195,362.1 L195,361.7 L194.5,361.5 L193.7,361.3 L193.2,361.3 L192.5,361.1 L192.1,361 L191.8,360.5 L191.8,360.2 L193.1,360 L194.3,358.9 L195.5,354.9 L196.3,350.2 L196.9,349.3 L197.7,349 L197.1,348.4 L196.7,348.7 L196.5,349 L196.3,349.2 L196.8,344.8 L197.1,343.2 L197.7,341.5 L198.8,342.2 L199.8,342.9 L200.3,343.5 L200.9,345.4 L201.4,345.9 L202.1,346.3 L201.8,345.8 L201.3,345.5 L200.6,342.8 L200.1,342.1 L199.3,341.5 L197,340.1 L196.7,339.9 L196.6,339.4 L197.4,339.4 L198.1,339.6 L198,339.4 L197.8,339.1 L197.5,338 L197.2,335.5 L197.3,335 L197.1,334.5 L196.4,334.4 L195.8,334.3 L195.1,334.1 L191.8,332.6 L190.7,331.1 L189.6,329.9 L189.3,329.4 L189.3,328.9 L189.9,327.8 L189.4,327.1 L188.9,327 L188.4,326.7 L188.9,326.1 L189.2,325.7 L189.8,325.6 L190.7,325.8 L191.6,326.1 L192.2,326.2 L190.3,325.3 L187.2,325.6 L186.5,325.5 L185.9,325.3 L185.7,324.6 L186.2,324.4 L186.5,323.8 L186.1,323.4 L185.5,323.3 L184.6,323.3 L183.7,323.4 L183.5,323.2 L184,322.6 L183.6,322.4 L183,322.5 L182.1,322.6 L181.3,322.4 L180.5,321.7 L180,321.7 L179.6,321.8 L179.1,321.6 L178.5,321.5 L178.2,321.6 L177.6,321.2 L174.4,320.4 L173,320.3 L171.7,320.6 L171,320.5 L170.4,320 L170,319.2 L167.9,318.5 L168.4,318.1 L169.3,318 L170.4,317.6 L170.8,317.3 L170,316.8 L169.3,316.7 L169,316.5 L168.8,316.1 L169.2,315.9 L169.4,316 L170.2,316.1 L171.5,316 L171.1,315.6 L170.5,315.5 L170.3,315.4 L169.2,315.4 L168.7,315.5 L167.6,315.4 L167.4,315 L167.3,314.6 L167.6,313.8 L169.2,313 L173.1,312.2 L174.7,312.3 L175.9,312.1 L177.3,311.6 L177.9,311.2 L179.9,310.9 L181.8,311.4 L183.5,313.2 L184.4,313.8 L186.4,312.7 L189.4,312.8 L190.1,313.4 L190.3,312.9 L190.9,312.3 L191.3,312.5 L191.5,312.9 L194.7,312.8 L195.2,312.7 L194.4,312.3 L193.7,311.2 L193.5,307.4 L192.6,306.4 L191.6,304.7 L191.2,303.6 L191.1,303.3 L191.3,302.8 L192.5,302.8 L193.5,302.9 L195.3,302.5 L196.2,302.8 L196.2,303.6 L196.4,304.6 L196.7,305.1 L197.2,305.6 L198.7,305.6 L200.3,305.9 L202.3,306 L205.3,306.5 L206.5,306.2 L207.7,305.5 L210,305.1 L210.3,304.8 L208.9,304.9 L207.7,304.5 L207.5,304 L207.7,303.6 L208.1,302.6 L211.7,301 L214.2,300.6 L216.9,299.7 L218.2,298.8 L219.1,297.7 L219.4,297.4 L219.8,297.2 L219.4,296.8 L219.7,292.4 L219.9,291.6 L220.4,291 L221.2,290.5 L222.4,289.9 L226.8,289.1 L227.5,288.8 L227.6,289.3 L227.9,289.9 L228.1,290.3 L227.9,290.7 L228.1,291.1 L228.7,291.7 L229.4,292.3 L230.1,292.7 L230.3,292.6 L230.8,292.5 L231.6,292.1 L232.3,292 L232.7,292.3 L232.9,292.5 L233.3,293.2 L233.5,293.9 L233.7,294.5 L234,294.7 L235.3,294.8 L236.3,295 L236.6,295.2 L236.9,296.5 L237.1,296.7 L237.4,296.5 L237.6,296.3 L237.9,296.3 L238.5,296.4 L239.3,296.4 L240,296.5 L241.1,297.3 L241.1,297.5 L240.9,298 L240.8,298.3 L241,298.4 L241.3,298.8 L241.2,299.2 L240.9,299.5 L240.8,299.7 L240.8,299.9 L240.9,300 L241.1,300.1 L242.7,300.2 L244.2,300.1 L245.1,299.7 L245.2,299.2 L245.5,298.8 L246,298.3 L246.4,298.2 L246.8,298.4 L246.2,300.1 L246.6,300.5 L246.7,301.2 L246.9,301.8 L247.4,301.8 L248,301.9 L248.4,302.1 L249,302.4 L249.7,302.7 L250.2,302.8 L250.4,303.1 L250.9,303.4 L251.5,304 L252.1,304.5 L252.4,304.5 L253,304.3 L253.8,304.2 L254.5,304.2 L254.7,304.5 L255.4,304.7 L255.6,304.8 L255.9,305 L256.3,305.1 L256.8,305 L257.2,304.7 L257.7,304.6 L258.2,304.6 L258.5,304.8 L259.1,305 L259.3,305 L260,305.1 L260.6,305.6 L260.9,306 L261,306.3 L261.2,306.6 L262.3,307.8 L262.6,307.9 L263,307.7 L263.2,307.4 L263.6,307.4 L264.1,307.5 L264.5,307.7 L264.6,308.2 L264.8,308.3 L265,308.2 L265.4,308.2 L266.1,308.3 L267.1,308.1 L267.8,307.9 L268.2,307.9 L268.8,308.6 L269.5,308.8 L271.1,309 L272.7,309.3 L273.4,309.5 L273.8,309.6 L273.9,310.5 L273.7,310.6 L272.1,312.3 L271.4,312.8 L271,313.7 L270.8,315 L270.3,316.2 L269.6,317.4 L269.3,318.3 L269.5,318.8 L269.4,319.8 L268.9,321 L268.8,321.9 L269.1,322.5 L269.6,322.7 Z M196.9,338.2 L196.6,339 L196,338.2 L195.3,337.6 L195.1,337 L195.1,336.9 L196,337.3 L196.9,338.2 Z M580,746 L579.5,746.1 L579.2,745.9 L579.1,745.5 L579.2,745.1 L579.3,744.8 L578.9,744.3 L579.3,743.9 L579.6,744.3 L579.8,744.3 L580.3,744.6 L580.2,745 L580.2,745.2 L580,745.7 L580,746 Z M667.8,801.1 L666.6,801.3 L665.8,801.2 L664.2,800.7 L663.7,800.3 L663.1,799.2 L663.2,798.8 L663.7,798.2 L664.9,797.9 L666.1,798 L666.6,798.2 L667.3,799 L668.1,799.7 L668,800.7 L667.8,801.1 Z M-296.1,571.6 L-296.2,572 L-296.4,572.1 L-296.7,571.8 L-298,571.8 L-298.2,571.5 L-298.3,571.4 L-297.6,570.9 L-298.4,570.8 L-298.7,570.6 L-299.3,569.6 L-299.3,569.3 L-299,569.2 L-298.6,569.2 L-297.7,569.5 L-297.1,569.9 L-296.9,569.9 L-296.8,570.1 L-297,570.4 L-296.6,570.7 L-296.5,570.9 L-296.1,571.6 Z M-300.2,560.3 L-301.2,560.4 L-301.8,560.3 L-302,559.9 L-301.7,559.5 L-301.9,559 L-301.8,558.7 L-301.4,558.5 L-300.9,558.8 L-300.8,559.1 L-300.5,559.4 L-299,560.1 L-300.2,560.3 Z M-302.4,561.8 L-303.1,562.1 L-303.4,562 L-303.8,561.4 L-304.1,559.8 L-303.9,559.6 L-303.7,559.5 L-302.8,559.7 L-302.5,559.9 L-302.1,560.1 L-302.3,560.3 L-302.2,561.5 L-302.4,561.8 Z M-299.4,562.5 L-299.9,562.6 L-300.1,562.5 L-300.1,562.1 L-299.8,561.8 L-299.6,561.8 L-299.3,562.1 L-299.2,562.3 L-299.4,562.5 Z M-244.8,649.1 L-244.7,649.1 L-244.4,649 L-244.1,649 L-243.7,648.5 L-243,648.3 L-241.8,646.7 L-241.3,646 L-241.2,645.7 L-241.1,644.9 L-241.4,644 L-241.2,643.7 L-240.2,642.6 L-239.7,642 L-239.7,641.5 L-239.6,641.2 L-239.7,641 L-240,640.9 L-240.3,640.4 L-240.6,640 L-241.3,639.6 L-241.8,639.2 L-242.6,638.2 L-242.5,637.7 L-242.7,637.5 L-243,637.3 L-242.9,637 L-243.1,636.4 L-243.3,635.9 L-243.4,635.5 L-243.2,634.9 L-243.3,634.2 L-243.6,633.9 L-243.6,633.3 L-243.6,632.8 L-243.3,632.5 L-243.4,632.2 L-242.4,631.1 L-241.7,630.4 L-241,630 L-240.4,629.7 L-239.6,628 L-239,627.4 L-238.4,627.3 L-235.2,628.7 L-233.6,628.8 L-230.6,629.6 L-229.5,630.5 L-226.9,632.1 L-225.6,632.6 L-225.5,633.1 L-225.8,633.7 L-225,633.1 L-223.6,634 L-223.2,634.5 L-222.8,635.3 L-223,635.9 L-223.1,636.1 L-223.2,636.3 L-222.8,636.1 L-222.6,635.8 L-222.5,635.3 L-222.2,634.6 L-221.7,634.6 L-221.4,635 L-220.6,636.8 L-220.4,637.1 L-220.3,637.7 L-220.3,637.9 L-220.3,638.2 L-220.5,638.3 L-221.2,638.6 L-221.5,639 L-221.7,639.4 L-222.1,639.7 L-222.6,640 L-222.7,640.2 L-223.1,640.5 L-223.1,640.8 L-224.1,642 L-224.5,642.6 L-225.1,643.2 L-225.4,643.4 L-225.9,643.7 L-226.1,644.1 L-226.1,644.6 L-226.4,645 L-226.6,645.5 L-226.9,645.7 L-227.7,647.1 L-227.8,647.6 L-228,647.8 L-228.5,648.5 L-228.9,648.9 L-229.6,649.2 L-230.3,649.5 L-230.6,649.8 L-231.1,650 L-231.5,650 L-232.1,649.9 L-232.9,649.8 L-233.3,649.9 L-233.5,649.7 L-233.8,649.3 L-234.2,649 L-234.4,649.1 L-235,649.4 L-235.6,649.6 L-236.1,649.5 L-237,649.3 L-237.5,649.2 L-237.6,649.1 L-237.8,648.9 L-238,649 L-238.3,649.2 L-238.6,649.4 L-239.2,649.7 L-240.4,650.2 L-240.7,650.4 L-241.1,650.3 L-241.6,650.2 L-242.1,650.2 L-243.3,649.9 L-243.9,649.6 L-244.2,649.3 L-244.6,649.2 L-244.8,649.1 Z",
      "gb": "M184.6,283.6 L184,284 L182,284.4 L181.2,284.8 L179.7,285.8 L179.4,285.9 L177.2,285.7 L175.5,284.4 L174.5,283.9 L174,283.8 L173.6,284 L172.6,284.1 L171.6,284.1 L172.1,283.5 L172.8,283.2 L171.3,282.9 L170.8,282.8 L170.4,282.4 L169.2,282.3 L168.6,282.4 L167.6,282.9 L166.1,283.5 L164.3,282.7 L163.9,282.4 L163.9,281.7 L163.6,281.1 L163.1,280.9 L163.8,280.2 L164.6,279.8 L166.3,279.3 L168.9,278.2 L170.4,277.7 L171.8,276.9 L172.3,276.4 L172.7,275.7 L173.1,274.8 L173.7,274.1 L173.2,274 L172.9,273.5 L173,272.9 L173.2,272.5 L173,271.9 L172.6,271.3 L172.6,270.8 L172.7,270.3 L171.7,270.3 L170.6,270.5 L169.6,270.8 L168.7,271.3 L167.9,271.4 L167.9,271 L168.3,270.5 L169.2,269.8 L170.2,269.3 L170.6,268.8 L170.8,268.3 L171.3,267.9 L172.6,267.1 L175.1,266.2 L175.5,266.2 L176.5,266.3 L177.4,266.1 L178.3,265.8 L179.1,265.7 L181,266.7 L180.4,265.2 L181.3,264.9 L182.5,266.2 L182.9,266.3 L183.9,266.1 L183.5,265.9 L183.1,265.9 L182.5,265.7 L182.1,265.3 L181.3,264 L181.3,263.2 L181.8,262.4 L182.4,261.7 L182,261.5 L181.5,261.2 L181.5,260.5 L181.6,259.8 L182.6,259.2 L182.9,258.3 L183.1,257.4 L182.9,256.9 L181.9,257 L181.4,257.2 L180.9,257.5 L180.4,257.5 L179.2,256.4 L178.4,255.5 L177.1,253.8 L176.9,252.7 L178,250.5 L179.6,249 L181.5,248.5 L181.2,248.4 L178.2,248.4 L177.3,248.6 L176.4,249.2 L175.9,249.4 L175.4,249.4 L174.9,249.7 L174.4,250.1 L173.9,250.4 L172.9,250.3 L172.4,250.4 L172.1,250.2 L171.8,249.8 L171.5,249.7 L171,249.8 L170.2,250.3 L169.3,250.6 L168.2,250.3 L166.8,249.7 L166.5,249.9 L166.2,250.5 L166,251.4 L165,250.6 L164.2,249.5 L163.9,248.9 L163.9,248.2 L164.3,247.9 L164.8,248.1 L165.6,246.3 L167.1,244 L167.6,243.4 L167.9,242.5 L167.9,241.9 L167.6,241.4 L166.2,240.3 L166.2,239.3 L166.3,238.3 L166.7,237.7 L166.9,237.6 L168.7,237.6 L168,237.3 L166.6,236.3 L166.6,236 L166.9,235.1 L166.8,235.2 L166.5,235.6 L165.9,236.6 L165.5,236.8 L164.5,237 L164.3,237.5 L164.2,237.6 L163.7,237.7 L163.5,238.1 L163.4,238.2 L163.2,237.7 L163.2,236.9 L163.5,236.1 L163.8,235.6 L165.3,234.3 L164.6,234.7 L162.9,235.9 L162.1,236.7 L161.9,236.9 L161.8,237.2 L161.8,237.4 L162.2,238.8 L162.1,239.5 L160.7,243.7 L160.4,244.1 L160.2,244.3 L159.9,244.4 L159.3,244.3 L158.9,244 L158.9,243.6 L159.1,243.1 L159.6,241.1 L159.9,240.5 L160.3,240 L161.1,239.1 L161.1,239 L160.5,239.2 L160.3,239.2 L160.2,239 L160.2,236.3 L160.7,235.4 L160.9,234.1 L161.3,232.9 L161.7,232.1 L162.1,231.1 L162.6,230.6 L162.7,229.9 L163.3,229.1 L163.7,228.3 L163.5,228.4 L160.6,230.5 L159.9,230.9 L158.9,230.8 L158.1,230.5 L157.5,230 L157.3,229.1 L156.6,229 L155.9,228.9 L155.9,228.7 L156.7,228.2 L158,228 L159.3,227.2 L158.2,226.6 L158.2,226.4 L159.2,226 L160.4,224.3 L160.7,222.8 L160.1,222.1 L159.9,221.6 L158.7,221.1 L158.5,220.4 L158.7,220.1 L159,219.7 L159.6,219.4 L160.5,219.1 L159.7,218.9 L159.4,218.5 L159.1,218 L159.1,217.7 L159.6,216.4 L159.8,215.9 L160.3,215.2 L162.4,215.3 L162.7,214.9 L162.9,214.9 L164,215.2 L163.8,214.9 L162,213.3 L161.9,213 L162.4,212.1 L162.4,211.7 L162.4,211.3 L162.5,211 L163.1,210.8 L164.8,210.8 L165.2,210.7 L165,210.2 L164.6,209.7 L164.6,209.2 L164.6,208.8 L164.7,207.9 L164.7,207.6 L165.2,207 L165.5,206.9 L165.9,206.8 L166.9,206.9 L167.2,207.2 L167.7,207.7 L167.9,207.7 L169.1,207.1 L169.5,207 L170,207.7 L172,207.1 L174.7,206.9 L176.3,206.5 L178.1,206.4 L179.7,206 L181.4,206.2 L181.4,206.4 L181.3,206.8 L180.9,207.6 L181,208.6 L180.9,208.9 L180.7,209.3 L180.1,210 L178.4,210.9 L175.4,213.2 L173.6,214.3 L173.4,214.8 L173.3,215.6 L174.3,215.7 L174.7,216 L174.5,216.3 L172.9,217.6 L172.4,218.8 L173.7,218.7 L174.6,218.5 L176.6,217.8 L178.5,217.2 L179.4,217.2 L181.1,217.6 L181.5,217.7 L182.3,217.5 L183,217.4 L188.1,217.6 L189.5,217.3 L190.4,217.6 L191.2,218.4 L191.9,219.8 L191.9,220 L191.5,220.6 L190.6,221.4 L189.9,222.5 L189.7,223.1 L189.6,223.7 L189.3,224.3 L187.9,227.1 L186.5,228.6 L185.9,229.7 L185.2,230.5 L184.5,231.1 L183.7,231.4 L181.4,231.8 L180.8,232.1 L180.1,232.5 L179.3,232.8 L180.2,232.7 L181.1,232.5 L182.8,232.4 L184.7,233.3 L184.5,234 L183.7,234.6 L182,234.7 L180.4,236 L179.6,236.4 L178.8,236.6 L177.9,236.5 L176.1,236.2 L175.3,235.8 L176,236.4 L176.8,236.7 L181.4,237.4 L181.7,237.4 L183.2,236.6 L185.1,236.6 L188.9,238 L189.9,239 L191.5,240.6 L192.3,241.2 L192.9,241.7 L193.3,242.5 L194,245.1 L194.8,247.7 L195.9,250.5 L196.4,251.2 L197.1,251.8 L200.3,253 L201.1,253.4 L202.3,254.6 L203.6,255.8 L204.7,256.8 L205.9,257.5 L205.3,258 L204.9,258.6 L205.2,259.4 L205.7,260.3 L206.7,261.6 L207.6,263 L207.3,262.8 L206.9,262.7 L206.4,262.7 L206,262.6 L205.2,262.2 L204.4,261.6 L202.8,261.8 L201.9,261.8 L201.2,261.8 L202.6,262.1 L204.2,262.1 L207.7,264.5 L208.9,265.9 L209.5,267.7 L209.1,268.5 L208.3,269.1 L207.6,269.7 L207,270.4 L208.9,271.4 L209.3,271.4 L209.8,271.2 L210.2,270.9 L210.9,270 L211.2,269.7 L212.4,269.6 L213.4,269.7 L214.5,269.9 L215.3,269.8 L217.1,270.2 L218,270.5 L220.3,271.9 L220.8,272.7 L221,273.8 L221.1,274.9 L220.7,275.9 L220.2,276.9 L220,278.1 L219.8,278.5 L219.5,278.8 L218.3,279.8 L217.5,280.1 L217.2,280 L216.8,280 L216.8,280.2 L217.1,280.7 L217.2,281.3 L216.4,281.7 L215.7,281.9 L214.5,281.7 L212.8,282.5 L214,282.9 L214.3,283.3 L214,284.1 L213.2,284.4 L212.4,284.6 L211.5,284.6 L210.8,284.8 L210.1,285.1 L211,284.9 L211.6,285.1 L212,285.7 L212.3,285.9 L214,286.2 L215,286.2 L217,286 L218,286.1 L218.3,286.2 L218.3,286.7 L218.2,288 L217.9,288.3 L215.3,289.3 L214.7,290.1 L214.5,290.5 L213,290.5 L212.3,290.9 L211,291.3 L210,291.6 L209.1,292.1 L208.3,292.2 L204.9,291.7 L202.9,291.7 L200.1,292.2 L199.4,292.1 L198.4,291.7 L197.3,291.4 L196,291.2 L194.9,290.8 L195.6,291.6 L194.1,292.3 L193.4,292.5 L192.7,292.5 L191.2,292.7 L189.8,292.6 L190,293.1 L190.4,293.5 L190.1,293.7 L189.8,293.8 L187.2,293.4 L186.8,293.5 L186.5,293.8 L185.6,293.6 L184.6,293.1 L183.7,292.7 L182.6,292.6 L181.8,292.6 L178.5,293.5 L177.8,294.3 L177.5,295.5 L177,296.5 L176.2,297.3 L175.3,297.5 L174.4,296.9 L172.7,296.3 L172.1,295.9 L171.9,295.8 L171.8,296 L171.1,296.2 L170.4,296.2 L169.4,296.3 L167.5,296.8 L166.8,297.2 L165.2,298.1 L164.9,298.4 L164.3,299.3 L163.4,299.5 L162.6,298.9 L161.7,298.7 L160.7,298.9 L160.2,299.2 L159.9,298.9 L159.9,298.4 L160.6,297.8 L162.5,297.3 L164.1,296 L164.9,295.3 L165.2,294.8 L165.7,294.5 L166.2,294.4 L166.4,294 L168.7,292 L168.9,291.6 L169,290.8 L169.2,290 L171.1,289.5 L172,287.9 L172.2,287.8 L174.9,287.5 L176.8,287.5 L178.7,287.8 L179.7,287.9 L180.7,287.8 L181.5,287.3 L182.8,285.7 L183.5,285 L184.4,284.4 L185.2,283.7 L186.5,282.4 L185.6,282.8 L184.6,283.6 Z M171.9,266 L172.3,266.2 L173.2,266.2 L172.9,266.6 L171.9,267.1 L171.3,267.6 L170.5,268 L170.1,267.5 L169.6,267.5 L169,266.7 L168.9,265.3 L169.7,265 L171,265 L171.9,266 Z M185.5,198.9 L184.6,199 L185.1,198.2 L185.7,198 L186.7,198.1 L186.5,198.4 L185.5,198.9 Z M198,182.9 L197.8,183 L197,181.7 L197.6,180.2 L198.3,180.3 L198.4,180.7 L198.4,181 L198,181.1 L197.9,181.2 L198.1,181.9 L198.1,182.7 L198,182.9 Z M195.8,182.6 L196,183.5 L196.4,183.2 L197,184.1 L197.4,184.1 L197.9,183.7 L197.8,184.5 L197.3,186.8 L197.1,187.1 L197,187.8 L196.9,188 L196.7,189.3 L196.3,189.7 L196,190.8 L195.9,190.9 L195.4,190.5 L195.9,188.9 L196.1,187.9 L195.9,187.4 L195.7,187 L195,187 L194.4,187.2 L194.2,186.9 L194.2,186.6 L194.1,186.5 L193.3,186.5 L193.1,186.4 L192.9,186.1 L192.9,185.8 L193.6,185.6 L194.2,185.7 L195.3,185.2 L194.6,183.4 L193.8,183.3 L193.6,183.1 L193.8,182.8 L194.2,182.7 L194.9,181.8 L195.4,181.6 L195.9,181.7 L195.8,182.6 Z M200.2,179 L200.2,179.2 L199.8,180.3 L199.8,180.7 L199.1,180.6 L199,180.5 L198.9,179.9 L199,179.2 L199,179.1 L199.2,179 L199.5,179.1 L199.8,178.8 L200,178.8 L200.2,179 Z M180.4,204.3 L180,204.4 L179.5,204.4 L178.8,203.7 L178.5,203.2 L178.6,202.9 L178.9,202.8 L179.6,202.9 L179.9,203.5 L180,203.9 L180.1,204 L180.5,204.2 L180.4,204.3 Z M182.4,204.9 L182.3,204.9 L182,204.7 L181.5,203.9 L182.3,203.8 L182.7,203.9 L182.5,204.2 L182.4,204.9 Z M181.3,201.4 L181.2,201.7 L181.9,201.7 L182.8,202 L183.3,202 L183.8,202.3 L183.5,202.9 L183.2,203.1 L182.9,203.1 L181.9,202.5 L180.4,202.8 L180.1,202.7 L180,202.5 L179.9,202.3 L179.9,201.9 L179.8,201.8 L179.3,202.2 L179.1,202.1 L179,201.9 L178.9,201.5 L179,201 L179.3,200.2 L179.8,200 L180.5,200.1 L181.4,200.6 L181.7,200.8 L181.7,201.1 L181.3,201.4 Z M184,199.5 L183.3,199.8 L183,199.5 L183,198.7 L182.1,198.4 L181.7,198.2 L181.4,197.8 L181.5,197.7 L182,197.5 L183,198.2 L183.4,198.8 L184,199 L184.1,199.1 L184,199.5 Z M152,230.3 L151.5,230.3 L151.5,230.2 L152.3,229.4 L152.8,229.3 L153,229.3 L152.7,229.8 L152,230.3 Z M164.4,243 L163.4,243 L163,243 L162.6,242.7 L162.1,241.2 L162.2,240.6 L162.4,240.4 L162.7,240.2 L163.2,240.1 L163.8,240.3 L164,240.6 L164.4,241.7 L164.5,242.5 L164.4,243 Z M158.9,233 L155.6,233.6 L154.4,233.6 L154.3,233.3 L154.6,233.1 L155.5,232.9 L155.9,231.3 L154.5,230.6 L154.4,230.4 L154.5,230.1 L154.6,230 L155.5,229.6 L155.9,229.5 L156.2,229.6 L156.8,230 L157.5,230.8 L158.4,231 L159,231.3 L158.9,233 Z M156,237.7 L156.3,239.1 L156.6,240 L156.6,240.3 L156.3,240.7 L154.9,241.3 L154.5,241.3 L154.5,241.2 L154.8,240.6 L154.5,239.9 L154.6,239.4 L154.5,239.4 L154.3,239.4 L153.3,240.2 L153,240.3 L152.9,240.1 L153.2,239.5 L153.2,239 L153.3,238.8 L153.6,238.5 L153.9,238.3 L154.2,238.3 L154.4,238.5 L155.2,238 L156,237.7 Z M157.3,239 L157.1,239.1 L156.7,239.1 L156.5,238.9 L156.4,238.6 L156.4,238.1 L156.7,237.7 L157.7,237.2 L157.3,237 L157.2,236.8 L157.5,236.4 L158.7,235.7 L159,235.5 L159.3,235.6 L158.7,236.8 L157.3,239 Z M155.4,209.5 L154.3,211.5 L153.9,211.6 L153.5,212.1 L152.4,212.7 L153.4,212.7 L153.7,212.9 L153.7,213.3 L153.5,213.5 L152.2,214.5 L151.4,214.9 L150.5,215.8 L150,215.8 L149.5,216.5 L149.1,216.7 L148.9,216.7 L148.6,216.6 L148.1,216 L149.1,215.4 L149.2,215.1 L149.9,214.7 L149.9,214.6 L148.7,214.1 L148.3,213.8 L148.3,213.6 L148.9,213.2 L148.6,213.2 L148.4,212.9 L148.1,212.9 L148,212.7 L148,212.2 L148,211.6 L148.4,211.4 L148.5,211.1 L148.7,211.1 L149.2,211.2 L149.7,211.6 L150.3,211.5 L151,211.5 L151,211.4 L150.5,210.4 L150.6,210.2 L150.9,210 L152.5,209.2 L154.6,208 L155.1,207.8 L155.2,208 L155.4,208.6 L155.4,209.5 Z M154.7,225.9 L154.5,226.1 L154.2,226 L153.8,225.8 L153.5,225.3 L154.4,224.9 L154.7,225.1 L154.9,225.4 L154.9,225.7 L154.7,225.9 Z M155.8,219.6 L155.8,220.2 L155.7,220.8 L155.9,221.4 L155.9,221.9 L156.3,222 L156.5,222.2 L158,222.5 L159.5,222.4 L159.7,222.6 L159.8,222.9 L159.5,223.2 L158.7,223.8 L157.7,224.8 L157.4,225 L157.1,225 L156.9,224.9 L156.7,223.2 L155.7,223.4 L154.8,223.4 L154.4,223.2 L154,222.8 L153.4,221.7 L151.4,221.3 L150.9,220.7 L150.7,220.4 L150.8,220.2 L151.2,219.7 L151.7,219.9 L152,219.8 L152.2,219.6 L152.2,219.4 L151.9,219.1 L151.9,219 L153.9,218.5 L154.1,217.7 L154.5,217.7 L155,217.9 L155.7,218.7 L155.8,219.6 Z M147.1,217.5 L148,218.2 L147.2,219.3 L146.1,219.3 L144.5,218.5 L144.5,218.3 L144.6,218.1 L144.9,217.9 L145.1,217.9 L145.5,218 L146.1,217.8 L146.5,217.9 L147.1,217.5 Z M146.7,224.2 L146.3,224.2 L145.9,224.2 L145.6,224 L145.3,223.3 L145.3,222.8 L145.4,222 L145.4,221.1 L146.3,221 L146.6,221.2 L146.7,224 L146.7,224.2 Z M145.3,225.9 L144.6,226.1 L144.3,226 L144.3,225.8 L144.4,225.4 L145,225.3 L145.4,225.5 L145.5,225.7 L145.3,225.9 Z M155.2,257.9 L154.5,257.8 L154,258 L153.7,258.2 L153.4,258.1 L152.5,258.2 L151.6,258.2 L151.5,257.9 L151.7,257.1 L151.5,256.8 L150.7,256.7 L150.4,256.5 L149.9,255.9 L149.8,255.7 L149.8,255.3 L149.3,254.8 L148.7,254.4 L148.3,254.4 L147.7,255 L147.1,255.6 L147.3,255.9 L147.5,256.2 L147.2,256.5 L146.2,257.2 L146.1,257.4 L145.8,257.5 L145.4,257.3 L144.3,257.4 L143.8,257.3 L143.2,256.8 L141.7,256.5 L141.4,255.8 L141.2,255.6 L139.5,254.4 L139.3,253.9 L139.5,253.7 L140.1,253.3 L142.2,252.7 L142.5,252.4 L142.6,252.2 L142,251.9 L141.4,251.6 L141.3,251.5 L141.2,251.3 L141.6,251.1 L142.2,251.1 L142.7,251.1 L143,251 L143.8,250.8 L144.2,250.5 L144.6,249.9 L145,249.3 L145.1,249 L145.5,247.9 L145.6,247.7 L146.9,247 L147.3,247.4 L147.9,247.5 L148.5,247.1 L149.2,246 L149.7,245.9 L150.2,246 L151.3,245.9 L153.1,245.4 L153.9,245.3 L155.1,245.6 L156,245.6 L156.7,246.4 L157.1,247.7 L158.1,248.9 L159.4,250 L159.4,250.6 L159,251 L158,251.4 L158,251.9 L158.6,251.7 L159.2,251.6 L160.5,251.7 L160.9,252.1 L161.2,252.8 L161.4,253.4 L161.3,254.1 L161,253.9 L160.6,253.3 L160.2,253 L159.7,252.9 L159.9,253.7 L159.9,254.7 L160.1,254.8 L160.7,254.8 L160.3,255.9 L159.4,256.2 L158.5,256.3 L158.2,256.7 L158,257.2 L157.5,257.9 L156.9,258.3 L156,258.2 L155.2,257.9 Z M197.8,292.9 L197.1,293.2 L196.9,293.6 L196.7,293.8 L196.3,293.9 L195.8,293.9 L194.1,293.1 L193.7,293.1 L194.1,292.8 L195.2,292.5 L195.8,292.1 L197.2,292.5 L197.8,292.9 Z",
      "gr": "M436.9,416.5 L436.7,416.7 L436.3,416.3 L436.3,416.1 L436.7,415.9 L436.9,415.9 L436.9,416 L436.9,416.3 L436.9,416.5 Z M377,402.1 L377.1,403 L377.6,403.2 L378.4,404 L378.4,404.4 L378.2,404.6 L376.9,404.2 L376.6,404.3 L376.2,404.3 L376,403.8 L376,403.7 L375.8,403.4 L375.6,403.3 L375.1,403.6 L374.8,403.7 L374.8,403.3 L375.3,402.4 L375.5,402.3 L375.9,402.6 L376.2,402.5 L376.4,402 L376.5,401.5 L376.5,401.3 L377,402.1 Z M379.2,406.7 L380.1,407.4 L379.4,407.3 L378.7,407.8 L377.7,407.2 L377.1,406.5 L377,406.3 L377.6,405.7 L378.2,406.3 L378.8,406.4 L379.2,406.7 Z M377.6,400.2 L377.3,400.3 L377,400.3 L376.7,400.3 L376.5,400.5 L376.5,399.8 L376.8,399 L377.1,398.6 L377.6,398.4 L377.9,398.7 L377.8,400 L377.6,400.2 Z M378.2,402.5 L377.8,402.6 L377.3,401.8 L377,401.3 L377.3,401.2 L377.5,401.3 L377.7,401.5 L377.7,401.7 L377.8,401.9 L378,402.2 L378.2,402.5 Z M372.6,393.6 L372.7,394 L371.7,393.8 L370.9,393.3 L370.3,392.3 L369,391.2 L369,390.9 L369.5,390.6 L370.6,390.4 L371,390.6 L371.3,390.8 L371.4,391 L370.8,391.5 L370.6,391.7 L371.1,392.1 L371.1,392.2 L371.3,393 L371.5,393.3 L372.1,393.5 L372.6,393.6 Z M400.1,397.4 L400.6,398.3 L401,398.6 L402,398.9 L402.4,399 L403.9,399.6 L405.8,399.7 L406,399.9 L406.2,400.4 L406.6,400.8 L406.7,401.1 L406.5,401.4 L406.8,402.4 L407.2,403.4 L407.9,403.8 L408.8,404 L409.6,403.9 L409.8,404.1 L409.7,405 L409.4,405.3 L409.1,405.4 L408.9,405.3 L408.6,405.1 L408.4,405 L407.9,405 L407.6,404.6 L406.7,404.2 L406.6,403.9 L406.5,403.5 L406.1,403.2 L405.8,402.6 L405.5,402.4 L405.3,402.1 L405.3,402 L404,401.9 L403,401.9 L402.1,401.6 L401.8,400.7 L401.3,400.5 L400.9,400.2 L400.6,399.9 L399.7,399.2 L398.8,398.7 L397.9,398.3 L396.9,398.1 L396.1,398.4 L395.7,398.3 L395.6,398.1 L396.6,397.8 L397.9,397.1 L398.8,396.8 L399.3,396.8 L400.1,397.4 Z M403.1,396.2 L402.8,396.4 L402.2,396.3 L401.6,395.4 L403.1,396.2 Z M404,395.8 L403.6,395.9 L404,395.3 L404.7,394.9 L404.4,395.5 L404,395.8 Z M410.5,398.6 L409.7,398.8 L409.4,398.8 L409.6,398.6 L409.6,398.5 L408.8,398 L408.9,397.4 L409,397.2 L409.6,397.6 L409.8,398.1 L410.5,398.6 Z M411.4,383.9 L410.3,384.2 L409.2,383.6 L409.2,383.3 L409.8,382.6 L410.1,382.4 L410.9,382.5 L411.4,382.9 L411.5,383.1 L411.3,383.5 L411.4,383.9 Z M401.2,405.7 L400.9,405.9 L400.6,405.9 L400.3,405.8 L400.2,405.7 L400.3,405.6 L400.5,405.3 L400.7,405.2 L401,405.2 L401.1,405.4 L401.2,405.7 Z M397.1,419.4 L397,419.7 L396.2,419.5 L396,419.2 L395.9,418.4 L396.1,418 L396.3,417.9 L396.7,418.3 L397.5,418.9 L397.1,419.4 Z M431.2,425 L430.9,425.4 L430.6,425.1 L430.7,424.7 L430.3,424 L431,423 L431,422.5 L431.6,422.3 L431.5,423.1 L431,423.7 L431.5,424.3 L431.7,424.9 L431.2,425 Z M429.9,413.4 L429.1,413.5 L429.2,412.9 L428.8,412.4 L429.5,412.6 L429.9,413 L430.1,413 L430,413.2 L429.9,413.4 Z M429.3,415.2 L429.1,415.2 L429.4,414.8 L430.2,414.3 L431.5,413.8 L431.9,413.8 L432.7,414.1 L431.3,414.5 L431,414.8 L430,414.8 L429.3,415.2 Z M417.7,413.3 L417,413.6 L416.5,413.2 L416.2,412.5 L417.6,411.5 L417.9,411.6 L418.1,411.8 L418,412.7 L417.7,413.3 Z M415.5,412.5 L414.9,413.1 L414.3,413 L414.1,412.8 L414.4,412.2 L415.2,411.9 L415.5,412 L415.5,412.4 L415.5,412.5 Z M417.2,417.8 L416.8,418.2 L416.3,418.1 L416.5,417.9 L416.6,417.7 L416.6,417.4 L416.5,417.2 L416.6,417.2 L417.1,417.5 L417.2,417.8 Z M416.4,415.6 L416.2,415.7 L415.6,415.2 L415.4,414.9 L415.7,414.7 L416.6,415.3 L416.4,415.6 Z M428.3,406.6 L429.3,406.9 L429.6,406.9 L430.1,406.9 L430.2,407.4 L429.6,407.5 L428.5,408 L428,407.9 L427.4,407.5 L426.6,407.4 L426.3,407.3 L426.8,406.9 L427.6,406.6 L428.3,406.6 Z M421.7,408.9 L421.3,408.9 L421.5,408.6 L422.2,408 L423.2,408 L424.2,407.7 L424.4,407.7 L423.9,408.1 L423.2,408.6 L421.7,408.9 Z M420.3,414.7 L419.6,414.8 L419.4,414.7 L419.8,414.6 L420.1,414.4 L420.3,414.2 L421,413.9 L421.5,413.5 L422,413.8 L421.3,414 L420.3,414.7 Z M425.3,416.3 L424.7,416.5 L424.2,416.9 L423.7,416.6 L423.7,416.2 L424.3,416.3 L424.7,416.1 L424.5,415.9 L425,416 L425.3,416.3 Z M407.9,408.5 L407.3,408.9 L407.2,408.3 L407.6,407.7 L408.1,407.7 L408.3,407.9 L407.9,408.5 Z M408.6,410.3 L408.1,410.6 L408.3,410 L408,409.7 L408.2,409.5 L408.5,409.3 L408.7,409.5 L408.9,409.8 L408.6,410.3 Z M409.4,414.9 L409.4,415.4 L409.4,415.5 L407.7,415.7 L407.8,415.2 L407.9,415.1 L408.5,415.3 L408.7,415.2 L408.8,415 L409.4,414.9 Z M412.8,409.2 L412.7,410 L412.5,410 L412.4,409.8 L412.4,409.5 L412.5,409 L412.8,409.2 Z M413.2,407 L412.9,407.6 L412.3,406.9 L411.6,406.5 L411.3,406.1 L410.9,405.9 L410.8,405.4 L411.3,405.2 L411.5,405.2 L412,405.8 L412.9,405.9 L412.8,406.3 L413,406.7 L413.2,407 Z M415.3,408.3 L415,408.8 L414.5,408.7 L413.6,408.2 L413.3,407.9 L413.2,407.7 L413.6,407.7 L414,407.9 L415.1,408.1 L415.3,408.3 Z M410.9,413.7 L410.8,413.7 L410.5,413.4 L410.5,413.1 L410.6,412.9 L410.9,412.9 L411.3,413.4 L410.9,413.7 Z M422.3,403.4 L421.5,403.8 L420.6,403.2 L420.5,403 L421.1,402.7 L421.4,402.3 L421.2,401.8 L420.2,401.1 L420.2,400.5 L421.6,400.3 L422.4,400.8 L422.8,400.8 L422.7,401.2 L422.7,401.4 L422.8,402.7 L422.4,402.9 L422.3,403.3 L422.3,403.4 Z M424.9,394.4 L424.7,394.9 L425.9,395.7 L426.3,396.2 L426.4,396.7 L426.3,396.8 L425.9,396.6 L425.5,396.5 L425.6,396.8 L426,397.1 L425.4,397.3 L424.7,397.3 L422.8,396.9 L422.4,396.4 L423.5,395.8 L423.8,395.5 L423,395.5 L422.1,396.3 L420.7,396 L420.3,395.6 L420.2,395.5 L420.8,394.8 L421.7,394.8 L422.2,394.6 L422.8,394.4 L422.9,394.1 L424.4,394 L424.9,394.4 Z M418.9,385.4 L418,385.6 L416.9,385 L417.9,384.7 L418.4,384.9 L418.7,385.1 L418.9,385.4 Z M416.8,389.1 L416.5,389.4 L416.3,389.8 L416.2,390.5 L415.7,390.5 L415.4,390.4 L415.3,390.1 L415.3,389.8 L415.1,389.8 L414.9,390.2 L414.7,390.3 L414.3,390.4 L413.7,390.2 L413.8,389.7 L413.6,389.1 L413.7,388.9 L415.2,388.9 L415.6,389.3 L416.1,389.1 L416.3,388.8 L416.9,388.7 L416.8,389.1 Z M416.6,409.7 L415.8,409.8 L415.8,409.2 L416.1,409 L417,409.3 L417,409.5 L416.6,409.7 Z M409.3,412.1 L409,412.2 L408.5,412 L408.6,411.6 L408.9,411.4 L409.3,411.5 L409.4,411.7 L409.3,412.1 Z M436.7,421.4 L436.1,421.6 L435.9,421.6 L435.7,421.2 L436,420.3 L435.7,419.8 L435.7,419.5 L436.2,419.2 L436.5,418.7 L437.3,418.2 L439.4,417.6 L439.9,417.5 L439.9,418 L439.2,419.2 L438.6,419.9 L438.8,420.4 L437.7,420.5 L436.7,421.4 Z M403.7,424.5 L404.3,424.5 L405.1,424.5 L405.3,424.5 L405.7,424 L406.3,424 L406.6,424.5 L406,424.7 L405.8,424.8 L406,424.9 L406.4,425 L407.1,425 L407.1,425.3 L407.2,425.6 L407.5,425.8 L407.9,425.8 L408.6,425.8 L409.4,425.7 L410.1,425.4 L410.9,425.3 L413.3,425.4 L414.1,425.9 L415.7,426 L417.2,426.2 L417.9,426.1 L419.3,425.9 L419.5,426.1 L419.3,427.2 L419.4,427.5 L419.8,427.6 L420.1,427.6 L420.6,427.2 L421.7,426.9 L422.9,426.9 L423.8,426.2 L424.1,426.2 L424,426.5 L423.8,427.4 L423.6,427.9 L423.5,428.2 L422.9,428.4 L421.9,428.5 L420.1,428.4 L418.3,428.5 L414.9,428.9 L411.6,429.1 L411.1,429 L411.1,428.5 L411,428.1 L410.8,427.9 L409.8,427.7 L408.8,427.4 L404.9,426.9 L404,426.7 L402.5,426.8 L402,426.8 L401.6,426.6 L401.3,426.3 L401.2,425.4 L401.4,424.5 L401.7,424.2 L401.9,424.5 L402.2,424.6 L402.6,424.4 L402.6,423.9 L402.8,423.5 L403.1,423.7 L403.3,424.3 L403.7,424.5 Z M424.1,374.7 L424.9,374.8 L425.3,375.1 L425.6,375.4 L426,375.6 L426.3,375.7 L426.5,376.4 L426.6,377.3 L426.5,377.7 L425.9,377.8 L424.2,378.7 L424.2,379.5 L424.2,379.9 L424.2,380.1 L424.4,380.4 L424.4,380.7 L424.2,381.1 L423.5,381.6 L423,382.1 L422.4,382.8 L422.1,382.8 L421.8,382.9 L421.6,382.6 L420.3,382 L417.3,381.6 L415.9,381.2 L415.3,381.2 L414.1,380.7 L413.3,381 L411.5,381.9 L410.6,381.8 L409.6,381.2 L408.9,381.1 L408.1,381.4 L406.9,382.5 L405.6,383 L404.5,382.8 L403,382.8 L402.8,383.4 L403.1,383.8 L403.9,384.5 L403.6,385 L403.9,385.5 L404.4,385.6 L405.2,385.6 L406.7,386.2 L407.4,387 L407.8,387.7 L406.9,387.2 L406.3,386.6 L405.4,386.4 L404.2,386 L403.5,385.9 L402.7,386.2 L402.6,386.6 L403.5,387.3 L404.3,387.7 L404.7,388 L405,388.7 L404.8,389 L404.5,389.2 L403.6,388.8 L402.2,387.1 L400.2,386.8 L399.9,387.1 L400.3,388 L400.6,388.3 L402.3,389.3 L402.1,389.5 L401.9,389.6 L400,389 L399.4,388.2 L399.3,387.2 L397.5,386.4 L395.9,385.7 L395.5,384.9 L395.8,384.6 L396.1,384.1 L395.1,384.2 L394.6,384.5 L393.6,384.9 L393.6,385.4 L393.7,385.9 L393.4,386.7 L393.1,388 L393.3,388.6 L395.3,390.6 L396,392 L396.5,392.5 L397.5,393.1 L398.6,394.2 L399.1,394.8 L399.4,395.7 L398.5,396.2 L398,396.3 L397.7,396 L398.1,395.4 L398,395 L396.6,394.4 L396,394.6 L395.4,395 L395.8,395.7 L396.2,396.2 L396.4,396.8 L397.2,396.8 L396.1,397.5 L395.1,397.9 L394,397.9 L393.4,398 L393.1,398.2 L393.7,398.3 L394.1,398.3 L394.8,398.7 L396.9,399.2 L397.8,399.8 L398.8,399.8 L399.7,400.9 L401.4,401.2 L402.3,402.3 L403.6,402.5 L404.7,402.9 L405,403.3 L405.2,404 L405.2,405.5 L405.5,406.6 L405.5,406.9 L405.4,407.4 L405.1,407.7 L404.7,407.7 L403.9,406.9 L402.8,406.1 L401.5,405 L401.1,404.9 L400.8,404.8 L400.2,405.2 L398.3,405.5 L397.4,405.8 L397.1,405.9 L397,406.1 L397.4,406.3 L397.9,406.8 L397.9,407.4 L398.3,408.1 L398.9,408.3 L399.6,408.3 L400,408.5 L400.1,408.8 L400.5,409.1 L400.8,409.4 L400.7,409.6 L398.8,410.1 L398.4,410.3 L398,410.4 L397.5,410.2 L397.5,409.6 L396.8,409.3 L396.2,409 L395.5,408.8 L394.8,408.4 L394.4,408.8 L394.8,409.9 L395.5,410.8 L396.7,412.9 L397.2,414.2 L397.3,414.8 L397,415.8 L397.6,416.6 L398,417.4 L397.6,417.4 L397.2,417.1 L396.6,416.8 L395.3,415.5 L394.9,414.7 L394.4,414.7 L393.5,414.8 L392.5,416.4 L392.5,417.4 L392,417.2 L391.5,416.9 L391.6,415.8 L391.5,415.4 L390.3,414 L389.8,413.8 L389.5,413.3 L389.1,412.8 L388.5,412.9 L388.1,413.1 L387.9,413.9 L387.9,414.6 L387.6,415.1 L386.3,414.1 L385,412.4 L385,411.5 L385.9,410.6 L385.8,410 L384.9,408.8 L383.6,408 L382.9,407.7 L382.6,406.9 L381.9,406.5 L381.3,406.3 L381.2,406 L381.4,405.8 L382.7,404.9 L383.5,403.6 L383.9,403.5 L384.7,403.8 L385.6,403.7 L386.4,402.9 L387,402.5 L388.1,402.6 L390.4,403.6 L393,404.2 L394.3,404.8 L395,405.3 L395.4,405.4 L396,405.5 L396,405.1 L395.8,404.7 L396.3,404.5 L397.7,404.5 L398,404.3 L398.2,404.1 L397.9,403.7 L397.5,403.6 L397,403.5 L396.7,403.4 L396.1,403.5 L395.3,403.3 L394.9,403 L394.7,402.8 L393.3,402.4 L391.9,401.6 L391.6,402 L391.1,402.3 L390.3,402.3 L388.1,401.8 L386.8,402.2 L386.1,402.3 L385.5,402.3 L384.8,402.5 L384.1,402.6 L383.4,401.9 L383.1,401.3 L382.9,401.2 L382.9,401.7 L382.7,402.1 L381.7,402.4 L381.1,402 L380.6,401.1 L380.1,399.9 L379.1,398.9 L378.3,398.6 L378.2,398.1 L378.3,397.7 L379.3,397.6 L380.8,398 L381.1,397.9 L381.4,397.7 L381.4,397.3 L381.2,396.9 L380.7,396.8 L380.4,396.9 L379.5,396.8 L378.4,397 L377.8,396.8 L377.6,396.5 L376.6,395.9 L375.8,395 L374.4,394.4 L373.5,392.7 L372.7,391.9 L371.9,391.3 L372.1,391.3 L372.4,391.4 L373,391.7 L373.6,391.8 L374,391.6 L374.2,391.4 L374.3,391.1 L374.3,390.7 L374.4,390.6 L374.9,390.7 L375.1,390.6 L375.1,390.2 L374.8,389.8 L374.5,389.3 L374.5,389.1 L374.7,389 L375.1,388.8 L375.3,388.5 L375.7,388.4 L376.2,388.4 L376.9,388.3 L377.3,388 L377.4,387.7 L377.7,386.9 L377.8,386.5 L378.1,386.2 L378.3,385.7 L378.6,385.3 L379.2,385.1 L379.8,384.9 L380.2,384.3 L380.4,383.8 L380.4,383.5 L380.1,383 L379.8,382.5 L379.9,381.9 L381,381.9 L381.4,381.8 L382.8,381.8 L383.5,381.4 L384,381.5 L384.9,381.8 L385.3,381.5 L386.6,381.1 L387.8,379.8 L388.4,379.6 L389.6,379.5 L390,379.4 L390.4,379.4 L391.7,379.6 L392.5,379.7 L393.4,379.5 L394.4,379.2 L394.7,378.1 L394.9,377.9 L395.5,377.9 L396,377.9 L396.9,378 L398,378 L398.7,377.5 L399.8,377.4 L400.3,377.3 L401.1,377.5 L402,377.4 L403,377.2 L404,376.9 L404.7,376.9 L405,376.8 L405.2,376.8 L405.4,376.3 L406.9,376.2 L407.4,376.3 L408.2,376.3 L409,376 L409.2,376.1 L409.7,376.8 L409.9,377 L410.3,377.2 L411.4,377.7 L411.5,377.6 L411.9,377.4 L413.2,377.6 L414.3,378 L415.3,378.6 L416.4,378.5 L417.6,378.2 L418.4,378.1 L419.2,378 L419.7,377.9 L420.8,378.1 L422,377.7 L422.6,377.5 L422.8,377 L422.7,376.3 L422.4,375.6 L422.1,375.3 L422,375 L422.2,374.8 L422.4,374.6 L423.1,374.4 L424.1,374.7 Z",
      "hr": "M318.8,341.7 L319.1,342 L321.3,342.5 L321.8,342.3 L322.1,342 L322.1,341.8 L322.2,341.7 L323,342 L323.6,341.9 L324.7,341.9 L325.4,342 L325.8,341.8 L326.5,341 L326.7,340.5 L327,340.4 L327.2,340.5 L327.3,340.8 L327.7,341.2 L328.4,341.7 L328.9,342 L329.3,342.1 L329.7,341.9 L330.2,341.8 L331.5,342.2 L332.6,342.3 L333.4,342.1 L333.3,341.8 L333,341.4 L332.9,341.1 L333,340.8 L333.5,340.5 L333.5,340.4 L332.8,339.8 L332.9,339.7 L334.3,339.1 L335.8,338.8 L336,338.5 L336.1,338.2 L336.2,337.5 L336.1,336.9 L335.5,336.3 L335.5,336 L335.6,335.8 L335.8,335.5 L336.4,335.4 L337.1,335.2 L337.6,335 L338.3,334.8 L338.8,334.5 L339.4,333.9 L339.7,333.8 L340.7,333.9 L340.9,333.8 L340.8,332.9 L341,332.7 L341.3,332.6 L341.5,332.4 L342.4,332.5 L343.1,332.8 L343.5,332.9 L345,333.5 L346,334.2 L346.6,335 L347.4,335.6 L348.3,336 L349.1,336.6 L349.7,337.3 L350.5,337.7 L351.5,337.8 L352.1,338.1 L352.4,338.5 L352.9,338.9 L353.8,339.2 L355.1,339.4 L357.6,339.4 L357.8,339.4 L358.3,339.5 L359,339.4 L359.8,339.1 L360,339 L360.9,338.1 L361.3,338.2 L362.3,338.1 L362.8,337.9 L362.9,337.9 L362.8,338.1 L362.8,338.5 L362.3,338.8 L362.8,339.4 L363.2,340.4 L362.9,340.9 L363.2,341.3 L364.1,341.6 L364.2,341.7 L363.9,341.8 L363.7,342.1 L363.7,342.7 L364.4,343.3 L365.9,343.8 L366.4,343.9 L366.5,344.1 L366.8,344.2 L366.9,344.4 L367,344.6 L366.8,344.7 L366.1,344.8 L365.3,344.8 L364.8,344.5 L364.7,344.7 L364.7,344.9 L364.2,345.1 L364.5,346.5 L364.3,346.9 L364.1,347.1 L364,347 L363.7,347 L363.6,347.1 L363.7,347.4 L363.2,347.5 L362.3,347.3 L361.9,347 L361.8,346.7 L361.8,346.5 L361.5,346 L360.9,345.6 L359.4,345.5 L358.9,345.4 L358.3,345.2 L357.7,345.1 L357.2,345.1 L356.5,345.2 L355.3,345 L354.9,345.3 L354.3,345.6 L353.8,345.6 L352.8,344.9 L352.5,344.8 L351.6,345.2 L351.3,345.2 L351,345.1 L349.8,344.8 L349.3,344.8 L348.8,344.9 L348.2,344.7 L346.4,343.8 L345.4,344.5 L343.2,344.3 L342.6,344.8 L341.9,345.8 L341.3,346.2 L340.8,346 L340.2,345.6 L339.1,344.6 L338.5,344.4 L337.9,344.3 L337.4,344.5 L337.1,344.7 L336.9,346.2 L336.7,347.5 L336.7,348.4 L337.9,349.1 L339.3,350.4 L339.7,350.5 L339.9,350.9 L340.2,352 L340.6,353.2 L341.3,354 L342,354.6 L342.7,355.1 L343.7,355.8 L344.5,356.7 L344.7,357 L346.3,358.1 L347.8,359.3 L349.2,359.7 L349.4,359.9 L349.4,360.8 L349.5,361.1 L350.4,362 L352.3,363.4 L352.5,363.7 L352.5,363.9 L352.4,364.1 L351.9,364.3 L351.6,364.1 L349.8,362.8 L348.2,361.9 L346.3,360.4 L343.8,359.8 L342.1,359.1 L341.1,359.2 L339.9,359.4 L339.2,359.4 L338.7,359.3 L338.4,358.8 L338.4,358.5 L338.4,358.1 L337.4,357.4 L336,356.7 L334.7,355.9 L332.1,353.6 L331.6,352.8 L332.1,352.7 L332.5,352.7 L332.9,352.6 L333.6,352.6 L334.5,352.7 L333.7,352.2 L332.8,351.7 L330.4,349.8 L329.7,348.9 L329.6,347.9 L329.8,346.5 L329.4,345.6 L327.5,344.3 L326.9,343.6 L325.5,343.2 L324.9,343.3 L324.5,343.8 L324.3,344.9 L323.1,346.3 L322.7,346.9 L322,347.7 L321.5,347.8 L321.2,347.7 L320.2,346.4 L319.2,345.3 L319.1,344.8 L319,344.2 L318.3,342 L318.8,341.7 Z M344.2,363.8 L345.7,364 L346.9,363.9 L347.9,364.1 L348.5,364.3 L348.7,364.5 L347.8,364.5 L346.9,364.4 L345.9,364.7 L344.9,364.5 L344.6,364.3 L344.4,364.1 L344.2,363.8 Z M348.7,362.7 L348.1,362.8 L344.5,362.7 L343.4,362.5 L342.2,362.1 L341.9,361.9 L343.2,361.8 L344.3,361.9 L344.6,362.2 L347.6,362.5 L348.7,362.7 Z M345.3,361.4 L344,361.4 L342.9,361.3 L342.3,361 L342.4,360.8 L342.6,360.4 L343.8,360.5 L345.7,360.7 L346.2,361 L346.1,361.2 L345.3,361.4 Z M332.5,354.5 L332.6,354.8 L331.6,354.3 L331.2,353.9 L331.1,353.7 L332.5,354.5 Z M329,346.5 L328,346.7 L327.5,346.3 L327.4,346 L326.5,346 L326,345.6 L325.9,345.4 L326.6,345 L327,344.3 L327.5,344.7 L328.1,345.5 L328.4,345.7 L329,346.5 Z M329.2,348.4 L329.4,348.8 L328.6,348.4 L327.9,348.3 L327.8,348 L327.9,347.8 L328,347.6 L328.6,347.6 L328.6,347.9 L329.2,348.4 Z M332.1,352.1 L331.9,352.4 L331.4,351.9 L330.9,351.6 L330.5,351.3 L329.9,350.8 L329.6,350.3 L328.6,349.2 L328.4,349 L329,349.4 L329.4,349.7 L329.7,349.7 L330.6,350.4 L331.5,351.3 L332.6,352 L332.3,352 L332.1,352.1 Z M332.2,355.8 L332.3,355.9 L332.2,356 L331.8,355.9 L331.7,355.9 L329.7,354 L329.5,353.6 L330.2,354.1 L332.2,355.8 Z M333.6,355.3 L334.2,356 L333.7,355.8 L333.1,355.4 L332.8,355 L333.6,355.3 Z M326.3,349.3 L326.3,349.6 L325.8,349.2 L325.5,348.4 L324.9,347.2 L324.8,346.8 L325.1,346.4 L325.1,346.1 L324.7,345 L325,344.8 L325.3,344.8 L325.4,345.6 L325.6,346 L326.2,346.5 L326.1,347.4 L326.2,348.7 L326.3,349 L326.3,349.3 Z M352.1,365.7 L353.2,366.3 L349.9,365.6 L350.3,365.5 L350.7,365.5 L352.1,365.7 Z M359,367.5 L359,367.8 L359.3,368.2 L359.6,368.6 L358.1,367.8 L356.7,366.9 L353.9,365.5 L351.9,365.2 L349.2,364 L347.5,363.6 L348.2,363.5 L348.9,363.5 L353.1,365 L352.6,364.6 L353.2,364.5 L353.7,364.6 L354,365.1 L354.7,365.4 L355.7,366 L356.4,366.4 L357.9,367.2 L358.2,367.3 L359,367.5 Z",
      "hu": "M389.5,315 L390.3,315 L390.3,315 L390.5,315 L390.6,315.5 L390.7,315.5 L390.9,315.8 L391.1,316.2 L391.3,316.5 L391.9,316.6 L392.7,316.9 L393.2,317.6 L394,317.9 L394.1,317.9 L394.2,317.9 L394.8,317.8 L394.9,318 L395.3,318.3 L395.5,318.6 L395.4,318.9 L395.5,319.2 L395.7,319.4 L395.5,319.6 L394,320.7 L393.5,321.1 L393.1,321.1 L392.5,321 L391.9,321.1 L391.3,321.3 L390.8,321.4 L390.5,321.7 L390,322.3 L389.4,322.9 L388.7,323.2 L388.4,323.5 L388.4,324.5 L388.1,324.8 L387.6,325.1 L387.3,325.4 L386.7,326.9 L386.1,327.4 L385.6,327.8 L385.6,328.1 L385.6,328.5 L385,329.3 L384.2,330.1 L384.1,330.4 L384.3,330.9 L383.6,331.4 L383.1,331.7 L382.8,331.8 L382.6,332.1 L382.3,332.9 L382.3,333.2 L382.3,333.6 L381.7,333.7 L381.6,334.1 L381.4,334.5 L381.2,334.7 L380.5,335.1 L378.8,334.9 L378.2,335.1 L378,335.3 L378,335.5 L377.8,335.7 L377.4,336 L377,336.1 L376.1,335.8 L374.2,336.1 L373.9,336.3 L373.6,336.2 L373.2,336 L371.4,335.8 L370.6,336 L369.6,335.9 L368.7,335.8 L368,335.9 L367.4,336.5 L367.1,336.7 L366.9,336.9 L366.4,337 L365.9,337.3 L365.4,337.5 L364.8,337.4 L364.3,337.2 L364.2,337.2 L364,337.5 L363.8,337.7 L363,337.9 L362.9,337.9 L362.8,337.9 L362.3,338.1 L361.3,338.2 L360.9,338.1 L360,339 L359.8,339.1 L359,339.4 L358.3,339.5 L357.8,339.4 L357.6,339.4 L355.1,339.4 L353.8,339.2 L352.9,338.9 L352.4,338.5 L352.1,338.1 L351.5,337.8 L350.5,337.7 L349.7,337.3 L349.1,336.6 L348.3,336 L347.4,335.6 L346.6,335 L346,334.2 L345,333.5 L343.5,332.9 L343.1,332.8 L343,332.6 L342.3,331.8 L342,331.5 L342,331.1 L341.9,330.9 L341.6,330.7 L341.5,330.2 L341.4,329.8 L341.2,329.5 L339.6,329.4 L340.9,328.4 L341.6,328.1 L342.4,328.2 L342.6,328.1 L342.7,328 L342.8,327.6 L342.9,327.3 L342.9,327 L342.8,326.9 L342.5,326.8 L342.3,326.1 L342.5,325.8 L342.7,325.6 L342.4,324.8 L342.5,324.5 L343.1,324.4 L343.6,324.2 L344,324 L344.1,323.8 L344.4,323.2 L344.1,322.5 L342.4,322.1 L342.3,321.9 L342.7,321.7 L343.2,321.4 L343.4,321.2 L343.7,321.2 L344.2,321.3 L345,321.8 L345.3,321.9 L345.7,321.7 L346,321.7 L346.9,321.7 L347.7,321.6 L347.5,321.1 L347.5,320.7 L347.4,320.4 L347.4,320.1 L347.7,319.8 L347.8,319.2 L348.3,318.8 L348.5,318.8 L349.4,318.8 L349.6,318.9 L349.7,319 L351.1,319.9 L352.4,320.6 L353.4,321 L354.9,321.1 L356.6,321.1 L359.3,321 L361.4,320.9 L361.5,320.7 L361.8,320.2 L361.5,319.9 L361.6,319.4 L361.9,318.9 L362.9,318.4 L365.8,318.2 L367.5,317.8 L367.7,317.3 L368.3,316.9 L368.8,316.8 L369.5,317 L370.3,317.4 L371.1,317.6 L371.5,317.5 L373,316.8 L374.7,316.1 L375.8,314.2 L375.9,313.9 L377.2,313.7 L379.1,313.7 L380,314 L380.7,314.1 L381.8,314.1 L383.3,313.6 L383.9,313.7 L384.3,313.9 L384.8,314.2 L385.1,314.5 L385.4,314.9 L385.5,315.1 L385.7,315.3 L386.1,315.6 L386.5,315.7 L389.3,315.2 L389.5,315 Z",
      "ie": "M124.4,259.7 L124.4,260.1 L123.7,259.7 L123.4,259.3 L121.8,259.1 L122.5,258.6 L122.8,258.8 L124,258.8 L124.3,259 L124.4,259.7 Z M146.9,247 L145.6,247.7 L145.5,247.9 L145.1,249 L145,249.3 L144.6,249.9 L144.2,250.5 L143.8,250.8 L143,251 L142.7,251.1 L142.2,251.1 L141.6,251.1 L141.2,251.3 L141.3,251.5 L141.4,251.6 L142,251.9 L142.6,252.2 L142.5,252.4 L142.2,252.7 L140.1,253.3 L139.5,253.7 L139.3,253.9 L139.5,254.4 L141.2,255.6 L141.4,255.8 L141.7,256.5 L143.2,256.8 L143.8,257.3 L144.3,257.4 L145.4,257.3 L145.8,257.5 L146.1,257.4 L146.2,257.2 L147.2,256.5 L147.5,256.2 L147.3,255.9 L147.1,255.6 L147.7,255 L148.3,254.4 L148.7,254.4 L149.3,254.8 L149.8,255.3 L149.8,255.7 L149.9,255.9 L150.4,256.5 L150.7,256.7 L151.5,256.8 L151.7,257.1 L151.5,257.9 L151.6,258.2 L152.5,258.2 L153.4,258.1 L153.7,258.2 L154,258 L154.5,257.8 L155.2,257.9 L155.6,258.3 L155.7,258.6 L155.1,258.8 L154.5,258.7 L154.2,259 L154.1,259.4 L154.4,260.1 L154.8,260.5 L155.1,261.5 L155.4,262.6 L155.8,263.3 L155.9,264.1 L155.9,264.5 L156,265.3 L155.8,265.5 L155.9,266.2 L156.4,267.7 L156.6,268.4 L156.8,270.1 L156.4,270.8 L156,271.4 L155.6,272.1 L155.4,272.9 L155.2,274.1 L154.2,275.6 L153.7,275.9 L153.2,276.2 L154.4,277.2 L153.4,277.6 L152.4,277.8 L151.3,277.5 L150.6,277.6 L149.9,277.9 L149.7,278.1 L149.5,278 L149.1,277.2 L148.7,278 L148.1,278.3 L147,278.2 L145.1,278.5 L144.4,278.7 L144.1,279.1 L143.9,279.5 L143.6,279.8 L143.3,279.9 L141.8,280.2 L141.6,280.4 L140.9,281.1 L140,281.5 L139.3,281.6 L138.7,281.2 L138.4,281 L138.1,280.8 L137.1,280.9 L137.4,281 L137.6,281.3 L137.7,281.8 L137.6,282.4 L137.1,282.6 L136.6,282.7 L135.6,283.3 L134.4,283.4 L133.8,283.9 L129.8,284.8 L129.6,284.8 L129,284.6 L128.4,284.5 L127.8,284.6 L126.1,285.1 L125.3,285 L126.4,283.7 L127.8,283.1 L127.9,283 L127.4,282.9 L124.8,283.3 L123.9,283.7 L123,283.8 L123.4,283.2 L124.6,282.5 L125.2,282.1 L125.6,282 L126,281.5 L127.3,281 L123.3,282 L122.2,281.9 L122,281.6 L121.1,281.8 L120.9,281.1 L122,280 L122.8,279.5 L123.6,279.3 L124.4,278.9 L124.7,278.5 L124.3,278.3 L121.9,278.4 L120.7,278.3 L120.8,278 L121,277.6 L122.2,276.9 L122.9,276.8 L123.5,276.9 L124,277.1 L124.5,277.3 L125.8,277.1 L125.3,276.7 L125.2,275.9 L124.7,275.6 L125.3,275.2 L125.9,274.9 L127,274.1 L127.4,274 L129.5,273.8 L131.8,273.3 L134,272.7 L132.9,272.4 L132.3,271.9 L131.4,272.8 L130.8,273.2 L129,273.4 L128.4,273.3 L127.6,273 L127.3,273.1 L127.1,273.3 L125.9,273.7 L124.7,273.9 L126.1,273 L128,271.7 L128.4,271.2 L129,270.5 L128.8,270.1 L128.4,269.9 L129.7,268.4 L130.2,268.1 L131.1,268 L131.7,267.8 L132,267.8 L132.2,267.7 L132.8,267.2 L131.9,266.9 L131.1,266.8 L128.3,266.9 L128,266.9 L127.6,266.7 L127.4,266.5 L127.2,266 L127.1,265.9 L126.4,265.9 L125.8,266 L125.4,266 L125,265.8 L125.7,265.2 L124.8,265.1 L123.9,265.2 L123.2,265.1 L123.2,264.7 L123.5,264.4 L123.1,264 L123,263.6 L123.5,263.4 L123.9,263.5 L125,263.2 L126.3,263 L125.2,262.7 L124.7,262.5 L124.7,262.1 L124.8,261.7 L126.1,261.1 L127.5,260.9 L127.3,260.5 L127.5,260.1 L126.1,260 L124.7,260.3 L124.8,259.5 L125.2,258.8 L125.2,258.3 L125.2,257.8 L124.5,258 L124.4,257.3 L124.2,256.8 L123.2,257.2 L123.2,256.5 L123.5,256.1 L124,255.8 L124.5,255.9 L125.4,255.9 L126.3,255.6 L127.6,255.5 L129.6,255.6 L131,256.6 L131.4,256.4 L131.9,255.8 L132.2,255.7 L134.3,256 L135.6,256.3 L136,256.2 L135.8,255.6 L135.3,255.1 L135.9,254.5 L136.6,254.1 L137.1,253.9 L138.1,253.6 L138.6,253.4 L138.9,252.6 L139.4,251.9 L136.7,252.2 L134.2,251.5 L134.6,250.9 L135.1,250.6 L136.1,250.4 L136.1,250.1 L136.6,249.8 L137.4,249.2 L137.1,248.4 L137.2,247.8 L137.8,247.4 L138,246.8 L138.2,246.4 L139.4,246.2 L140.5,245.8 L140.8,245.9 L142.1,245.8 L142.6,245.9 L142.5,245.3 L143.3,245.2 L143.6,245.3 L143.7,245.8 L144.1,246.1 L144.1,246.6 L143.9,247.1 L143.5,247.4 L143.9,247.7 L143.3,248.3 L143.9,248.1 L144.8,247.5 L144.8,247 L144.6,246.4 L144.4,245.9 L144.5,245.3 L145,244.9 L146.3,244.7 L145.7,244 L146.2,244 L146.7,244.1 L147.5,244.6 L148.3,245 L149.1,245.4 L148.3,246 L147.3,246.5 L146.9,247 Z",
      "is": "M78.2,102.4 L79.1,102.5 L80.7,101.9 L81.3,101.6 L82.9,100.4 L83.8,100 L85.3,100.1 L86,100 L86,100.2 L85.1,100.6 L84.4,100.8 L83.4,101.5 L82.4,103.2 L81.7,104 L81.7,104.4 L82.6,105 L83.5,105.4 L84.4,105 L84.8,105.2 L85.1,105.6 L85.3,106.1 L85.4,106.6 L85.2,107.5 L84.7,108.5 L84,109.3 L84.1,109.6 L84.6,109.7 L87.4,109.2 L87.7,109.2 L87.8,109.5 L87.9,110 L88,110.4 L88.3,110.8 L88.2,111.2 L87,112.5 L88.4,111.7 L89.5,111.5 L91.5,111.8 L92.2,112.3 L92.7,113.1 L93.4,112.9 L93.6,112.9 L94.1,113.3 L94.1,113.8 L93.8,114.5 L93.7,115.1 L93.3,115.4 L92.7,115.6 L92.5,115.8 L92.8,116.3 L93.2,116.8 L93.8,116.8 L93.9,117 L93.9,117.3 L93.8,117.6 L93.6,117.8 L93.3,117.9 L92.9,118.2 L94.4,119 L94.5,119.3 L94.6,119.7 L94.5,120.1 L94.2,120.6 L93.8,120.9 L92.8,120.9 L92.1,121.2 L92.3,121.7 L92.3,122.4 L92.1,123.2 L91.3,124.3 L90.5,125 L89.8,125.3 L88.5,125.2 L87.7,124.9 L87.8,125.9 L87.1,126.5 L87.2,127 L87.5,127.3 L87.3,127.9 L87,128.6 L86.4,129.3 L85.7,129.7 L84.4,130.2 L83.2,131.1 L82.5,131.5 L80.5,131.4 L78.5,132 L75.8,133.2 L73.9,134.1 L72.4,135.2 L70.5,136.9 L69.1,137.7 L68.3,137.8 L66.7,138 L65.3,138.5 L60.9,139.3 L59.4,139.8 L59.2,140.3 L58.5,140.9 L58.5,141.1 L58.8,141.3 L58.8,141.6 L58.3,142.3 L57.2,142.9 L56.7,142.9 L56,142.4 L55.8,142.4 L55.7,142.5 L55.7,142.6 L56,143.2 L55.3,143.5 L52.4,144.2 L47.5,143.7 L45.6,143.1 L43.2,142.3 L41.7,142.1 L39.7,142 L38,140.9 L37.2,140.2 L37.2,139.9 L37.3,139.5 L37.4,139.3 L37.7,139.2 L38.3,139.2 L38.3,139.1 L37.9,138.5 L37.5,138.7 L36.4,139.5 L35.9,139.5 L35.3,139.1 L35.3,138.7 L34.1,138.5 L33,138 L31.9,137.3 L31.8,137.1 L32.3,136.7 L32.2,136.6 L31.8,136.5 L31,136.6 L29.9,137.5 L29.4,137.8 L21.7,138 L19.8,138.1 L19.4,138.2 L19.1,137.6 L18.8,136.3 L18.7,135.5 L18.7,135 L19,134.5 L19.4,134.6 L19.8,135 L20.2,135.6 L20.6,135.9 L23.2,135.2 L24.3,134.7 L24.8,134.3 L25.3,133.5 L25.9,133.1 L26.2,132.8 L26.7,131.6 L27.1,131.1 L27.5,130.7 L28.1,130.4 L29.2,130.3 L28.4,130 L27.7,130 L25.2,131.2 L24.4,131.2 L24.4,131 L24.8,130.7 L25.6,130.1 L25,130 L24.8,129.8 L24.8,129.2 L25.2,128.3 L27.2,127.1 L28,126.9 L28.2,126.6 L27.9,126.5 L27.5,126.3 L25.4,127.6 L23.9,128 L23.5,127.9 L22.7,127.5 L22.5,127.2 L22.1,126.7 L22.2,126.3 L22.9,125.4 L22.8,125.2 L22.3,125.1 L20.9,124.2 L18.8,124.3 L13.7,123.7 L12.6,124 L10.8,124.7 L9.8,125 L9.3,124.8 L8.8,124.4 L8.4,123.9 L8.1,123.2 L8.2,122.7 L8.9,122.4 L9.4,122.3 L10.8,122.4 L12.5,121.9 L13.6,121.8 L13.9,121.7 L14.6,121.2 L14.9,121.1 L15.4,121.3 L15.6,121.6 L17.4,121.1 L18,120.8 L18,120.6 L18.3,120.4 L19.1,120.7 L19.8,120.7 L20.7,120.5 L22.3,120.5 L25.7,120.4 L26.2,119.9 L26.4,119.5 L26.7,118.5 L26.6,118.3 L24.5,119.3 L24,119.2 L21.5,118.7 L20.6,118.2 L20.9,117.7 L22.2,116.8 L23.6,116 L25.6,115.1 L26,114.8 L26.1,114.4 L24.8,113.7 L22.2,113.9 L21.6,113.1 L19.5,112.6 L18.1,112.9 L17.3,112.4 L15.5,113.1 L11.5,114.1 L9.9,114.8 L9.1,115 L8.1,114.5 L6.4,113.8 L4.5,113.6 L4.3,113.2 L5.4,112.1 L6.2,111.9 L7,112 L8.4,112.8 L9.5,113 L8.2,111.8 L8.2,111.4 L8.1,110.7 L7.7,110.4 L7.3,109.6 L7.5,109.4 L8,109.3 L9,109.6 L11.5,110.9 L12.6,110.7 L13.3,110.2 L14.2,109.8 L13.9,109.6 L11.8,109.6 L10.7,109.3 L10.1,109 L9.6,108.3 L9.8,108 L10.4,107.7 L12.2,107.8 L11,106.7 L10.2,106 L10.1,105.7 L10.2,105.3 L10.3,105 L10.4,104.9 L12.5,105.6 L12.9,105.6 L12.5,105.2 L11.6,104.5 L11.6,104.3 L12,104.1 L12.1,103.7 L12.2,103.4 L12.8,103.2 L13.4,103.1 L14,103.4 L16,104.6 L16.3,105 L16.4,105.4 L16.3,106 L16.4,106.2 L17.1,106 L17.8,106.3 L18.1,106.2 L18.8,105.4 L19.3,105.6 L19.7,106 L19.8,106.3 L19.8,106.8 L19.7,107.9 L19.7,108 L20.2,107.4 L21.2,107.4 L21.3,107.1 L21.3,106 L21.2,105.1 L21.1,104.9 L18.1,103.6 L17.6,103.3 L17,102.6 L17.1,102.4 L17.7,102.1 L18.6,101.9 L20.6,102 L20.8,101.8 L20.4,101.5 L19.5,101.3 L19.2,101.1 L19.1,100.7 L18,100.9 L16.7,100.9 L15.6,100.7 L15.5,100.4 L16,100 L17,99.3 L17.4,99.1 L18.8,99.2 L20.2,99 L21.3,99.3 L22.1,100 L23.4,101.2 L25.1,102 L25.2,102.2 L26.1,102.9 L27.9,104.6 L29.7,105.6 L29.8,105.8 L29.5,106.1 L28.8,106.5 L28.9,106.7 L29.9,106.9 L30.5,107.6 L30.6,107.9 L30,109.9 L29.7,110.4 L29.3,110.6 L27.6,110.2 L28,110.9 L29.2,111.6 L29.5,112 L29.3,112.3 L29.4,112.4 L29.9,112.2 L30,112.4 L30,113.1 L29.8,113.6 L29.5,114 L29.6,114.2 L30,114.1 L30.5,114.2 L31.1,114.8 L31.7,116.6 L32,117.1 L32.2,116.6 L32.4,115.3 L32.7,114.7 L32.9,114.7 L33.1,114.5 L33.2,114.1 L33.6,112.6 L34.7,111.5 L35.2,111.2 L35.7,111.1 L36,111.3 L36.8,112.4 L37.3,112.6 L37.6,112.5 L37.9,111.8 L38.4,110.3 L38.5,108.6 L38.2,106.8 L38.4,105.5 L38.9,104.6 L39.6,104.4 L40.5,104.7 L41.1,105.2 L42.4,107 L43.4,108 L44.2,109 L44.7,109.4 L45.5,109.5 L45.8,109.5 L45.9,109.2 L46,108.8 L45.8,106.2 L46.1,105.4 L46.4,104.8 L48,104.5 L48.8,104.1 L49.7,103.5 L50.3,103.2 L50.9,103.1 L51.4,103.4 L52,103.9 L52.9,104.9 L54.1,106.5 L55.6,107.7 L56.3,109.7 L56.5,110 L56.7,110 L56.9,109.8 L57,109.4 L57,108.6 L56.6,107.4 L55.2,104.5 L55.2,104 L55.4,103.5 L56.4,103.5 L58.6,103.7 L59.4,104.2 L60.9,106 L61.3,106.4 L61.6,106.5 L61.7,106.3 L62.3,106 L62.7,105.6 L63.3,104.6 L64.9,102.8 L65.2,102.8 L65.6,102.9 L66.4,103.4 L66.7,103.7 L67.4,104 L68.2,103.9 L69.2,103.3 L70.4,102.9 L70.8,102.1 L70.8,101.6 L69.9,99 L70.3,98.5 L72.3,97.8 L74.1,97.7 L74.5,97.9 L75.6,99.2 L76.4,99.9 L76.8,100.4 L76.8,101.5 L77.3,101.9 L78.2,102.4 Z",
      "it": "M264.6,338 L264.9,338.2 L265.5,338.4 L267.2,338.1 L268.2,337.8 L268.9,337.5 L269.4,337.6 L271,338 L271.5,337.8 L272.7,337.2 L272.9,336.8 L273.7,335.8 L273.8,335.6 L273.4,335 L273.5,334.9 L274.6,334.2 L275.2,333.6 L275.8,333.3 L276.2,333.3 L276.3,333.4 L276.4,333.7 L276.3,334.7 L276.5,335.1 L277.4,335.9 L278,336.3 L279.5,336.6 L279.5,336.8 L279.2,337.3 L280.1,338 L280.2,338.5 L280.6,338.8 L281.2,338.7 L281.4,338.4 L281.2,338 L281,337.5 L281,337.2 L281.2,336.8 L281.6,336.4 L282.7,335.3 L283.1,334.7 L283.1,333.7 L283.1,333 L283.5,332.8 L284.3,332.9 L284.5,332.9 L284.6,333.4 L285,334.1 L285.4,334.5 L285.8,334.6 L286.3,334.6 L287.5,334.2 L288.3,334 L288.7,334 L289,334.3 L289.6,335.2 L289.9,335.2 L290.3,335.1 L290.5,335 L290.3,334.7 L290.2,334 L289.9,333.5 L289.6,333.2 L289.6,332.9 L289.8,332.3 L290,331.8 L290.4,331.7 L290.9,331.7 L291.5,332.2 L292.3,332.3 L292.8,332.3 L292.9,332 L292.9,331.7 L292.6,331.3 L292.6,330.6 L293,329.4 L293.2,329.5 L294,329.5 L295,329.6 L295.5,330.1 L296.1,330.2 L296.9,330.3 L297.5,330.2 L297.7,330 L298.1,329.5 L298.6,328.8 L299.5,328.4 L301.1,328.3 L301.9,328.2 L302.7,328.2 L303.3,328.3 L303.9,328.3 L305.5,327.8 L307.2,327.4 L307.4,327.5 L307.5,327.6 L307.2,327.9 L306.9,328.3 L307.1,328.8 L308,329.7 L308.5,330.4 L309,330.9 L309.7,331.2 L310.7,331.4 L311.6,331.4 L312.5,331.6 L315.4,332.1 L316.9,332.2 L318.1,332.3 L319.8,332.6 L319.7,333.1 L319.3,333.2 L318.7,333.5 L318,334 L317.4,334.4 L317.2,334.9 L317.4,335.3 L317.5,335.4 L317.8,335.3 L318.1,335.3 L318.6,335.5 L319.3,335.7 L319.3,335.9 L319.1,336.1 L318.6,336.5 L318.1,336.9 L318,337.2 L318.1,337.4 L318.3,337.5 L319,337.5 L319.1,337.7 L318.8,338.8 L318.9,339 L319.5,339.2 L320,339.5 L320.9,340.2 L321.3,340.8 L321,341 L320.5,341.1 L320,341 L320.5,340.7 L319.2,339.4 L318.7,339.4 L317.9,339.9 L315.8,339.4 L315.3,339.6 L315,340 L314.3,340.6 L313.3,340.8 L312.1,341.4 L310.8,341.8 L309.9,342.2 L309.4,342.1 L310.2,341.4 L309.8,341.4 L308.7,341.9 L308.1,342.3 L307.8,343 L307.6,344.1 L308.1,344.4 L309,345.9 L310.1,346.6 L309.9,347.2 L309.6,347.6 L309,348.1 L308.4,347.8 L308.1,347.8 L307.8,348.7 L308.3,351.3 L309.1,353.1 L309.8,353.9 L311.5,355.1 L313.3,355.8 L316.5,357.8 L318.3,358.5 L318.7,358.8 L319.8,360.4 L320.7,362.2 L321.7,365 L322.4,366.4 L323.8,368 L326.8,370.2 L329.5,371.8 L332,372.8 L333.9,373 L338.5,372.8 L339.4,372.9 L340.2,373.2 L340.4,373.9 L340.1,374.3 L339.1,374.8 L338.1,375.5 L338,376.4 L338.9,377 L343.4,378.7 L348,380.2 L349.4,380.9 L351,382 L355,383.5 L355.7,384.3 L358.1,385.9 L359.2,387.1 L359.4,388.1 L358.9,389 L358.6,389.7 L358.2,390.4 L357.2,390.2 L356,389.5 L354.3,386.6 L351,386.4 L350.4,386.1 L349.2,385.7 L349.2,385.3 L348.9,384.9 L348.6,384.8 L347.4,384.7 L346.5,385.2 L345.5,386.3 L344.4,387.8 L343.2,390.1 L343.2,391 L343.8,391.9 L345.7,392.4 L347.1,393.2 L348,394 L348.1,396 L348.5,397.1 L347.9,397.7 L346.7,397.6 L345.1,398 L343.9,398.7 L343.5,399.4 L343.6,401.2 L343.3,401.8 L341.2,403.1 L340,404.4 L339.7,405 L339.3,405.6 L336.6,405.6 L335.9,404.8 L335.9,403.7 L336.4,403 L337.4,402.7 L338,401.2 L337.8,400.2 L338.3,399.7 L338.6,399.4 L339.4,399.2 L340.5,399 L340.6,397.6 L339.7,396.9 L339.4,396 L339,394.2 L337.6,392 L336.9,390 L336.3,389 L335.4,388.5 L333.8,388.5 L333,388.4 L330.2,387 L330,386.8 L330,386.4 L330.5,385.8 L330.2,385.1 L329.8,384.4 L329.3,383.7 L328.6,383.4 L327.4,383.6 L326.9,383.8 L326.1,383.7 L325.5,384 L325.1,384 L326.1,382.9 L325.8,382.7 L324.9,382.2 L323.5,382.2 L323.2,382.1 L322.9,382.4 L322.7,382.2 L322.7,381.8 L321.1,379.6 L320.1,378.7 L319.6,378.5 L318.6,378.7 L317,378.3 L316.1,378.3 L315.6,378.4 L314.8,378.6 L314.4,378.5 L314.2,378.2 L312.8,377.3 L311,376.7 L307.5,373.9 L306.4,372.8 L304.2,371.6 L302.8,369.8 L301.6,369.2 L300,368.7 L299.6,368.7 L299.1,368.9 L298.7,369 L298.4,368.7 L298.7,368.5 L299,368.4 L298.9,367.7 L297,366 L295.9,365.4 L295.6,365.1 L295.3,364.6 L295.1,364.3 L294.6,364.1 L294.1,364.2 L293.5,364 L293.5,363.2 L293.7,362.5 L293.6,362 L293,360.6 L291.9,359.3 L291.3,356.4 L290.8,355.5 L289.6,354.9 L287,354.2 L283.4,352.3 L282.6,352.3 L280.4,351.5 L279,351.4 L277.3,352 L275.1,353.9 L273.4,355.8 L272.8,356.2 L270.5,356.8 L268.5,357.1 L268.5,356.6 L268.5,356.3 L268.8,355.9 L269.3,355.4 L269.9,354.8 L270.1,354.4 L270,354.1 L269.7,353.6 L269.4,353.6 L267.5,354 L267.1,353.9 L265.7,353.3 L264.2,352.6 L263.6,352.1 L263.4,351.7 L263.6,351.3 L263.5,351 L263.2,350.6 L263.4,350.1 L263.9,349.5 L264.1,349.1 L264.5,349 L264.7,348.8 L264.4,347.8 L264.2,347.6 L264,347.5 L263.5,347.5 L262.8,347.3 L262.3,347 L262.2,346.5 L261.9,346.1 L261.4,345.7 L261.4,345.2 L261.9,345 L262.7,345 L263.2,345.1 L264.3,344.4 L264.7,344.3 L265.1,344.1 L265.4,343.2 L265.7,342.9 L265.7,342.7 L265.5,342.5 L264.6,341.8 L264.1,341.1 L263.5,340.3 L262.9,339.9 L262.7,339.6 L262.7,339.3 L262.9,339 L264,338.5 L264.6,338 Z M309.4,373.1 L309.4,373.1 L309.3,373.1 L309.3,373.1 L309.3,373.1 L309.4,373.1 Z M309.8,356 L310,355.5 L310,355.2 L309.4,355.2 L309.1,355.7 L309.3,356 L309.8,356 Z M292.5,365 L292.8,365.3 L292.8,365.5 L292.6,365.7 L292.7,366.2 L292,365.8 L291,366 L290.3,366 L290.2,365.6 L290.3,365.4 L291.3,365.3 L291.6,365.2 L292.2,365.3 L292.5,365 Z M321.8,383.1 L321.4,383.2 L321.2,383.1 L321.1,383 L321.3,382.7 L322,382.8 L322,383 L321.8,383.1 Z M306.2,415 L305.8,415 L305.3,414.8 L305.3,414.4 L305.3,414.3 L306,414.5 L306.2,414.8 L306.2,415 Z M335.3,403.4 L334.8,404.3 L334.5,404.6 L332.5,406.8 L332.3,407.3 L332.2,407.9 L331.9,408.4 L331.7,408.9 L331.4,409.4 L331.4,410.1 L331.6,410.4 L331.8,410.6 L332.2,410.8 L332.5,411.1 L332,411.4 L332.5,412 L333,412.3 L333,412.6 L333,412.9 L332.1,413.6 L331.8,413.9 L331.5,414.3 L331.4,414.7 L331.5,415.1 L331.5,415.5 L330.6,415.4 L329.7,415.2 L328.7,415.3 L327.4,414.9 L326.9,414.8 L326.5,414.6 L325.3,413.3 L324.4,412.7 L323.5,412.2 L322.5,412.2 L321.5,412.3 L320.7,412 L318.9,411 L317,410.3 L316.2,409.8 L315.9,409.5 L315.5,409.3 L314.4,409 L313.4,408.5 L313,408.5 L312,408.6 L311.6,408.5 L311.1,408.4 L310.1,407.7 L309.5,406.9 L309.4,406.6 L309.8,405.6 L310.3,404.7 L310.8,404.4 L311.3,404.3 L311.6,404 L311.9,403.7 L312.8,404.6 L313.3,404.8 L313.7,404.8 L314.4,404.5 L314.5,404.1 L315.4,403.6 L316.4,403.6 L316.9,403.7 L317.2,404.1 L317.6,404.2 L318.1,404.3 L319.7,405.1 L320.1,405.2 L320.6,405.3 L321.8,404.9 L322.7,404.8 L324.7,405 L325.8,404.8 L326.5,404.8 L327.6,404.4 L328.4,403.9 L328.8,403.8 L329.3,403.8 L330.4,403.8 L331.6,403.9 L332,403.8 L332.4,403.4 L332.9,403.3 L333.4,403.4 L334.7,402.8 L335.3,402.8 L335.8,403 L335.3,403.4 Z M286.2,381.7 L286.6,382.2 L287.6,384.4 L287.6,384.8 L287.5,385.3 L287.2,385.6 L286.3,386.7 L286.5,387.6 L286.8,388.2 L286.8,388.8 L286.7,389.6 L286.1,394.2 L285.8,395 L285.6,395.7 L285,396 L284.2,395.7 L283.2,395.3 L282.7,395.4 L282.2,395.5 L281.8,395.4 L281.5,395.2 L281.2,396.7 L280.7,397.4 L280,397.8 L279.3,397.8 L278.7,397.7 L278.1,397.7 L277.6,397.4 L277.3,396.9 L276.8,396.2 L276.2,395.4 L276.1,394.7 L276,393.2 L276.2,392.8 L276.4,392.5 L276.5,391.8 L276.5,391.2 L276.6,391 L277,391.2 L277.2,391.1 L277.2,390.8 L277.3,390.3 L276.8,389.8 L276.1,389.6 L276,389.1 L276.1,388.6 L276.5,388.3 L276.6,387.9 L276.6,386.5 L276.1,386 L275.9,385.3 L275.7,384.8 L275.2,384.3 L274.6,384 L274.3,383.6 L274.2,382.6 L274.4,381.7 L274.6,381.4 L274.8,381.4 L275.3,381.9 L275.7,381.9 L276.6,382 L277.5,381.9 L278.5,381.5 L279.5,381.1 L281,379.8 L281.9,379.5 L282.3,379.1 L282.5,378.6 L282.9,378.5 L283.3,379 L283.9,379 L284.8,379.4 L285.1,379.8 L285.4,380.2 L285.7,380.4 L286.1,380.5 L286.1,380.6 L285.9,380.7 L285.6,381.2 L285.7,381.4 L286.2,381.7 Z M276.7,396.5 L276.2,397.3 L275.7,396.8 L275.7,396.3 L275.8,396.1 L276.4,396.4 L276.7,396.5 Z M275.1,380.3 L274.8,380.7 L274.4,380.7 L274.6,380.4 L274.9,379.9 L275.4,379.7 L275.6,379.8 L275.4,380.2 L275.1,380.3 Z",
      "lt": "M379.8,244.9 L379.3,244.8 L380.3,243.6 L380.6,242.7 L380.9,241.6 L381.1,241.2 L381.1,241.7 L381,242.6 L380.4,244.1 L379.8,244.9 Z M394.8,255 L394.4,254.5 L394,253.5 L394.1,252.8 L394.3,252 L395.3,249.7 L395.3,249.4 L394.5,248.8 L393.6,248.3 L393.1,247.3 L391.3,247.3 L389.6,247.3 L389,247.3 L387.4,246.9 L385.8,246.2 L384.8,245.8 L383.9,245.4 L383.4,245 L382.6,245.1 L382.1,245.1 L382.1,245 L381.8,244.2 L382.1,243 L381.6,241.2 L380.7,239 L380.6,236.6 L380.6,236.1 L382.8,234.8 L385.6,233.3 L386.2,233.2 L388.8,232.4 L389.1,232.3 L391.4,232.5 L393.3,232.6 L394.8,232.6 L395.7,232.4 L396.4,232.6 L397,233.2 L397.7,233.2 L398.3,232.7 L401.8,233.1 L402.5,233.1 L403.4,233.2 L405,233.6 L406,233.9 L408,233.7 L408.9,233.7 L409.3,233.6 L410.7,232.6 L411.4,232.4 L411.9,232.3 L412.4,232.4 L412.8,233.2 L413.8,234.6 L414.9,234.9 L418.1,235.4 L418.7,235.7 L420.5,237 L421.5,237.6 L422.2,238.1 L423.2,239 L423.8,239.7 L424.8,240.2 L426,240.6 L426.4,240.6 L426.4,241.1 L426.2,242 L425.8,243 L425.4,243.9 L425.3,244.2 L425.6,244.5 L427.1,244.6 L427.8,244.8 L427.9,245 L427.6,245.3 L427.1,245.5 L426.9,245.8 L426.5,246.6 L423.9,246.5 L423.6,246.6 L423.4,247 L423.3,247.4 L422.9,248 L422.2,248.4 L421.2,248.6 L420.3,248.9 L419.7,249.8 L419.2,251.1 L419.2,252 L419.3,252.5 L419.2,252.7 L418.9,253.1 L418.3,253.9 L417.9,254.8 L417.7,255.2 L417.8,255.5 L418.3,255.5 L419,255.7 L419.4,256 L419.5,256.4 L419.5,256.9 L419.4,257.1 L418.9,257.3 L418,257.3 L417.5,257.1 L417.3,256.9 L417.6,256.5 L417.4,256 L417,255.7 L416.3,256.1 L415.6,256.1 L414.7,256.5 L414.1,257.2 L413.6,257.4 L412.2,257.3 L411.8,257.5 L411.5,258.8 L411.3,259.1 L410.1,259 L408.9,259.6 L407.6,260 L406.9,259.7 L406.5,259.3 L405.8,259.4 L405,259.6 L404.5,259.5 L403.9,259.5 L402.8,259.8 L401.3,259.7 L400.7,259.5 L400.6,259.3 L400.7,258.8 L400.7,258 L400.4,257.3 L399.7,256.7 L399,256.2 L398.1,255.8 L397.4,255.6 L397,255.5 L397,255.3 L396.8,255.1 L396.5,254.9 L395.8,254.6 L395.2,254.6 L394.8,255 Z",
      "lu": "M257.2,298.5 L257.1,298.8 L257.1,299.4 L257.4,299.9 L257.9,300.5 L258.3,300.9 L258.9,301.3 L259.9,301.6 L260.2,301.7 L260.3,302.1 L260.2,302.5 L259.9,302.8 L259.6,303.2 L259.3,303.6 L259.1,304.4 L259.1,305 L258.5,304.8 L258.2,304.6 L257.7,304.6 L257.2,304.7 L256.8,305 L256.3,305.1 L255.9,305 L255.6,304.8 L255.4,304.7 L254.7,304.5 L254.5,304.2 L254.7,304 L254.9,303.8 L255,303.5 L255.2,303.2 L254.6,302.3 L254.4,302 L253.9,301.6 L253.9,301.3 L254.1,301.1 L254,300.9 L254.1,300.5 L254.4,300.1 L254.7,299.6 L255.1,298.9 L256,298.1 L256.6,298.2 L256.9,298.2 L257.1,298.5 L257.2,298.5 Z",
      "lv": "M426.4,240.6 L426,240.6 L424.8,240.2 L423.8,239.7 L423.2,239 L422.2,238.1 L421.5,237.6 L420.5,237 L418.7,235.7 L418.1,235.4 L414.9,234.9 L413.8,234.6 L412.8,233.2 L412.4,232.4 L411.9,232.3 L411.4,232.4 L410.7,232.6 L409.3,233.6 L408.9,233.7 L408,233.7 L406,233.9 L405,233.6 L403.4,233.2 L402.5,233.1 L401.8,233.1 L398.3,232.7 L397.7,233.2 L397,233.2 L396.4,232.6 L395.7,232.4 L394.8,232.6 L393.3,232.6 L391.4,232.5 L389.1,232.3 L388.8,232.4 L386.2,233.2 L385.6,233.3 L382.8,234.8 L380.6,236.1 L380.3,234 L380.4,229.7 L380.8,227.5 L382.3,226.3 L383.1,225.3 L383.5,224 L383.7,222.8 L384,221.8 L386.2,218.9 L388,218.5 L390.3,217.7 L393,217.1 L393.5,217.9 L393.8,218.6 L397,220.9 L397.8,221.8 L399.1,224.5 L402,225.8 L404.4,225.4 L405.4,224.7 L407.3,223.5 L408.1,222.6 L408.3,221.7 L408,218 L407.5,216.4 L407.6,215.3 L408,215.4 L408.8,214.9 L411.4,214 L411.9,213.9 L412.5,213.8 L414.1,213.1 L414.7,213.4 L415.1,213.8 L415.4,213.9 L415.5,213.7 L415.4,213.4 L415.5,213.2 L416,213.3 L418,214.5 L418.7,214.7 L419.2,214.8 L419.8,215.4 L421.4,215.7 L421.6,216 L421.7,216.3 L423.3,217.8 L423.9,218.5 L425.3,219.2 L425.9,219.3 L428.3,218.6 L428.9,218.4 L429.5,218.4 L430,218.8 L431.3,219.2 L432.4,219.4 L432.7,219.4 L433.6,219.4 L434,219.6 L434.2,220.5 L435.3,221.2 L436.3,221.8 L436.6,222.1 L436.7,222.6 L436.6,223.2 L436.5,223.6 L436,223.9 L435.7,224.9 L435.6,225.8 L435,227.3 L435.2,227.3 L436.4,227 L436.8,227.2 L437,227.5 L437.1,228.5 L437.5,228.9 L438,229.6 L438.1,230.1 L438.9,230.7 L438.9,231.1 L439.4,232.5 L439.6,233.3 L439.7,233.9 L439.4,234.8 L439.2,235.3 L439,235.2 L438.3,235.4 L437.1,236 L435.5,237.5 L435.1,237.9 L434.6,239 L434.5,239.1 L433.5,239.1 L433.3,239.1 L432.3,239.1 L430.2,238.8 L429.4,239 L428.3,240.2 L427.9,240.3 L426.6,240.5 L426.4,240.6 Z",
      "me": "M365.2,359.2 L365.2,359.3 L365.3,359.6 L365.4,359.9 L366.1,360.2 L367.1,360.8 L368.2,361.9 L368.7,362.3 L369.2,362.3 L370.1,362.8 L370.7,362.9 L371.4,363.1 L373.3,364 L374.1,364.3 L374.7,364.7 L374.8,365 L374.8,365.2 L373.7,365.5 L373.5,365.9 L373,365.8 L372.3,365.8 L372.1,366.1 L372.4,366.5 L372.6,366.9 L372.5,367.5 L372.4,367.6 L372.3,367.6 L371.4,368 L370.7,368.2 L370.1,368.2 L369.9,368.1 L369.7,367.8 L369.8,367.1 L369.6,366.9 L369.5,366.8 L369,366.9 L368.6,367.5 L368.1,368.1 L367.5,368.8 L366.9,369.4 L366.4,370.2 L366,370.8 L366.4,371.2 L366.6,371.7 L366.5,372.1 L366.6,372.3 L366.5,373 L366.5,373.4 L365.2,372.7 L364.6,371.8 L362.8,370.2 L360.6,369.1 L360.5,368.9 L360.6,368.7 L360.7,368.5 L360.3,368.5 L359.9,368.6 L359.6,368.6 L359.3,368.2 L359,367.8 L359,367.5 L359.1,367.5 L359.3,367.4 L359.8,367 L359.9,366.8 L359.9,366.6 L359.2,365.7 L359.1,365.1 L359,364 L359.2,363.8 L359.4,363.7 L360.5,363.5 L360.5,362.7 L360.6,362.4 L360.8,362.1 L361,361.8 L361.6,361.3 L362.4,360.8 L362.8,360.7 L363.1,360.8 L363.5,361.3 L363.9,361.2 L363.9,360.7 L363.4,359.9 L363.2,359.5 L363.2,359.2 L363.4,359.1 L363.9,359.2 L364.3,359.3 L364.6,359.2 L365,359.1 L365.2,359.2 Z",
      "mk": "M384.8,370.2 L385.3,370.2 L386.3,370 L386.9,369.7 L387.2,369.7 L387.6,369.5 L388.2,369.6 L388.9,369.7 L389.6,369.5 L390.4,369.3 L390.7,369.3 L391.1,369.6 L391.3,369.6 L392.5,370.9 L393.2,371.4 L394.1,371.8 L395,372.1 L395.3,372.3 L395.9,373.7 L396.2,374.2 L396.6,374.3 L396.7,374.5 L396.7,374.7 L396.3,375.6 L396.1,377.7 L396,377.9 L395.5,377.9 L394.9,377.9 L394.7,378.1 L394.4,379.2 L393.4,379.5 L392.5,379.7 L391.7,379.6 L390.4,379.4 L390,379.4 L389.6,379.5 L388.4,379.6 L387.8,379.8 L386.6,381.1 L385.3,381.5 L384.9,381.8 L384,381.5 L383.5,381.4 L382.8,381.8 L381.4,381.8 L381,381.9 L379.9,381.9 L379.8,381.7 L379.6,381.5 L379.1,381.4 L378,381.5 L377.8,381.3 L377.3,380.2 L377,380 L376.6,379.6 L375.9,378.4 L375.9,377.9 L376,377.4 L375.6,376.3 L375.8,376 L376.2,375.9 L376.2,375.4 L376.1,374.8 L376.5,373.4 L376.6,373.4 L376.7,373.4 L377.6,373.5 L377.9,373.4 L378.1,373.1 L378.1,372.1 L378.3,371.7 L380.6,370.8 L381.3,370.8 L381.9,371.2 L382.3,371.4 L382.5,371.4 L382.6,371.2 L382.9,370.7 L383.4,370.4 L384.8,370.2 Z",
      "nl": "M256.1,292.3 L255.3,292.3 L254.5,292.3 L254.1,292.2 L253.7,292.1 L253.5,291.7 L253.2,291.4 L253.3,291.1 L254,290.5 L254.1,290.3 L254.1,290.2 L254.1,289.9 L254.7,289 L254.8,288.6 L254.5,288.3 L254.1,288.1 L253,287.8 L252.4,287.4 L252.1,287.1 L251.9,287 L251.5,287.1 L250.5,287.2 L249.7,287 L248.8,286.3 L248.5,285.7 L248.4,285.3 L248.2,285.1 L247.9,285.3 L247.5,285.7 L246.7,285.8 L246.5,285.7 L246.4,285.5 L246.4,285.3 L246.1,285 L245.9,284.9 L244.9,285.6 L244.5,285.6 L244.1,285.3 L243.8,285 L243.3,285.2 L242.8,285.5 L243,286.1 L242.7,286.2 L242.2,286.2 L241.5,285.9 L240.8,285.8 L239.7,285.4 L238.2,285.7 L237.1,285.3 L236.3,285.3 L235.7,284.9 L235.1,284.4 L235.5,284 L235.9,283.9 L237.5,283.8 L238.7,284 L240.8,285.2 L241.4,285.2 L241.9,285.1 L241.6,284.7 L241.1,284.6 L240.3,284.3 L239.7,283.8 L241.2,283.7 L241,283.4 L240.8,283 L239.2,281.7 L239.5,281.3 L239.9,280.4 L240.4,279.8 L240.8,279.6 L241.4,279.1 L242.8,277.7 L243.7,276.5 L244.3,275.2 L245.3,271.4 L245.6,270.7 L246,270 L246.6,270.1 L247,270.3 L248.4,269.8 L250.9,268.4 L251.6,267.1 L252.3,266.6 L255.2,265.4 L256.7,265.1 L259.1,265 L260.9,264.8 L262.9,264.7 L263.8,265.4 L264.2,266 L264.9,266.2 L266.1,266.4 L266,267.4 L266,269.4 L266,269.7 L265.4,270.6 L264.9,272 L264.7,273 L264.6,273.2 L262.4,273.2 L262.1,273.4 L262,273.6 L262.1,273.8 L262.1,274.1 L261.9,274.3 L262,274.6 L262.4,274.9 L263.1,275.2 L263.8,275.2 L264.2,275.2 L264.5,275.4 L264.8,275.8 L264.7,276.3 L264.6,277 L264.3,277.6 L263.3,278.3 L262.8,278.6 L262.4,278.7 L262.2,278.9 L262.1,279.1 L262.1,279.4 L262.8,279.9 L262.8,280 L262.6,280.3 L262.3,280.6 L260.5,281.2 L259.7,281.2 L259.3,281.4 L259.1,281.5 L258.7,281.2 L257.6,280.9 L257.2,281 L256.9,281.2 L256.3,281.4 L255.8,281.7 L255.8,282.1 L256.6,283.2 L256.9,283.4 L256.9,283.8 L257.4,284.3 L257.8,284.9 L257.8,285.3 L257.8,285.7 L257.6,286.3 L256.8,287.6 L256.8,287.8 L256.9,288 L257.1,288.1 L257.3,288.2 L257.3,288.3 L255.9,289.2 L255.7,289.4 L255.1,289.4 L255,289.5 L255.1,289.8 L255.3,290 L255.8,290.1 L256.3,290.3 L256.6,290.8 L256.1,292.3 Z M241.5,285.9 L241.4,286.3 L241.1,286.7 L240,287.3 L238.8,287.7 L238.3,287.7 L237.9,287.5 L237.7,287.3 L237,287.1 L236.2,287 L235.7,287.2 L235.3,287.4 L235,287.4 L234.7,287.2 L234.5,286.9 L234.3,286 L234.9,285.9 L236.3,285.8 L237.3,286.1 L238.7,286.3 L239.8,285.8 L240.6,286.2 L241.5,285.9 Z M259,264 L257.8,264.4 L257.5,264.3 L257.6,264.2 L258.6,264 L259,264 Z M255.6,264.6 L254,264.7 L253.4,264.6 L253.3,264.5 L253.8,264.4 L255.2,264.4 L255.6,264.5 L255.6,264.6 Z M248.8,266.2 L247.3,266.9 L247.2,266.8 L248.2,266.1 L248.8,266.2 Z M250.6,265.3 L249.9,265.4 L249.5,265.3 L251.4,264.9 L252.5,264.7 L252.7,264.8 L250.6,265.3 Z M247,268.7 L246.2,269.4 L245.7,269.2 L245.5,269 L245.8,268.4 L247,267.5 L247,268.7 Z M239.2,282.4 L240.1,282.9 L240.2,283.1 L240.3,283.3 L239.3,283.5 L238.2,282.8 L237.4,283 L237.2,282.7 L237.2,282.5 L237.9,282.3 L239.2,282.4 Z M262.3,263.3 L261.5,263.3 L261.7,263 L262.4,262.8 L262.8,262.8 L262.3,263.3 Z M-357.1,586.8 L-357.5,587.5 L-357.7,587.2 L-357.7,586.6 L-357.9,586.4 L-358.3,586.3 L-358.4,586.1 L-358.4,585.8 L-357.2,586.3 L-357.1,586.8 Z M-313.5,552 L-313.7,552.1 L-313.9,552.1 L-314,552 L-314,551.8 L-313.9,551.8 L-313.8,551.9 L-313.8,551.9 L-313.5,552 Z M-316,551.2 L-316,551.2 L-316.2,551.1 L-316.1,551 L-316,551 L-316,551 L-315.9,551.1 L-316,551.2 Z",
      "no": "M377,56 L376,56 L372.9,56.2 L374.2,57.8 L374.7,58.4 L374.8,59.3 L374.5,60.9 L373.9,62.3 L373.1,63.4 L371.6,64.6 L373.9,65.7 L372.4,67.2 L371.7,67.7 L370.8,67.6 L369.3,67.1 L365.8,65.9 L364.1,65.4 L362.6,65.3 L361.7,65.3 L358.5,64.2 L357.9,64.3 L356.7,64.8 L356.6,65.8 L356.7,68.4 L356.8,70.4 L356.4,71.5 L356,72.3 L354.7,74.3 L351.8,72.9 L349.8,72 L348.5,73.3 L345.3,75.5 L343.7,80 L343.6,80.1 L342.6,81.2 L341.4,81.7 L340.5,82 L339.9,83.3 L341.2,85.1 L341.8,86.1 L342.4,87.7 L342.3,88.7 L342.2,89.3 L340.8,90.6 L337.9,93.9 L335.2,97.3 L334.1,98.3 L334.6,101.2 L333.7,102.1 L331.9,103 L330.9,103.4 L329.9,103.6 L326.8,103.9 L327.4,107 L327.6,108.3 L327.6,109.1 L327.2,109.9 L326.9,111.4 L326.3,116.6 L325.8,117.2 L325.2,118.6 L323.3,121.9 L321.7,124.1 L319.4,127.3 L321.3,128.3 L323,129 L323.3,130.1 L323.5,132 L323.5,133.2 L322.8,134.4 L322.3,135.2 L322,135.5 L319.6,135.2 L316.5,134.7 L315.7,134.7 L313.9,135 L312.3,135.7 L311.5,136.3 L311.3,136.6 L310.2,138 L308.3,140.4 L307.2,141.5 L307.5,143 L305.8,145.8 L306.9,148.6 L307,148.7 L307.6,149.8 L307,150.5 L306.7,150.9 L306.8,152.2 L307,153.7 L306.8,154.5 L306.7,155.4 L308.3,159.6 L308.3,160.6 L308.2,161.2 L307.7,163.7 L307.1,167.2 L308.2,168.1 L309.8,169.1 L310.7,169.5 L312,170.8 L313.1,172 L312.9,172.8 L312.6,173.7 L312.2,174.4 L311.8,175.2 L311.6,175.8 L311.4,176 L309.7,176.1 L308.7,176.3 L308.2,176.6 L308.4,178 L309.5,180.6 L310.4,182.5 L310.6,183.7 L310.3,184.9 L310,185.5 L310,186.4 L309.8,188 L309.1,188.9 L308.2,189.8 L307.2,190.5 L306.4,190.7 L305.7,190.7 L305.2,191.1 L304.8,192.1 L304.4,193.2 L303.1,194.5 L303.2,194.9 L303.7,196.5 L304.1,198.2 L303.7,199.8 L303.4,201.5 L302.8,202.7 L302,203.1 L301.4,202.9 L300.7,201.3 L300.7,201 L300.6,200.5 L298.6,200 L298.3,200 L297.5,199.8 L297.1,199.7 L296.2,199.5 L295.4,198.1 L294.6,197 L294.5,196.5 L294.5,194.3 L294.2,193.4 L294.2,192.3 L293.7,193.2 L293.9,194.5 L293.3,195.1 L292.6,195.4 L292.6,196.2 L292.9,196.3 L293,197.1 L292.8,198.3 L291.3,201 L290.9,201.3 L290.7,201.7 L289.9,201.4 L288.9,202.2 L288,202.3 L287.6,201.4 L286.2,200.3 L285.6,200.4 L286.2,200.9 L286.7,201.7 L286.4,202.1 L286.1,202.4 L285.6,202.6 L283.6,203.5 L284.3,204.1 L283.7,204.8 L283,204.9 L282.6,205.3 L282.5,205.7 L280.4,207 L277.1,210.2 L275.3,211.1 L274.1,212.1 L273,212 L271.7,212.8 L268.3,213.5 L266.1,213.2 L264.5,213.5 L263.7,213 L263.5,212.6 L263.6,212.4 L263.8,212.1 L263.5,212 L262.8,212 L262.6,212.2 L262.5,212.8 L262.2,213 L261.1,212.6 L260.8,212.3 L261.2,211.7 L261.9,211.1 L261.8,211 L261.6,210.7 L261.3,210.6 L260.3,210.7 L259.4,210.6 L256.6,209.3 L256,208.6 L253.8,207.5 L252.8,206.4 L252.2,205.1 L252.3,203.9 L252.5,202.1 L253,201.6 L255,202.3 L257,203.3 L257.3,203.3 L258,202.4 L259.2,201.8 L258.8,201.6 L257,202.4 L256.3,201.9 L255.3,201 L255.3,200.6 L255.8,200.1 L255.9,199.5 L255.7,198.9 L255.8,198.1 L256.6,197.2 L257.8,196.4 L258.7,195.5 L259.6,195 L259.5,194.9 L258.5,195.2 L257.5,195.7 L256.3,196.7 L254.9,197.4 L253.9,197.7 L253.4,198 L252.6,198.2 L251.8,199.3 L250.9,199.7 L249.4,199.8 L249,199 L249.5,196.2 L249.9,194.8 L250.5,193.8 L251.3,193.7 L251.9,193 L252.3,193 L252.7,193.3 L254.3,193.6 L255.1,192.7 L256.1,192.6 L258,191.7 L257.9,191.5 L256.7,191.7 L255.9,191.7 L254.8,191.9 L254.2,191.8 L254,191.1 L254.4,190.5 L256.2,189 L256.8,188.3 L257.1,187.7 L257.1,187.3 L257.4,186.4 L259.1,184.9 L260.5,184.2 L260.9,184.8 L260.5,186.7 L260.5,187.4 L261.7,184.7 L262.1,184.1 L262.7,183.6 L264,183.3 L264.4,182.9 L262.9,183 L259.1,184.1 L257.5,185 L257,185.7 L255.9,186.8 L255.4,187.5 L255.2,188.5 L254.6,189 L253.7,189.2 L252.5,190.5 L252,191.6 L250.9,192.4 L250.1,193 L249.9,193.2 L249.5,193.8 L249.1,193.9 L248.8,193.5 L248.8,192.7 L248.9,191.5 L249.5,190.6 L249.7,189.6 L249.4,188.8 L249.6,188.3 L250.1,188.3 L251,188.5 L252,188.5 L253.6,187.8 L253.4,187.4 L252.7,187.4 L251.4,187.4 L250.3,186.8 L249.4,185.5 L249.1,183.7 L249.3,183.2 L252.4,181.4 L253.3,180.6 L252.8,180.6 L251.6,181.6 L249.9,182.2 L248.9,181.3 L248.3,180.4 L248,178.4 L248.1,177.4 L248,176.1 L248.7,175.7 L249.5,175.9 L250.3,176 L252.1,175.9 L256.1,175.1 L258.6,175.6 L259.6,175.5 L261.3,174.8 L262.6,174.8 L263.7,175.3 L264.2,175.9 L264.3,176.7 L264.8,177.2 L265.1,177.1 L264.9,176.4 L264.8,175.4 L269,174.3 L269.5,173.9 L267.8,173.7 L267.3,172.7 L268.2,171.1 L268.1,170.9 L267.2,171.8 L266.8,172.9 L266.9,173.8 L266.8,174.3 L265.9,174.5 L264,174.5 L262.8,174.1 L261.6,173.9 L261.3,173.6 L261.4,173 L261.2,172.8 L260.7,173.4 L260.3,174.6 L259.4,174.9 L256.9,174.4 L253.3,174.7 L251.7,175.3 L250.6,175.2 L248.8,174.2 L248.1,173.4 L247.9,171.7 L248,170.9 L249.4,170.6 L250.1,170.7 L250.7,170.3 L250.2,170 L249.3,169.5 L248.8,168.5 L247.9,168.2 L247.3,167.3 L247.2,166 L247.4,165.1 L247.8,164.8 L248.9,165 L251.8,164.8 L254.5,165.8 L256.3,166.3 L260.1,166 L262.2,165.2 L261.8,164.9 L259.5,165.4 L257.3,165.4 L253.4,164.5 L251.9,164.2 L250.2,164.3 L249.3,164 L248.7,163.1 L249.1,161.3 L249.9,160.9 L250.4,161.4 L250.9,161.4 L251.4,160.7 L251.9,160.2 L252.4,159.2 L253.9,158.3 L254.5,158.3 L255.5,157.8 L256,158 L256.4,158.4 L256.9,158.7 L257.9,158.7 L261,158 L261.3,157.7 L261.9,157.1 L260,157.4 L258.4,157.8 L257.3,157.9 L257.2,157.4 L257.6,156.9 L258.2,156.4 L258.5,155.5 L259.1,155.2 L259.8,155.2 L261.3,155 L262.4,154.8 L264.1,155 L266.8,155.3 L268.5,156.1 L269.2,156 L269.9,155.8 L270.2,155.5 L268.8,155.2 L268.7,154.7 L268.9,154.3 L271.1,153.7 L273.5,153.5 L273.1,153 L267.8,153.8 L266.5,153.2 L265.4,153.2 L264.7,153.5 L262.7,153.9 L262.3,153.7 L262.7,152.7 L263.9,151.2 L264,150.8 L264.5,150.4 L267.7,149.5 L269.2,148.4 L269.9,148.3 L270.5,148.4 L271.6,148.3 L273.6,148.6 L274.5,149.9 L275.3,150.3 L277.9,152 L277.8,151.5 L275.5,149.2 L274.7,148.7 L274,147.6 L274.3,146.5 L275,145.8 L277.5,145.5 L278,145.1 L278,144.3 L277.6,143.9 L276.7,143.9 L275.9,143.6 L275.7,142.9 L276,142.3 L277.5,141.4 L278.3,141.1 L279.7,140.8 L282.1,141.5 L282.3,141.9 L281.6,142.8 L281.7,143.3 L282.3,143.4 L283.7,141.9 L285.3,141.6 L286,141.3 L286.7,141.1 L287.9,142.5 L288.4,143 L288.7,143.1 L289.1,144.3 L289.4,144.4 L289.9,143.8 L290.8,143.5 L292.1,143.3 L294.1,143.6 L295.1,143.3 L295.5,143.4 L295.1,142.3 L294.8,142 L295.3,141.1 L295.7,140.7 L297.1,140 L298.5,139.7 L299.4,139.1 L300.6,138.5 L300.4,138.1 L300,137.5 L299.3,137.5 L299,137.2 L300,136.5 L301.3,135.7 L301.1,135.4 L300,135 L299.3,135.3 L298.1,135.9 L296.8,136.9 L297.3,137.1 L297.9,137.9 L297,139 L292,141.8 L289.7,142.7 L288.6,142.5 L288.4,141.8 L287.9,141.2 L287.3,140 L286.4,140 L285.9,140.3 L285.7,139.9 L286.1,138.7 L286.8,137.7 L288.1,136.9 L288.7,136 L289.3,134.5 L291.2,133.2 L293.9,129.7 L296.2,128.6 L297,127.3 L298.3,126.8 L299.4,125.9 L300.3,125.8 L301.9,124.9 L302.8,123.9 L302.2,123.8 L300.8,124.5 L300,124.7 L300,123.6 L300.4,122.5 L301.6,121.5 L307.1,118.5 L307.7,118.9 L308.3,119.9 L310,119.6 L311.9,117.9 L313.3,116.1 L312.6,116.4 L311.7,117.2 L310,118.2 L309.2,118.4 L308.8,118.2 L308.6,117.5 L308,117.3 L307.4,117.5 L306.9,116.9 L306.8,115.7 L307.5,113.8 L308.1,112.6 L308.6,111.6 L311,109 L311.5,107.5 L312.5,106.7 L313.9,106.9 L314.3,106.6 L313.9,105.7 L312.4,104.9 L312.3,104.4 L317.2,103.1 L319.6,103.2 L320.3,102.5 L321.6,102.1 L322.6,101.3 L322.1,101 L319.7,101.7 L318.2,102.1 L317.5,102.1 L316.9,102.3 L315,102.4 L314.6,99.3 L314.9,97.5 L315.6,97.6 L315.8,95.9 L316.6,95 L317.8,94.7 L318.3,94.3 L319.2,93.5 L320.5,93.7 L322,93.5 L321.6,93.1 L319.9,92.6 L319.4,91.7 L320,91.2 L320.7,90.8 L321.3,90.8 L322.5,89 L323.2,88.3 L324,88.4 L325.1,87.6 L326.2,87.9 L327.3,87.4 L328.7,87.1 L334,86.9 L334.2,86.2 L333,86 L329.1,85.8 L327.1,85.9 L326.3,86.1 L326,85.8 L326,85.4 L326.7,84.7 L327.1,83.9 L328.6,82.1 L330.3,80.8 L331.6,81.2 L333,82.4 L334,82.5 L334.4,82.9 L335.2,84.5 L335.5,84.5 L335.3,83 L336.3,81.7 L336,81.4 L334.6,81.8 L333.5,81.4 L332.6,80.4 L332.4,79.5 L332.9,78.6 L333.4,78.2 L333.1,77.7 L330.9,79.1 L329.4,79.4 L328.8,79.2 L329.1,77.9 L328.9,77 L331,74.5 L331.7,74.2 L332.8,74.4 L333.9,75.1 L334.8,75 L335.7,74.6 L335.6,74 L333.5,73.7 L333,73.2 L333.2,72.6 L334.6,72 L336,71 L337.6,70.7 L338.9,69.9 L339.1,70.1 L339.4,70.4 L339.8,73.3 L341,75.7 L341.4,75.7 L341,73.7 L341.4,73.2 L341.9,72.7 L342.1,72.2 L341.5,72 L341,71.3 L340.3,69 L340.5,68.4 L342.1,67.2 L344,66.9 L346,67.7 L346.7,67.8 L347.9,67.5 L349.9,66.8 L351.1,66.5 L351.7,66.5 L351.8,66.2 L351.3,65.9 L351.1,65.7 L350.6,65.6 L348.8,66 L343.7,65.8 L343.2,65.4 L343.1,64.7 L343.6,63.7 L344.2,63.1 L346.2,62.1 L348.2,61.9 L350.3,60.1 L351.2,58.7 L351.6,56.6 L352.9,54.8 L356.2,53.9 L356.3,53.4 L356,52.5 L356,50.9 L356.9,48.9 L357.5,48.3 L357.8,48.2 L358.5,48.8 L359.4,50.2 L360.7,50.9 L362.5,51.1 L362.9,50.7 L361.6,49.9 L360.5,48.9 L360.4,47.9 L361,47.4 L361.7,47.4 L362.7,47.3 L363.6,46.6 L363.7,46.1 L363.7,45.5 L364,44.8 L365.3,43.3 L369.3,42.2 L369.6,42.7 L369.4,45.7 L368.9,47.7 L368.9,49.1 L369.7,47.7 L370.8,43.7 L371.6,41.9 L372.5,40.8 L373.1,40.5 L373.7,40 L374.6,39.6 L374.8,40.1 L375.1,41.1 L374.6,44.5 L374.7,45.6 L374.2,47.1 L372.3,50.3 L372.3,50.7 L372.8,50.6 L373.5,50 L375.9,47 L378,47.4 L378,47.1 L377.4,46.2 L376.5,45.3 L376.3,44.3 L376.4,41.4 L377,40.2 L378.8,40.3 L379.9,40.2 L380.4,40.7 L381.5,40.7 L382.3,38.6 L383.7,38.4 L385.1,39.8 L386.6,40.7 L387.9,42.1 L388.2,41.7 L387.6,38.6 L386.8,37.4 L385.2,36.8 L383.5,35.4 L383,34.8 L383.1,34.3 L384.6,33.9 L386.6,34.4 L388.4,33.2 L388.9,33.6 L390.3,32.9 L391.1,33.7 L391.6,33.5 L391.9,32.4 L394.1,31.7 L395.5,32.4 L396.2,33 L396.6,34.3 L397.1,36.8 L398.1,38.1 L398.8,38.8 L399.6,38.9 L400,38.3 L399.3,37.5 L399.1,36.7 L399.4,34.8 L399.8,34.1 L402.2,31.2 L404.1,29.7 L405.3,29.6 L407.3,26.3 L407.9,25.7 L408.4,25.5 L408.3,24.7 L407.2,24.2 L407.1,23.2 L408.6,21.9 L410.4,19.8 L411.3,19.7 L411.8,20.2 L413.6,21.2 L414.6,22.3 L415.4,22.8 L415.9,22.7 L416.3,21.9 L416.8,21.5 L417.9,21.7 L418.6,22.3 L419.1,22.3 L419.6,22.6 L419.7,23.3 L418.7,24.1 L417.1,26.1 L415.5,28.4 L415,29.6 L414.4,32.6 L413.2,34.6 L413.1,36 L413.6,36.6 L415,36.1 L416.7,34.3 L417.1,32.4 L421.4,27 L423.4,24 L425.7,21.5 L426.9,21 L427.6,22.6 L427.1,24.8 L426.1,26.1 L426.8,26.8 L426.7,28.4 L426.5,29.3 L426.3,30.2 L426.3,31.1 L427,30.8 L429.7,29.1 L430.3,27.3 L431,25.9 L431.3,24.7 L432.3,23.6 L434.3,23.6 L434.4,23.1 L432,21.6 L431.7,20.8 L432.5,19.9 L434.7,18 L435.8,18.2 L436.5,18.7 L439.2,19 L441.3,20.3 L441.2,22.3 L440.7,23.2 L440.3,23.7 L437.6,25.2 L437.2,26 L438,26.2 L439.8,25.5 L440.3,26.2 L439.7,27.9 L439.6,30.5 L439.4,32 L439.4,33.3 L439.6,34.1 L440.3,31.2 L440.6,30.4 L441.6,29.3 L442,27.1 L443,24.4 L444.2,22.9 L444.9,22.4 L447.1,22.5 L448.1,23.1 L448.9,24.4 L449.6,24.9 L451.5,25.5 L452.3,26.2 L452.4,26.6 L452.9,26.7 L454.2,25.7 L455.1,25.5 L456.5,27 L456.2,28.2 L456.3,28.5 L458,28.5 L459.5,28.9 L462.2,31.2 L462.5,32.3 L462.3,33.6 L458.4,35 L456.7,36.4 L453.9,36.9 L444.5,36 L444.7,37 L451.3,39.1 L451.6,39.7 L451.4,40.9 L451.4,42 L451.5,42.7 L452,43.3 L452.8,43.6 L454.5,43.5 L455.3,43.8 L455.8,43.3 L456,41.6 L456.5,41.2 L457.4,41.7 L457.8,43.5 L458.1,43.7 L458.5,42.4 L459.5,42.5 L460.4,42.4 L461.7,42.6 L462.2,45 L462.2,45.8 L462,46.6 L461.7,47.1 L461.1,47.2 L459.6,47.1 L457.7,46.2 L456.4,45.3 L456,45.3 L455.9,45.4 L456.2,46.3 L456.1,47 L455.9,47.7 L455.6,48.4 L455.3,49 L454.5,49.7 L453.2,50.2 L449.5,51.3 L449.2,51.8 L448,54.9 L447.7,55.4 L447.3,55.7 L446,56.2 L445.4,55.5 L444.9,54.5 L445,53.5 L446.5,51.5 L447.9,50.1 L448.2,49.6 L449,48.2 L447.4,44.6 L444.6,43.6 L441.4,41.9 L440.2,41 L438.4,39.2 L437.1,37.5 L435.9,37.5 L434.6,37.9 L432.6,39.4 L431.5,40.2 L430.8,40.4 L430.7,40.4 L429.2,40 L427.6,39.9 L426.3,40 L425.8,40.2 L424,42.6 L422.8,43.9 L422.1,44.3 L421.6,45 L421.2,46.1 L420.2,50.1 L419.6,51.6 L419.4,52.5 L419.6,55.3 L419.4,56.8 L418.6,58 L418,58.6 L417.2,58.7 L416.2,59 L415.3,59.7 L414.7,60.7 L413.9,62.9 L412.8,63.7 L411.6,63.5 L410.8,62.7 L409,62 L407.7,61.6 L406.2,60.8 L404.9,60.1 L403.8,60 L403.1,60.8 L402.5,61.6 L400.5,62.2 L399.4,62.7 L397.9,62.8 L397.3,62.3 L395.1,61.9 L392.6,61.5 L391.8,61.5 L391.6,60.5 L390.9,59.1 L389.1,56.7 L388.4,55.9 L386.9,53.9 L385.3,51.8 L385.1,51.8 L384,51.7 L382.4,51.8 L381.4,52.2 L380.7,52.8 L380.6,53.3 L381.2,55.2 L381,55.7 L380.7,55.9 L379.2,55.4 L377.5,55.4 L377,56 Z M247.6,175.5 L246.9,175.7 L246.3,175.5 L246.5,174.3 L246.8,174.1 L247.2,174 L247.7,174.7 L247.6,175.5 Z M248.6,185.5 L248.7,187 L247.9,186.9 L247.6,186.3 L247.5,185.9 L247.5,185.1 L247.4,184.2 L247.6,183.7 L247.9,183.7 L248.3,184.5 L248.6,185.5 Z M454.2,42.4 L452.6,42.9 L452.4,42.5 L452.8,41.8 L453.2,40.4 L453.8,40.4 L454.5,41 L455,41.6 L454.2,42.4 Z M305.5,111.7 L305,112.2 L303.9,112 L303.9,111.6 L304.1,110.8 L304.7,110.5 L305.6,110.6 L305.8,110.9 L305.5,111.7 Z M276.6,140.5 L275.7,140.5 L275.1,140.2 L276.5,139.6 L278.6,139 L278.8,138.6 L279,138.5 L279.4,139 L279.5,139.6 L279.2,140 L276.6,140.5 Z M273.6,145.1 L272.8,145.1 L271.8,144.9 L271.2,144.4 L271.1,144.1 L272.2,143.5 L273.3,143.2 L273.9,143.8 L273.9,144.7 L273.6,145.1 Z M400.3,23.4 L400.2,24 L399.9,24.6 L399.2,25.1 L397.2,27.6 L396.1,27.9 L395.7,28.3 L395.3,28.6 L393.9,28.2 L393.4,28.7 L393,29.1 L392,29.2 L391.4,29.1 L389.8,28.2 L388.9,27.2 L388.4,26.4 L389.8,26.4 L390.3,26.2 L391.3,26.4 L391.9,25.5 L393.1,25.6 L395.5,25 L396.4,25.3 L398.4,23.4 L399,23.4 L400,22.9 L400.3,23.4 Z M418.1,17.1 L420.3,17.8 L421,17.8 L422.1,19.2 L422.7,19.1 L422.6,19.9 L421.5,20.3 L419.8,20.5 L419.5,20.7 L418,20.6 L417.2,19.5 L415.8,19.2 L415.8,18.8 L416.7,17.9 L418.1,17.1 Z M401.8,28.4 L401.9,29.3 L402,30 L401.2,31.1 L399.5,32.5 L399.5,32.8 L398.9,33.2 L398,33.4 L397.5,33.2 L397.6,32 L397.4,31.6 L396.7,32.1 L396,31.5 L396,30.9 L396.2,30.4 L396.9,29.6 L398,29.1 L398.7,29.3 L401.2,27.1 L401.5,27.6 L401.8,28.4 Z M405.1,28.1 L403.5,28.8 L402.6,28.2 L402.2,27.5 L402.2,26 L402.4,25.1 L403.1,24.7 L403.6,25 L403.7,25.3 L404.6,25.6 L405.6,26.5 L405.1,28.1 Z M321.3,69.3 L321.8,69.6 L323,69.5 L323.3,69.6 L323.1,70.1 L322.5,70.6 L321.4,70.9 L320.8,71.7 L320.5,72 L319.5,72 L318.9,72.2 L318.1,72.9 L317.5,72.4 L317.4,72.7 L317.3,73.4 L316.9,73.6 L315.9,73.9 L315.7,72.3 L316.2,71.7 L316.5,71.1 L317.1,71 L317.6,71 L318.5,69.5 L319.7,69.1 L320.5,69.1 L321.3,69.3 Z M313.8,75.9 L312.6,76.8 L313.1,75.1 L313.7,73.5 L314.6,72.6 L315.1,72.9 L314.9,73.7 L314.9,74.5 L314.7,74.9 L313.8,75.9 Z M332.3,57.6 L333.4,59.4 L333.8,60.4 L333.5,62.3 L332.4,63.3 L330.8,63.5 L329.7,63.4 L329,62.9 L328.9,62.4 L328.5,62.2 L327.4,62.9 L326.6,63 L325.7,62.5 L325.4,61.6 L326.4,60.6 L326.9,59.8 L328,59.9 L328.3,60.1 L328.9,60.2 L329.3,59.3 L329.2,58.6 L329.5,58.1 L330.9,58.5 L330.9,56.6 L331.4,56.5 L331.6,56.6 L332,56.9 L332.3,57.6 Z M370,34.6 L370.4,34.9 L370.8,34.7 L371.2,34.9 L371.8,35.9 L372.6,36.3 L372.6,36.8 L372,37.3 L371,37.4 L370.1,37.2 L369.8,36.6 L369.5,35.6 L368.7,34.6 L368.6,33.7 L369.3,33.6 L370,34.6 Z M378.3,37 L377.9,37.4 L377.2,37.6 L376.8,37.3 L376.3,37.2 L375.7,37.3 L375.3,36.5 L375.3,35.8 L376,34.9 L377.3,34.4 L378.4,34.6 L378.7,34.9 L378.3,37 Z M365.7,37.4 L366.5,38.4 L367.1,38.3 L367.3,38 L367.8,37.8 L368.7,38.3 L368.5,39.2 L367.3,40.3 L366.4,41.9 L365.3,42.3 L364.7,42.1 L363.7,43 L362.9,44 L362.1,45.2 L362,45.8 L361.8,46.3 L358.8,46.8 L357.6,47.1 L356.5,46.7 L355.9,45.9 L356.1,45.5 L357.3,45.3 L357.3,44.5 L357.6,44.1 L358,43.9 L358.2,42.9 L358.7,42.7 L359.6,42.9 L360.2,42.2 L360.5,42.1 L361,42.7 L361.1,41.9 L361,41.1 L361,40.7 L362.2,39.4 L362.7,38.5 L363.4,37.9 L364,38 L364.3,37.1 L364,36.2 L364.1,35.6 L364.7,34.1 L365.4,34.1 L365.7,35.4 L365.7,37.4 Z M310,107.5 L309.3,107.5 L309.3,106.9 L309.7,106.3 L310.3,105.9 L311.1,105.8 L311.9,105.8 L312.2,106.1 L311.7,106.5 L310,107.5 Z M309.2,105.3 L308.5,105.4 L308.6,104.7 L309.2,104.1 L309.5,103.6 L309.6,103.1 L310.1,102.7 L310.9,103.2 L310.9,104.1 L310.6,104.9 L309.2,105.3 Z M299.4,123.1 L299,123.5 L298,123.2 L296.2,123.4 L295.4,123.1 L296,122.3 L297.7,121.4 L298.6,121.5 L299.5,122.5 L299.4,123.1 Z M351.3,46 L352.3,47 L352.7,46.7 L353.6,46.6 L354.2,47 L354.8,47.6 L355.4,47.6 L355.8,48.5 L356,49.6 L355.5,50.4 L354.9,50.8 L354.7,51.8 L355,53.1 L353.5,53.6 L351.8,53.8 L351.1,53.2 L349.8,54.3 L348.4,56.2 L347.8,56.4 L347.7,55.8 L346.8,55.4 L345.5,55.4 L345.6,54.9 L345.8,54.6 L346.9,54.2 L347.1,53.2 L346.9,51.6 L347.1,50.8 L347.1,50.2 L347.8,49.5 L350.1,49.9 L350.4,49.2 L350.2,48.8 L349,48.1 L349.2,47.7 L350,47.2 L350.9,47.2 L351.1,46.5 L351.1,46.2 L351.3,46 Z M336.9,64.2 L337,64.4 L338.1,62.7 L339.3,62.2 L339.4,61.6 L339.9,61 L339.8,60.1 L340.1,59.4 L340.7,59.2 L341.1,58.9 L341.6,58.8 L342.4,59.4 L342.8,60 L343.4,61.5 L343.1,63 L341.6,64.1 L340.5,64.6 L339.2,65.9 L338.6,66.9 L338.1,67.2 L337.8,67.1 L337.5,66.8 L336.9,66.8 L336.2,67.7 L334.2,68.5 L333.4,68.3 L333.4,67.4 L332.9,67.5 L332.1,68.5 L331.4,68.9 L330.9,69 L330,68.6 L327.5,70.4 L325.2,70.8 L324.4,70.5 L324.4,69.4 L325.9,68 L327.2,67 L331.4,66.3 L334,63.3 L334.6,60 L335.2,58.8 L334.9,58.1 L334.2,58 L334.2,57 L334.6,55.8 L336,54.3 L336.7,53.6 L338,51.7 L338.5,51.3 L339.2,51.3 L339.9,51.8 L339.8,52.8 L338.8,54.6 L337.3,56.2 L337.5,57.3 L338.1,58.2 L338.2,59.8 L338.3,61.3 L337.1,63.3 L336.9,64.2 Z M132.6,22.9 L131.9,23 L131.4,22.6 L132.5,21.4 L136.2,19.2 L137.7,17.1 L140.5,16.4 L140.7,17.5 L140.5,19 L138,20.2 L135.3,21 L132.6,22.9 Z M365.4,-52.1 L364.5,-51.2 L362.9,-52.5 L362,-54.3 L362.5,-54.9 L365.1,-55.1 L365.8,-54.1 L365.9,-53.6 L365.4,-52.1 Z M428.7,-167.9 L427.5,-167.8 L425.3,-170.1 L424.9,-172.2 L425.2,-173 L426.3,-173.1 L428,-170.2 L429.8,-169.4 L428.7,-167.9 Z M475.4,-218.1 L467.6,-216.7 L466.8,-217.7 L479.5,-221.8 L480.1,-222.1 L482.5,-222.7 L484.5,-221.8 L483.9,-221 L475.4,-218.1 Z M385.2,-166.2 L386.3,-165.4 L388.8,-165.6 L390.1,-160.2 L390.9,-154.7 L392.1,-154.2 L394.5,-155.1 L396.6,-155.4 L397.7,-155 L399.6,-153.4 L400.4,-152.3 L399.7,-151.4 L398,-150.4 L397.7,-147.5 L399.4,-146.4 L402.3,-144 L404,-143.7 L406.9,-144.7 L409.7,-142.7 L412.4,-140.4 L406,-137.5 L405.5,-136.7 L404.6,-134.6 L403.6,-132.8 L402.8,-131.8 L400.9,-130.1 L399.8,-129.4 L397.5,-129.6 L396.7,-128.9 L395.9,-127.5 L395,-126.4 L393,-126.2 L392,-127.6 L392.3,-128 L392.5,-128.9 L392.1,-130.9 L394,-132.9 L394.5,-134 L394.1,-134.4 L393.6,-134.3 L392.1,-134.9 L391.7,-134.9 L390.5,-133.7 L388.9,-132.9 L387.3,-132.7 L380.6,-131.2 L379.6,-131.7 L379.1,-134.8 L381.8,-136.4 L382.3,-139.1 L382.9,-140.9 L383.7,-142.1 L385.2,-145.2 L385.6,-145.4 L381.9,-147.9 L380.5,-149.5 L378.9,-152.8 L378.4,-155.4 L376.3,-157.7 L376.5,-160.6 L375,-160.4 L373.8,-162.5 L374.9,-163.6 L380.6,-164.9 L383.9,-166.3 L385.2,-166.2 Z M379.3,-222.9 L380.1,-222.5 L384.7,-222.7 L385.6,-221.8 L385.9,-219.6 L386.6,-218.8 L387.6,-218.6 L390,-216 L390.8,-215.6 L391.5,-217 L392.1,-220.7 L392.1,-225.1 L391.9,-227.3 L392.2,-228.6 L393,-229.2 L394,-229 L395,-229.8 L395.9,-231.2 L396.8,-231.4 L398.8,-230.3 L399.3,-229.5 L398.8,-227.8 L398.6,-225.4 L397.6,-220.6 L399.6,-220.3 L402.4,-221.3 L403.1,-222.7 L404.6,-225 L406.1,-224.7 L406.9,-224.9 L407.3,-225.9 L407.4,-227.1 L408.3,-226.9 L409.5,-224.7 L410,-224.3 L411.1,-224.9 L411.4,-224.9 L412.5,-223.9 L417.1,-222.3 L418.7,-221.4 L419.4,-220.7 L420.1,-220.2 L425.1,-220.2 L428.6,-219.6 L429.9,-218.4 L431,-216 L431.4,-210.4 L430.4,-208.9 L423.3,-202.3 L421.5,-200.2 L420.7,-198.2 L419.2,-194.1 L418.5,-192.8 L415.2,-190.8 L414.4,-190.6 L411.9,-191.6 L411.2,-191.4 L408.1,-189.3 L407.1,-188 L406.1,-186.5 L404.5,-185.7 L403,-186.1 L395.9,-186.9 L395,-188.1 L394.2,-190.3 L395.6,-193.1 L387.7,-192 L379,-192.6 L378.6,-193 L378.2,-194.1 L375.2,-194.8 L373,-195.7 L371.1,-197.3 L369.2,-199.3 L369.8,-200.2 L370.4,-200.7 L372,-201 L373.4,-200.7 L376,-200.7 L376.6,-202.7 L377.6,-203.3 L378.4,-204.8 L375.7,-205.7 L372.9,-205.9 L371.1,-204.6 L368.9,-204.1 L366.9,-204 L363.2,-204.4 L361.4,-205.2 L358.9,-207.5 L358.1,-208.8 L357.7,-209.7 L357.5,-211.2 L360.3,-212.6 L361.4,-213.6 L362.4,-215.1 L358.2,-216 L356.4,-217.2 L354.7,-219 L356.1,-220 L361.8,-220.9 L363.3,-220.2 L364.8,-218.8 L366.5,-218 L368.1,-219.8 L366.6,-220.5 L365.2,-223.4 L364.9,-224.9 L365.1,-226 L365.8,-226.1 L366.3,-225.7 L368.3,-223 L369.8,-222.1 L370.3,-224.6 L370.3,-225.8 L370.1,-226.8 L369.3,-228.6 L368.7,-230.9 L369.7,-231.5 L370.7,-231.3 L372.8,-229.7 L374.9,-228.6 L375.8,-227.5 L377.6,-224.8 L379.3,-222.9 Z M345.3,-210.4 L345.8,-210.4 L346.2,-210.7 L346.5,-211.7 L346.8,-212.3 L348.9,-211.6 L351.9,-209.6 L352.8,-208.6 L354,-206.6 L355,-203.2 L354.2,-200.8 L353.2,-198.5 L352.8,-197.3 L353.2,-195.5 L353,-193.8 L352.6,-192.2 L354.2,-193.9 L357.6,-199.6 L358.1,-199.9 L358.7,-199.8 L360.2,-198.6 L361.5,-195.7 L361.9,-194.8 L362.1,-193.6 L362.3,-192.2 L362.2,-190.5 L362.1,-189.4 L361.3,-188.7 L361,-188 L361.8,-187.9 L362.6,-187 L363.5,-185.2 L364.4,-184.5 L367.7,-185.1 L369.8,-184.1 L371,-181.1 L372.9,-181.8 L372.9,-183.4 L373.2,-184.1 L375.7,-183.5 L377,-182.8 L378.2,-181.2 L376,-178.7 L377.9,-176.2 L380.9,-174.5 L382.7,-172.6 L383.1,-171.8 L383.4,-170.8 L382.2,-169.5 L381,-168.7 L377.9,-168.6 L375.1,-167.7 L370,-167 L369.2,-166.6 L369,-166.3 L368.7,-165.1 L366.8,-162.5 L364.9,-159.4 L364.1,-157.5 L363.5,-154.8 L363.3,-153.3 L363.7,-151.7 L363.6,-150.2 L362.2,-148.9 L361.2,-148.9 L360.1,-149.2 L359,-148.5 L358.9,-147.4 L359,-146 L358.7,-141.5 L358.4,-138.2 L357.8,-135.2 L357.3,-133.5 L356.5,-133.1 L354.1,-132.8 L352.3,-130 L350.8,-125 L350,-123.1 L348.4,-120 L348.7,-119 L349.2,-117.8 L348.3,-115.7 L346.9,-113.4 L346.9,-112.5 L347.4,-110.9 L347.6,-109.2 L346.6,-107.8 L344.6,-107.1 L342.7,-107.9 L341.7,-108.9 L340.8,-110.4 L339.9,-111.4 L338.9,-112 L335.1,-115.5 L331.6,-121 L328.4,-123.2 L326.3,-124.2 L325.3,-125.2 L324.4,-126.6 L323.5,-128.2 L322.7,-130.1 L322.4,-131.3 L322.3,-133.1 L322.5,-134.2 L322.9,-134.7 L325.4,-135.2 L326.3,-134.9 L327.2,-134 L328,-133.6 L329.9,-138.4 L340.5,-141.2 L344,-141.6 L347.4,-141.6 L346.8,-142.9 L346.4,-144.7 L345.9,-145 L343.3,-144.1 L339.4,-143.1 L337.4,-143.1 L335.4,-143.8 L333.4,-143.4 L331.4,-142 L329.3,-141.1 L327.3,-140.7 L323,-140.9 L322,-141.6 L320.6,-143.3 L320.3,-144.2 L320,-145.3 L319.7,-148.6 L320,-149.5 L320.4,-149.9 L320.8,-150.3 L321.8,-150.3 L322.7,-149.7 L324.9,-147.8 L324.4,-149.9 L330.5,-152.3 L333.4,-154.5 L334.9,-154.8 L336.3,-154.7 L336,-155.8 L336,-156.9 L337.1,-157.7 L337.8,-158.1 L340.1,-158.5 L345.3,-158.4 L347.1,-159 L348.5,-160.6 L347,-160 L345.5,-159.9 L344.9,-160.2 L343.3,-161.5 L342.6,-163.2 L344.6,-166.7 L345.3,-168.4 L343.2,-168.1 L342.5,-167.5 L340.2,-164.3 L338.4,-162.9 L336.2,-162.2 L334,-162.3 L333.6,-162.7 L332.9,-164.9 L332.7,-166 L332.8,-166.6 L333.5,-168.3 L333.8,-170.2 L333.8,-171.8 L333.3,-172.1 L332.4,-170.5 L331.7,-168.4 L330.7,-167.2 L329.7,-167.6 L329.2,-168.4 L328.8,-169.7 L328.5,-170.2 L328,-170.2 L327.1,-169.7 L326.2,-168.7 L326.5,-167.3 L326.6,-165.7 L326.2,-164.4 L325.9,-162.9 L326.8,-162 L327.6,-160.4 L326.4,-159.7 L325.3,-158.8 L324.3,-157.2 L323.2,-156 L321.6,-155.9 L319.5,-155.2 L315.3,-154.9 L313.3,-156.9 L313,-157.8 L312.6,-158.5 L311.3,-159.5 L309.4,-162.6 L307.9,-166.1 L306.9,-166.5 L305.5,-167.6 L304.7,-168.7 L303.9,-170 L303.7,-171.6 L303.8,-173.1 L304.6,-173.8 L302.6,-175.4 L300.6,-177.6 L301.3,-178.4 L302,-178.7 L308.1,-176.1 L308.5,-176.4 L309.1,-177.7 L308.9,-178.1 L307.9,-178.4 L306.5,-178.4 L306.2,-178.7 L305.6,-180.1 L305.2,-181.8 L305,-183 L304.9,-184.3 L305.9,-186.3 L306.5,-188.2 L305.6,-189 L303.1,-189 L302.3,-188.7 L302.6,-186.1 L301.8,-184.3 L300.3,-182.9 L299.2,-183.5 L298.4,-187 L297.3,-189.4 L296.9,-191 L296.6,-193.2 L296.2,-194.8 L295.3,-196.8 L295.3,-198 L295.3,-199 L295.9,-201 L295.5,-202.7 L294.9,-204.3 L294.9,-205.1 L295.4,-206.2 L295.9,-206.6 L296.4,-206.5 L297.9,-205.2 L298.8,-203.6 L299,-203.8 L299.6,-206.1 L300.3,-206.6 L303.3,-207.3 L306.6,-204.4 L307.5,-203.8 L308.2,-203.5 L307.8,-204.8 L307.6,-206.5 L308.1,-207.1 L310.8,-205.7 L312,-205.7 L314.9,-207.8 L319.8,-208.8 L321.6,-207.2 L321.7,-206.3 L321.6,-205.2 L321.6,-204.9 L320.5,-203.6 L314.4,-202.5 L310.4,-198.5 L315.8,-199.2 L316.8,-198.7 L317.2,-195.4 L317.6,-195.1 L319,-194.6 L320,-193.7 L320.9,-191.9 L321.9,-190.6 L322.6,-190.8 L322.8,-192.1 L322.5,-193.7 L322.4,-195.5 L322.5,-197.5 L322.6,-199.1 L323.8,-200.2 L325.5,-204 L327.2,-206.6 L329.2,-205.4 L331,-202.2 L332.7,-197.7 L334.2,-192.9 L336,-187.1 L336.9,-185.1 L337.7,-184.6 L341.3,-178.7 L341.7,-178.5 L340.9,-183 L339.1,-190.7 L337.8,-196.8 L337.5,-199.2 L337.3,-202.4 L337.4,-203.4 L337.6,-204.3 L338.5,-207.9 L339.7,-209.6 L339.3,-212.1 L339.6,-214.1 L340.9,-215.6 L342,-215.7 L343.2,-214.5 L345.3,-210.4 Z M299.6,-166.6 L299.7,-164.4 L301,-164.7 L302.6,-162.4 L304.3,-161.2 L304.8,-160.3 L305.2,-159.2 L306.2,-157 L306.7,-154.8 L305.5,-154.6 L303.8,-157.8 L302.4,-159.6 L300.6,-161.2 L299.2,-161.3 L298.5,-162 L296.2,-167.7 L295.8,-169.1 L294.5,-171.3 L293.9,-174 L293.9,-176.1 L295.6,-175.6 L297.2,-174.2 L298.5,-171.2 L298.8,-170.3 L298.2,-169.1 L298.8,-167.6 L299.6,-166.6 Z M361.5,-224.9 L359.7,-222.8 L356.7,-224.4 L357.1,-226 L357.8,-227 L359.7,-226.6 L361.5,-224.9 Z M446.7,-176.4 L449.1,-176.2 L451.6,-176.7 L452,-176.2 L448.8,-174.4 L445.3,-175.3 L442.1,-175.5 L438.3,-173.7 L437.1,-174.4 L439,-176.3 L441.1,-176.8 L441.4,-178 L442.2,-178.2 L445,-178.3 L446.7,-176.4 Z",
      "pl": "M401.7,284.6 L402.1,285.3 L402.3,285.9 L402.1,286.3 L402.2,286.7 L402.6,287.2 L403.8,288.6 L404.4,289.9 L404.8,290.4 L405.8,291.1 L405.8,291.4 L405.5,291.6 L405.2,291.6 L404.9,291.7 L404.8,291.9 L405,292.2 L405.3,292.6 L405.7,293.6 L405.7,294.5 L405.4,294.7 L405,295.2 L404.7,295.7 L402.6,296 L402.1,296.5 L400.9,297.4 L400.1,298 L398.9,299 L397,300.7 L396.3,301.4 L395.8,302 L394.3,303.5 L393.8,304.2 L393.9,304.7 L394.4,306 L394.5,306.5 L394.4,307.1 L394.2,307.5 L394.3,307.7 L394.7,308.1 L395.4,308.6 L395.5,308.8 L395.4,309 L395.1,309.2 L394.2,309 L393.2,308.6 L392.9,308.7 L392.3,308.6 L390.1,307.9 L388.6,307.4 L388.4,307 L388.2,306.5 L387.5,306.1 L386.1,305.7 L385.4,305.4 L383.1,305.3 L382,305.2 L381.3,305.4 L380.8,305.4 L380.2,306.1 L379.7,306.3 L379.1,306.3 L378.5,306.2 L377.9,305.8 L377,305.6 L376.3,305.7 L375.8,305.6 L375.4,305.6 L375.2,305.7 L374.9,305.7 L374.4,305.9 L373.9,306.1 L373.2,306.3 L372.8,306.8 L372.4,307.6 L371.2,307.3 L370.8,307.4 L370.3,307.5 L369.9,307.4 L370,307.1 L370.1,306.8 L370.1,306.3 L370,305.8 L369.7,305.6 L369.1,305.6 L368.8,305.5 L368.8,305.3 L368.5,305.1 L368.1,304.5 L367.6,303.8 L367.3,303.6 L366.8,303.9 L366.1,304.3 L365.7,304.5 L364.9,305.5 L363.4,305.6 L363.3,305.1 L363.1,304.6 L362.3,304.5 L362.2,304.2 L362.1,303.5 L360.3,302.1 L360.1,301.5 L360.1,301.2 L360,300.9 L359.6,300.7 L358.2,300.4 L357.9,300.5 L357.6,300.4 L357.1,300 L356.2,299.8 L356.1,299.6 L355.8,299.4 L355.6,299.3 L355.5,299.5 L355.2,299.7 L354.3,300 L354,299.9 L353.7,299.6 L353.3,299.1 L352.7,298.7 L352.3,298.6 L352,298.3 L352,298.2 L353,297.8 L353.2,297.4 L353.1,296.8 L352.9,296.7 L352.5,296.9 L351.7,297.1 L350.9,297.2 L350.5,297.2 L348.4,296 L346.9,295.6 L346.1,295.5 L346,295.6 L346.4,296.3 L347.1,297.2 L347,297.4 L346.3,297.7 L345.8,297.9 L345.3,298.2 L344.8,298.6 L344.5,298.7 L344.1,298.7 L343.8,298.5 L342.9,297.3 L341.7,296.3 L341.6,296.1 L341.3,296 L340.8,295.8 L340.6,295.5 L340.8,295.2 L341.2,294.9 L341.8,294.8 L342,294.6 L342.1,294.4 L342.3,294.1 L342.2,293.9 L341.8,293.6 L341.2,293.2 L339.4,293.5 L338.9,293.7 L338.6,293.4 L338.4,293.1 L338,293 L337.4,292.7 L336.6,292.4 L335.9,292.3 L334.4,291.9 L333.8,291.8 L333.5,291.7 L333.2,291.3 L332.9,291 L332.7,290.2 L331.6,289.9 L330.5,289.7 L330.5,289.8 L330.5,290.5 L330.4,290.9 L329.7,291.2 L329,291.2 L329.1,291.1 L329.9,289.7 L330.3,288.9 L330.7,287.3 L330.2,286 L330,285.4 L329.8,285.2 L328.3,284.6 L328.2,284.3 L328.4,283.5 L328.3,283.1 L328,282.8 L327.5,282.1 L327.3,281.4 L327.9,280.7 L328,280.1 L328.3,279.4 L328.5,279 L328.5,278.9 L328.1,278.6 L328,278.2 L328.1,277.6 L327.9,277.1 L327.4,276.9 L327.1,276.5 L326.9,276 L327,275.3 L327.4,274.3 L326.6,273.1 L324.4,271.7 L323.4,270.7 L323.5,270.1 L323.9,269.6 L324.7,269.1 L325.4,268.3 L325.7,267.3 L325.7,267.1 L325.8,266.4 L324.8,263.5 L324.6,262.8 L324.5,261.9 L324.4,261.7 L326.3,262.3 L327.1,262.7 L327,262.3 L326.9,261.9 L327,261.4 L326.9,260.7 L325.2,260.3 L324.1,260.2 L323.9,259.7 L324.1,259.3 L324.4,259.6 L325.5,259.6 L328.2,258.6 L333,257.3 L338,256.1 L339.2,256 L340.4,255.7 L340.8,255.2 L341.3,254.9 L341.9,254.1 L343.5,252.8 L346.2,252.4 L347.2,251.8 L349.3,250.9 L354.1,250 L356.1,249.8 L358,249.8 L359.8,250.5 L361.6,251.4 L362,252 L361,251.6 L359.5,250.8 L359,250.8 L360.2,253.3 L360.9,254.2 L362.3,254.9 L363.5,255.1 L367,254.7 L368.3,254.1 L368.6,253.9 L369,254 L371.3,254.1 L373.6,254.3 L377.4,254.4 L381.3,254.6 L385.4,254.8 L389.8,254.9 L394.5,255.1 L394.8,255 L395.2,254.6 L395.8,254.6 L396.5,254.9 L396.8,255.1 L397,255.3 L397,255.5 L397.4,255.6 L398.1,255.8 L399,256.2 L399.7,256.7 L400.4,257.3 L400.7,258 L400.7,258.8 L400.6,259.3 L400.7,259.5 L401.7,263.1 L403.2,266.5 L403.8,268.2 L404,269.1 L404.2,270.4 L404.3,271.3 L404.3,271.8 L404.2,272.5 L403.7,272.9 L400.7,274.1 L400.1,274.4 L399.2,275.3 L398.4,276.3 L398.2,276.6 L398.1,276.8 L398.3,277.1 L399.4,277.6 L400.5,278 L400.8,278.3 L401.6,278.7 L401.9,279 L402.1,279.3 L402.1,280 L401.7,280.9 L401.9,281.7 L401.5,282.1 L401.2,282.7 L401.1,283.6 L401.7,284.6 Z",
      "pt": "M64.5,444.7 L65.7,445.1 L66.7,445 L68,445.5 L68.7,445.6 L68.1,445.9 L67.4,446.4 L66,446.3 L64.7,445.8 L64.3,445.5 L64.1,445.2 L64.5,444.7 Z M134.1,372.8 L134.9,372.2 L135.6,371.8 L136.1,371.7 L137.8,371.3 L138.3,371.1 L138.7,371.2 L138.8,371.3 L139.1,371.7 L139.4,371.9 L139.4,372.1 L138.7,372.9 L138.6,373.2 L139,373.7 L139.1,373.8 L139.2,373.9 L139.7,373.9 L140.6,373.5 L141.1,373.3 L141.3,373.4 L143,373.2 L143.4,373.3 L143.7,373.5 L144.5,373.7 L145.4,373.7 L146.5,373.4 L147,373.2 L147.1,372.9 L147.2,372.7 L147.3,372.5 L147.5,372.4 L148,372.6 L148.5,372.7 L149.9,372.7 L150.1,372.6 L150.6,372.6 L151.2,372.8 L151.9,372.8 L152.3,373 L152.4,373.3 L152.4,374.1 L152.4,374.8 L152.5,375.1 L153,375.1 L153.8,375.1 L154.5,375.3 L155,375.6 L155.2,376 L155.3,376.2 L155,376.4 L154.6,376.9 L153.7,377.5 L152.4,378.1 L151.3,378.9 L150.6,379.8 L149.7,380.2 L149.5,380.4 L149.4,380.6 L149.9,381.7 L150.1,382.5 L150.3,383.5 L150.2,383.8 L150.1,385 L150,385.3 L150,385.6 L150.2,385.8 L150.3,386.1 L149.9,386.5 L149.2,386.9 L148.6,387.2 L148.5,387.6 L148.5,387.8 L149.4,388.5 L149.6,388.8 L149.5,389.5 L149,390.6 L148.5,391.3 L148.4,391.4 L147.8,391.5 L145,391.6 L144.3,391.7 L144.4,391.9 L145.1,392.7 L145.8,393.2 L146,393.3 L146.2,394.3 L147.3,396 L148.4,396.2 L148.8,396.6 L148.7,397.2 L148.4,397.8 L147.7,398.5 L146.9,398.9 L146.4,399.4 L146.4,399.9 L146.2,400.6 L146,401.1 L145.9,401.5 L147.9,403.7 L149,403.6 L149.1,403.6 L148.9,404.2 L148.6,404.8 L148.2,404.9 L147.2,405.1 L146.3,405.9 L145.6,406.8 L145.1,407.3 L144.6,408.4 L144.7,408.9 L144.9,409.7 L145.4,411.6 L144.7,411.7 L141.9,413 L141,413 L139.4,412.4 L136.5,412.3 L135.5,412.1 L134.4,412.5 L133.5,412.4 L132.8,412.9 L132.2,412.8 L132.8,411.7 L133.8,409.6 L133.7,408.4 L133.9,407.3 L133.7,406.1 L133.2,405.5 L133.9,403.7 L133.8,402.7 L133.2,401.6 L135,401.7 L134.4,401.3 L133.9,401 L133.4,401 L132.9,401 L131.4,401.5 L130.7,401.6 L130.5,401.5 L130.5,400.8 L130.2,399.9 L130.8,399.6 L131.5,399.5 L132.1,399.1 L132.4,398.7 L132.2,397.9 L132.8,397.1 L133.9,396.5 L133.3,396.6 L132.6,397 L131.5,398.4 L131.1,399.2 L130.1,399.4 L129.3,399.5 L128.9,399.4 L128.3,399.3 L128.3,398.7 L128.3,398.3 L128.7,397.4 L128.8,396.2 L129.3,395.1 L129.3,394.8 L129.1,394.3 L129.6,393.9 L130.2,393.6 L131,392.7 L132.2,390.4 L133.6,388 L133.5,387.7 L133.2,387.5 L133.3,386.8 L134.1,384 L134.4,383.6 L134.8,382.7 L134.9,381.4 L135.1,380.4 L135,380 L134.9,379.4 L134.4,378.3 L133.9,376 L133.8,375.2 L134.2,374.8 L133.5,374.8 L133.2,374.3 L133.2,373.7 L134.1,372.8 Z M-0.2,413.4 L-0.3,413.5 L-0.7,413.4 L-1.3,413.5 L-1.6,413.1 L-1.3,412.9 L-0.7,412.9 L-0.4,413 L-0.2,413.4 Z M-50.7,393.8 L-51.1,394.2 L-51.7,394 L-51.9,393.9 L-51.7,393.1 L-51.2,392.9 L-50.7,393.2 L-50.7,393.8 Z M-17.1,400 L-17.3,400 L-19,399.8 L-19.5,399.5 L-19.7,399 L-19.4,398.8 L-18.7,398.7 L-17.6,398.8 L-16.9,399.2 L-16.9,399.7 L-17.1,400 Z M-23,400.7 L-23.4,400.8 L-25.6,400.2 L-26.3,399.9 L-27.3,399.2 L-24.5,400 L-23,400.7 Z M-30.1,400.9 L-30.9,400.9 L-31.7,400.3 L-30.6,400 L-30.2,400.2 L-30,400.4 L-29.8,400.7 L-30.1,400.9 Z M-26,401.5 L-25.3,401.8 L-26.4,401.9 L-26.7,402 L-27.6,401.8 L-28.5,401.9 L-29.2,401.4 L-29.3,401 L-29,400.7 L-28.1,400.7 L-26,401.5 Z M-5.4,406.4 L-4.9,406.5 L-2.2,406.3 L-1.5,406.4 L-1.6,407 L-2.1,407.2 L-3.6,407.4 L-6.1,407 L-6.9,406.5 L-7,406.1 L-7,406 L-6.5,405.8 L-5.4,406.4 Z",
      "ro": "M439.8,342.2 L440.6,343.2 L441.8,343.7 L444.3,344.2 L444.5,344.1 L444.6,344 L444.4,343.9 L444.3,343.7 L444.5,343.5 L444.8,343.5 L445.4,343.7 L446.5,343.4 L448.1,342.7 L449.6,342.5 L451,343 L451.7,343.5 L452.1,344 L452,344.5 L451.9,344.9 L451.5,346.4 L451.3,347 L450.9,347.7 L446.7,348.4 L446.9,348.1 L446.8,347.4 L446.7,346.9 L447.1,346.5 L446.1,346.3 L445.7,346.6 L445.4,347 L445.7,348 L445.2,348.5 L445,348.8 L445,349.5 L444.7,349.8 L444.7,350.1 L445.4,350 L445.1,350.6 L443.8,351.8 L443.3,352.5 L443.5,355.2 L442.9,356.8 L442.9,357.3 L441.5,357.3 L441.1,357.3 L439.9,357.1 L438.4,356.6 L437.6,355.8 L437.1,355.2 L435.9,355.5 L435.6,355.4 L435.3,355.1 L434.4,354.9 L433.3,354.9 L430.8,353.8 L430.5,353.6 L428.5,353.8 L425.5,354.3 L423.3,355 L420.9,356.2 L420,357.1 L418.9,357.6 L417.3,358 L414.5,357.8 L411.6,357.4 L408.5,356.9 L406.8,357.2 L404.5,357 L401.1,356.4 L398.6,356.2 L396,356.5 L395.6,356.3 L395.5,356 L395.6,355.5 L396,355.2 L396.6,354.9 L396.9,354.7 L396.9,354.4 L396.2,354 L394.8,353.4 L394.2,353 L394.1,352.9 L394.1,352.6 L393.8,352.3 L393.2,352.1 L392.8,351.8 L392.5,351.3 L392.6,350.8 L393,350.4 L393.6,350.2 L394.2,350.2 L394.5,350.1 L394.4,349.8 L393.7,349.4 L392.5,348.9 L391.3,349.1 L390.1,350.2 L389.2,350.3 L388.7,349.6 L387.7,349.2 L386.3,349.1 L385.4,348.8 L385.1,348.4 L384.5,348.1 L383.1,347.8 L383.1,347.5 L383.4,347.4 L383.8,347.4 L384.5,347.3 L384.6,347.2 L384.6,347 L384.1,346.8 L383.6,346.6 L383.3,346.5 L383.1,346.4 L383.1,346.2 L383.2,346.1 L383.4,346.1 L383.7,346 L383.7,345.6 L384,345.3 L384.2,345.2 L384.2,345 L384,344.7 L383.7,344.6 L383.3,344.5 L382,344.1 L381.4,343.7 L381,343.7 L380.4,343.4 L379.7,343 L379.1,342.5 L378.5,342.1 L378.3,342 L378.3,341.8 L378.4,341.7 L378.4,341.5 L378.2,340.9 L378.3,340.3 L378.3,339.8 L378.3,339.6 L378.2,339.5 L378.1,339.6 L377.9,339.7 L377.8,339.7 L377.3,339.3 L376.7,338.5 L376.3,338.2 L375.5,337.8 L374.9,337.5 L374.4,336.9 L373.9,336.3 L374.2,336.1 L376.1,335.8 L377,336.1 L377.4,336 L377.8,335.7 L378,335.5 L378,335.3 L378.2,335.1 L378.8,334.9 L380.5,335.1 L381.2,334.7 L381.4,334.5 L381.6,334.1 L381.7,333.7 L382.3,333.6 L382.3,333.2 L382.3,332.9 L382.6,332.1 L382.8,331.8 L383.1,331.7 L383.6,331.4 L384.3,330.9 L384.1,330.4 L384.2,330.1 L385,329.3 L385.6,328.5 L385.6,328.1 L385.6,327.8 L386.1,327.4 L386.7,326.9 L387.3,325.4 L387.6,325.1 L388.1,324.8 L388.4,324.5 L388.4,323.5 L388.7,323.2 L389.4,322.9 L390,322.3 L390.5,321.7 L390.8,321.4 L391.3,321.3 L391.9,321.1 L392.5,321 L393.1,321.1 L393.5,321.1 L394,320.7 L395.5,319.6 L395.7,319.4 L396,319.2 L397.2,318.8 L397.5,318.4 L397.8,318 L398.4,318.1 L400.1,319 L401.9,318.9 L402.2,318.9 L402.3,319 L402.5,319 L405,319.5 L405.3,319.4 L405.5,319.4 L406.4,319.8 L407.3,319.7 L408.1,319.4 L409,319.4 L409.7,319.5 L410.3,320 L411.9,321.1 L412.3,321.5 L413,321.5 L413.8,321.2 L414.6,320.5 L417.1,319.7 L418.9,319.5 L420.7,319.2 L422.8,318.9 L423.4,318.3 L423.8,317.8 L424,316.9 L425.2,316.7 L426.2,316.5 L426.6,316.4 L427.4,316.4 L428,316.5 L428.9,316.9 L429.6,317.4 L429.9,317.8 L430.4,318.4 L431,319.2 L431.7,320.4 L431.8,320.9 L432.1,321.5 L432.5,322.2 L433.5,323 L433.6,323.2 L434,323.8 L434.8,325 L435.5,325.5 L436.1,326.1 L436.4,326.6 L436.8,327.1 L437.8,327.8 L438.6,328.4 L439.3,330.1 L439.7,330.9 L440,331.5 L439.9,332.7 L440,333.2 L439.7,334.2 L439,336.1 L438.8,337.5 L439,338.4 L439,338.9 L439.1,339.2 L439.3,339.9 L439.3,340.5 L439.1,340.7 L438.8,340.8 L438.6,340.9 L438.9,341.2 L439.3,341.7 L439.8,342.2 Z",
      "rs": "M394.2,353 L393.9,353.2 L393.6,353.4 L393.4,353.8 L393.4,354.4 L392.3,354.9 L391.9,355 L391.7,355.3 L391.4,356.3 L391.5,357 L391.6,357.3 L391.7,357.6 L392,358 L392.3,358.6 L392.5,359.3 L393,359.8 L394.2,360.4 L394.8,360.7 L395.2,361.2 L395.5,361.6 L396.5,362.1 L396.4,362.5 L396.2,362.9 L396,363.1 L395.5,363.6 L395,363.9 L394.3,364.8 L393.1,364.8 L392.8,364.9 L392.3,365.1 L392.1,365.5 L392.3,365.9 L392.3,366.2 L392,366.9 L392.3,367.7 L392.8,368 L392.8,368.2 L392.8,368.5 L392.1,369.2 L391.9,369.5 L391.3,369.6 L391.1,369.6 L390.7,369.3 L390.4,369.3 L389.6,369.5 L388.9,369.7 L388.2,369.6 L387.6,369.5 L387.2,369.7 L386.9,369.7 L386.3,370 L385.3,370.2 L384.8,370.2 L384.6,369.9 L384.5,369.5 L384.5,369.3 L385.2,369 L385.3,368.7 L386.2,367.2 L386.4,366.7 L386.4,366.6 L386.2,366.5 L385.6,366.5 L383.4,365.9 L383.5,365.2 L382.8,364.8 L382.1,364.5 L382,364.1 L381.2,363.4 L380.6,363 L379.9,362.8 L379.2,362.4 L378.9,362.3 L378.7,361.9 L378.7,361.7 L378.5,361.5 L378.2,361.5 L377.7,361.8 L377,362 L376.9,362.2 L377.2,362.6 L377.3,362.9 L377.3,363.1 L377,363.5 L375.8,364.2 L375.7,364.4 L375.9,364.8 L375.8,365 L374.8,365.2 L374.8,365 L374.7,364.7 L374.1,364.3 L373.3,364 L371.4,363.1 L370.7,362.9 L370.1,362.8 L369.2,362.3 L368.7,362.3 L368.2,361.9 L367.1,360.8 L366.1,360.2 L365.4,359.9 L365.3,359.6 L365.2,359.3 L365.2,359.2 L365.7,358.7 L366.1,358.6 L366.6,358.6 L366.9,358.9 L367.4,358.9 L367.6,358.6 L367.7,358.2 L367.7,357.7 L366.6,356.4 L365.8,355.6 L365.7,355.4 L365.9,355.2 L366.2,355.2 L366.5,355.2 L367.3,355.3 L368.2,355.2 L368.4,355 L368.4,354.7 L368.2,354.4 L367.2,353.7 L366.4,353.1 L365.6,352.6 L364.9,352.4 L364.7,352.2 L364.6,351.9 L364.7,351.5 L364.7,350.8 L364.9,350.5 L365.5,349.7 L366,349 L366.4,348.2 L366.6,347.5 L366.5,347.3 L366.2,347.2 L365.6,347 L364.7,347.2 L364,347.4 L363.7,347.4 L363.6,347.1 L363.7,347 L364,347 L364.1,347.1 L364.3,346.9 L364.5,346.5 L364.2,345.1 L364.7,344.9 L364.7,344.7 L364.8,344.5 L365.3,344.8 L366.1,344.8 L366.8,344.7 L367,344.6 L366.9,344.4 L366.8,344.2 L366.5,344.1 L366.4,343.9 L365.9,343.8 L364.4,343.3 L363.7,342.7 L363.7,342.1 L363.9,341.8 L364.2,341.7 L364.1,341.6 L363.2,341.3 L362.9,340.9 L363.2,340.4 L362.8,339.4 L362.3,338.8 L362.8,338.5 L362.8,338.1 L362.9,337.9 L363,337.9 L363.8,337.7 L364,337.5 L364.2,337.2 L364.3,337.2 L364.8,337.4 L365.4,337.5 L365.9,337.3 L366.4,337 L366.9,336.9 L367.1,336.7 L367.4,336.5 L368,335.9 L368.7,335.8 L369.6,335.9 L370.6,336 L371.4,335.8 L373.2,336 L373.6,336.2 L373.9,336.3 L374.4,336.9 L374.9,337.5 L375.5,337.8 L376.3,338.2 L376.7,338.5 L377.3,339.3 L377.8,339.7 L377.9,339.7 L378.1,339.6 L378.2,339.5 L378.3,339.6 L378.3,339.8 L378.3,340.3 L378.2,340.9 L378.4,341.5 L378.4,341.7 L378.3,341.8 L378.3,342 L378.5,342.1 L379.1,342.5 L379.7,343 L380.4,343.4 L381,343.7 L381.4,343.7 L382,344.1 L383.3,344.5 L383.7,344.6 L384,344.7 L384.2,345 L384.2,345.2 L384,345.3 L383.7,345.6 L383.7,346 L383.4,346.1 L383.2,346.1 L383.1,346.2 L383.1,346.4 L383.3,346.5 L383.6,346.6 L384.1,346.8 L384.6,347 L384.6,347.2 L384.5,347.3 L383.8,347.4 L383.4,347.4 L383.1,347.5 L383.1,347.8 L384.5,348.1 L385.1,348.4 L385.4,348.8 L386.3,349.1 L387.7,349.2 L388.7,349.6 L389.2,350.3 L390.1,350.2 L391.3,349.1 L392.5,348.9 L393.7,349.4 L394.4,349.8 L394.5,350.1 L394.2,350.2 L393.6,350.2 L393,350.4 L392.6,350.8 L392.5,351.3 L392.8,351.8 L393.2,352.1 L393.8,352.3 L394.1,352.6 L394.1,352.9 L394.2,353 Z",
      "se": "M364.3,215.7 L363.6,216 L363.2,216.9 L362.6,217 L362.1,217.3 L361.9,219.9 L362.9,220.9 L362.4,221 L361.8,221.3 L361.5,221.8 L361.2,222.7 L359.8,223.2 L359.3,223.6 L358.6,224.5 L358.2,225.8 L357.4,226.3 L356.6,226.4 L357.1,225.4 L357.7,224.5 L357.1,224 L356.7,223 L356.3,222.4 L356.6,221.6 L356.4,220.3 L356.5,219 L357.1,218.4 L357.7,217.9 L358.7,216.7 L359.8,215.8 L361.3,215.4 L362,215.8 L362.3,215 L362.8,214.8 L363.3,215 L364.3,215.7 Z M343.2,233.6 L342.8,234.2 L342.4,234.1 L342.1,233.4 L342.1,231.4 L342.2,230.5 L344.1,226.9 L344.9,226.6 L346,224.5 L346.3,223.5 L346.8,222.6 L347.1,221.8 L347.3,221.5 L347.8,221.6 L348.1,221.8 L347.5,222.3 L347.6,222.8 L347.6,223.1 L346.1,225.7 L345.8,227.3 L345.3,227.8 L343.2,233.6 Z M300.7,201.3 L301.4,202.9 L302,203.1 L302.8,202.7 L303.4,201.5 L303.7,199.8 L304.1,198.2 L303.7,196.5 L303.2,194.9 L303.1,194.5 L304.4,193.2 L304.8,192.1 L305.2,191.1 L305.7,190.7 L306.4,190.7 L307.2,190.5 L308.2,189.8 L309.1,188.9 L309.8,188 L310,186.4 L310,185.5 L310.3,184.9 L310.6,183.7 L310.4,182.5 L309.5,180.6 L308.4,178 L308.2,176.6 L308.7,176.3 L309.7,176.1 L311.4,176 L311.6,175.8 L311.8,175.2 L312.2,174.4 L312.6,173.7 L312.9,172.8 L313.1,172 L312,170.8 L310.7,169.5 L309.8,169.1 L308.2,168.1 L307.1,167.2 L307.7,163.7 L308.2,161.2 L308.3,160.6 L308.3,159.6 L306.7,155.4 L306.8,154.5 L307,153.7 L306.8,152.2 L306.7,150.9 L307,150.5 L307.6,149.8 L307,148.7 L306.9,148.6 L305.8,145.8 L307.5,143 L307.2,141.5 L308.3,140.4 L310.2,138 L311.3,136.6 L311.5,136.3 L312.3,135.7 L313.9,135 L315.7,134.7 L316.5,134.7 L319.6,135.2 L322,135.5 L322.3,135.2 L322.8,134.4 L323.5,133.2 L323.5,132 L323.3,130.1 L323,129 L321.3,128.3 L319.4,127.3 L321.7,124.1 L323.3,121.9 L325.2,118.6 L325.8,117.2 L326.3,116.6 L326.9,111.4 L327.2,109.9 L327.6,109.1 L327.6,108.3 L327.4,107 L326.8,103.9 L329.9,103.6 L330.9,103.4 L331.9,103 L333.7,102.1 L334.6,101.2 L334.1,98.3 L335.2,97.3 L337.9,93.9 L340.8,90.6 L342.2,89.3 L342.3,88.7 L342.4,87.7 L341.8,86.1 L341.2,85.1 L339.9,83.3 L340.5,82 L341.4,81.7 L342.6,81.2 L343.6,80.1 L343.7,80 L345.3,75.5 L348.5,73.3 L349.8,72 L351.8,72.9 L354.7,74.3 L356,72.3 L356.4,71.5 L356.8,70.4 L356.7,68.4 L356.6,65.8 L356.7,64.8 L357.9,64.3 L358.5,64.2 L361.7,65.3 L362.6,65.3 L364.1,65.4 L365.8,65.9 L369.3,67.1 L370.8,67.6 L371.7,67.7 L372.4,67.2 L373.9,65.7 L371.6,64.6 L373.1,63.4 L373.9,62.3 L374.5,60.9 L374.8,59.3 L374.7,58.4 L374.2,57.8 L372.9,56.2 L376,56 L377,56 L379.3,57 L379.4,57.2 L379.4,57.7 L379.5,58.3 L381.7,59.6 L382.3,60.3 L383.7,61.4 L384,62 L385.3,62.7 L386.2,63.4 L387.2,64 L388.4,64.9 L390,65.7 L391.4,65.9 L394.9,67.2 L395.5,67.5 L396.5,68.4 L397.5,69.4 L398.2,71.5 L399.3,71.6 L399.6,72.3 L400.6,73.5 L402,74.5 L401.9,74.9 L400.8,75.9 L400.7,77.2 L400.8,78.8 L401.2,80.2 L401.1,80.6 L400.8,81 L400.6,81.8 L400.4,82.4 L400.5,82.7 L400.6,82.9 L401.1,82.9 L402.2,83 L402.8,83.3 L403.1,84.9 L403,85.2 L402.1,85.9 L401.9,86.4 L401.8,87.2 L402,88.1 L402.3,89.1 L403,90.1 L403.9,91.3 L404.5,92.1 L404.7,92.8 L404.9,93.2 L404.4,93.8 L404.1,94.9 L404,96.1 L403.9,97 L403.1,98.1 L402.5,98.5 L402.3,99.1 L402.2,100 L402.4,101.2 L402.5,102 L402.7,102.6 L402.9,103 L404.2,103.7 L404.9,105 L405.4,106.1 L406.2,109 L404.1,109.3 L402.4,108.6 L401.6,109 L400.2,109 L398.5,109.2 L398,109.8 L397.5,110 L396,109.2 L394.6,107.9 L393.6,108.9 L392.9,109.1 L392.3,108.2 L391.7,108.1 L391.4,108.4 L391.2,109.2 L390.8,109.8 L390.7,110.2 L390.6,111.8 L390.5,112.1 L389.2,111.9 L389.2,112.4 L389.5,112.6 L389.7,112.8 L389.2,113.2 L387.8,113.1 L387.6,113.5 L388,114.1 L387.7,114.6 L387.4,114.8 L385.8,115.1 L384.8,115 L384.6,115.3 L384.5,115.7 L384.7,116.2 L385.1,116.4 L385.2,116.7 L385.2,117.2 L384.8,117.3 L383.9,116.3 L383.6,116.4 L383.8,116.9 L384.3,117.5 L384.7,118 L385,118.7 L384.9,119.3 L383.7,120.9 L382.6,122 L381.8,123 L381.3,124 L381.9,124.5 L382.5,125.2 L382.9,126.6 L383.4,127.9 L384.5,129 L384.2,129.7 L384,130.2 L382.3,131.4 L380.3,133.2 L378.2,137.6 L377.5,138.2 L375.6,139 L375,139.7 L373.6,140.6 L371.2,141.3 L370.1,142.3 L369.6,143.3 L369,143.4 L368.5,143 L367.8,142.7 L367.7,143.4 L367.7,143.9 L366.6,143.2 L366,143.8 L365.6,145 L363.9,146.5 L362.1,146.2 L361.9,146.5 L362.4,146.7 L362.5,146.9 L362.1,147.1 L361.6,147.1 L360.9,147.4 L360.4,147.3 L360.1,148.1 L359.8,149 L358.8,149.3 L358.2,149.4 L357.9,149.9 L359.5,150 L359.4,150.4 L359.4,150.8 L359.2,151.3 L357.4,151.9 L357.1,152.4 L356.8,152.7 L356,152.7 L356,152.4 L356.1,152.1 L355,152.1 L354.6,151.4 L354.4,151.6 L354.5,152.2 L354.8,152.8 L355.2,153.7 L354.9,154.2 L354.6,154.5 L354.8,154.8 L355.4,155 L355.7,155.3 L354.9,155.6 L354,156.7 L353,156.7 L352.4,157.3 L351.8,157.3 L351.3,156.9 L350.5,156.6 L350.2,157.2 L350.2,157.7 L350.7,158.9 L351.5,159.9 L352.4,160.3 L351.8,160.6 L351.3,161.2 L350.8,163.1 L350.5,163.9 L350.2,165.2 L350.4,166.4 L350.6,166.9 L351,167.6 L349.9,167.5 L348.7,167.1 L348.9,168 L348.2,169.1 L348.3,170 L348.5,170.6 L348.2,171.6 L348.6,171.9 L348.8,172.5 L348.5,173 L348.6,173.4 L348.6,174.7 L348.9,176.8 L348.8,177.2 L349.4,179 L349.3,179.7 L349.2,180.5 L350.1,181.2 L350.9,181.2 L351.7,181.2 L352,181.4 L352.3,182 L352.6,182.6 L353.2,182.6 L354.3,182 L355,181.9 L355.5,182.9 L356.7,184.2 L357.4,184.8 L358.7,185.1 L360,186.2 L359.8,187.4 L360.3,187.9 L361.9,188.4 L362.4,189 L362.7,189.6 L363.1,190.1 L363.6,191.5 L363.4,192.4 L362.8,192.7 L361.3,193.7 L360.7,194.4 L360.1,194.8 L358.7,195.7 L358.2,195.9 L357.6,196.4 L357.2,196.6 L356.7,196.5 L355.1,197.4 L355.2,197.7 L356.5,197.9 L357.1,197.7 L357.6,197.3 L358.2,197.2 L358.6,197.2 L359.2,196.9 L359.6,196.8 L360,196.9 L360.5,197.8 L359.5,198.2 L358.8,198.2 L358.5,199.6 L358,200.1 L357.7,200.4 L356.2,201 L355.2,201.7 L354,202.3 L353.4,202.2 L352.7,202.8 L350.9,203.5 L350,204.4 L348,205.3 L346.9,206 L344.1,206 L341.5,205.9 L340.6,206.2 L341.5,206.3 L342.1,206.6 L342.8,206.5 L344.5,206.6 L345.4,206.8 L346.5,207.9 L345.7,208.3 L344.2,208.6 L344.8,210.2 L345.2,211.3 L344.6,211.9 L344.6,214.8 L343.8,214.8 L343.4,216 L343.7,216.6 L343.7,218 L343.8,218.9 L344.2,219.7 L344.1,220.5 L342.8,222.4 L342.8,223.3 L343,223.9 L343.2,224.7 L342.6,226.3 L342.2,227.7 L341.7,228.8 L340.6,230.2 L340.1,231.2 L338.8,234.4 L338.2,235 L337.4,235.5 L336.6,235 L335.8,234.8 L334.8,234.8 L333.3,235.2 L331,234.9 L328.8,235.1 L328.2,235.4 L328.6,236.5 L327.7,236.7 L326.9,236.3 L326.2,236.7 L325.6,237.2 L324.5,238.2 L324.1,238.8 L324,239.9 L324.6,241 L325.1,242.2 L323.8,243.6 L323,243.7 L320.7,243.3 L316.7,244.2 L313.1,243.5 L313.6,242.7 L313.6,242.1 L313.7,241.2 L313.9,240.3 L313.8,239.7 L313.6,239.1 L312.7,238.2 L310.7,235.3 L310.1,234.1 L309.7,233.6 L310,233.6 L311.6,234.2 L312,234.2 L312.4,233.9 L311.9,233 L311.5,232.5 L311.2,231.9 L312.2,231.7 L312.9,231.8 L313.4,231 L313.1,229.9 L312.3,229.5 L311.7,229.4 L310.5,227.5 L309.3,226.6 L307,222.9 L306.2,220.3 L305.5,220.6 L305.1,219.4 L304.8,218.4 L304.8,217.6 L303.6,217.1 L303.6,216.6 L303.3,214.1 L302.1,213.8 L301.2,212.4 L301.1,209.7 L300.3,209.3 L299.6,209.4 L299.6,208.7 L299.8,208.1 L299.4,205.7 L299.2,203.4 L298.9,202.7 L298.7,201.9 L298.9,201.2 L299.1,200.8 L300,200.7 L300.7,201.3 Z M364.9,214.7 L364.8,215.5 L364.3,215.4 L364,214.9 L364.8,214 L366,214.1 L366.4,214.2 L364.9,214.7 Z M358.8,201.4 L358.5,201.5 L358.3,201.5 L358.5,200.9 L358.7,200.7 L359.2,200.4 L359.4,200.5 L358.8,201.4 Z M360.3,196 L360.1,196.4 L359.9,195.9 L360,195.8 L360.1,195.3 L360.5,195 L361.1,195.2 L361.1,195.3 L360.5,195.7 L360.3,196 Z",
      "si": "M343.1,332.8 L342.4,332.5 L341.5,332.4 L341.3,332.6 L341,332.7 L340.8,332.9 L340.9,333.8 L340.7,333.9 L339.7,333.8 L339.4,333.9 L338.8,334.5 L338.3,334.8 L337.6,335 L337.1,335.2 L336.4,335.4 L335.8,335.5 L335.6,335.8 L335.5,336 L335.5,336.3 L336.1,336.9 L336.2,337.5 L336.1,338.2 L336,338.5 L335.8,338.8 L334.3,339.1 L332.9,339.7 L332.8,339.8 L333.5,340.4 L333.5,340.5 L333,340.8 L332.9,341.1 L333,341.4 L333.3,341.8 L333.4,342.1 L332.6,342.3 L331.5,342.2 L330.2,341.8 L329.7,341.9 L329.3,342.1 L328.9,342 L328.4,341.7 L327.7,341.2 L327.3,340.8 L327.2,340.5 L327,340.4 L326.7,340.5 L326.5,341 L325.8,341.8 L325.4,342 L324.7,341.9 L323.6,341.9 L323,342 L322.2,341.7 L322.1,341.8 L322.1,342 L321.8,342.3 L321.3,342.5 L319.1,342 L318.8,341.7 L319.3,341.5 L320,341 L320.5,341.1 L321,341 L321.3,340.8 L320.9,340.2 L320,339.5 L319.5,339.2 L318.9,339 L318.8,338.8 L319.1,337.7 L319,337.5 L318.3,337.5 L318.1,337.4 L318,337.2 L318.1,336.9 L318.6,336.5 L319.1,336.1 L319.3,335.9 L319.3,335.7 L318.6,335.5 L318.1,335.3 L317.8,335.3 L317.5,335.4 L317.4,335.3 L317.2,334.9 L317.4,334.4 L318,334 L318.7,333.5 L319.3,333.2 L319.7,333.1 L319.8,332.6 L320.2,332.6 L320.9,332.7 L321.7,332.8 L322.5,332.9 L323.1,333.1 L324.5,333.3 L325.8,333.4 L326.2,333.5 L326.5,333.5 L326.9,333.7 L327.1,333.6 L327.2,333.3 L327.9,333.1 L328.6,332.8 L329,332.4 L329.3,332 L329.7,331.8 L330.2,331.7 L330.6,331.6 L332.4,331.4 L334.2,331.6 L335.1,331.4 L335.8,330.9 L336.9,330.8 L336.9,330.8 L338.5,331.1 L338.6,331 L338.7,330.9 L338.6,330 L339.1,329.6 L339.6,329.4 L341.2,329.5 L341.4,329.8 L341.5,330.2 L341.6,330.7 L341.9,330.9 L342,331.1 L342,331.5 L342.3,331.8 L343,332.6 L343.1,332.8 Z",
      "sk": "M392.9,308.7 L392.8,309.1 L392.4,309.5 L392,310 L391.7,310.6 L391.2,311.8 L390.9,312.4 L389.6,313.5 L389.5,315 L389.3,315.2 L386.5,315.7 L386.1,315.6 L385.7,315.3 L385.5,315.1 L385.4,314.9 L385.1,314.5 L384.8,314.2 L384.3,313.9 L383.9,313.7 L383.3,313.6 L381.8,314.1 L380.7,314.1 L380,314 L379.1,313.7 L377.2,313.7 L375.9,313.9 L375.8,314.2 L374.7,316.1 L373,316.8 L371.5,317.5 L371.1,317.6 L370.3,317.4 L369.5,317 L368.8,316.8 L368.3,316.9 L367.7,317.3 L367.5,317.8 L365.8,318.2 L362.9,318.4 L361.9,318.9 L361.6,319.4 L361.5,319.9 L361.8,320.2 L361.5,320.7 L361.4,320.9 L359.3,321 L356.6,321.1 L354.9,321.1 L353.4,321 L352.4,320.6 L351.1,319.9 L349.7,319 L349.6,318.9 L349.4,318.8 L348.5,318.8 L348.3,318.8 L347.8,318.5 L347.7,318.1 L346.9,317 L346,315.2 L346,314.7 L346.3,314.1 L346.6,313.7 L346.7,313.3 L346.7,313.2 L347,312.5 L347.6,311.5 L348.2,310.9 L348.7,310.7 L349.6,310.9 L351.1,311 L352.3,310.9 L353.4,310.4 L354,310.1 L354.5,309.7 L354.6,309.4 L354.9,309.3 L355.8,309 L356.1,308.8 L356.2,308.2 L356.3,307.7 L356.5,307.2 L356.7,306.9 L358.4,306.1 L358.5,305.9 L358.8,305.6 L359.3,305.3 L359.8,304.9 L360.3,304.7 L361,304.7 L361.6,304.6 L362.1,304.5 L362.3,304.5 L363.1,304.6 L363.3,305.1 L363.4,305.6 L364.9,305.5 L365.7,304.5 L366.1,304.3 L366.8,303.9 L367.3,303.6 L367.6,303.8 L368.1,304.5 L368.5,305.1 L368.8,305.3 L368.8,305.5 L369.1,305.6 L369.7,305.6 L370,305.8 L370.1,306.3 L370.1,306.8 L370,307.1 L369.9,307.4 L370.3,307.5 L370.8,307.4 L371.2,307.3 L372.4,307.6 L372.8,306.8 L373.2,306.3 L373.9,306.1 L374.4,305.9 L374.9,305.7 L375.2,305.7 L375.4,305.6 L375.8,305.6 L376.3,305.7 L377,305.6 L377.9,305.8 L378.5,306.2 L379.1,306.3 L379.7,306.3 L380.2,306.1 L380.8,305.4 L381.3,305.4 L382,305.2 L383.1,305.3 L385.4,305.4 L386.1,305.7 L387.5,306.1 L388.2,306.5 L388.4,307 L388.6,307.4 L390.1,307.9 L392.3,308.6 L392.9,308.7 Z",
    };

// Found: al, at, ba, be, bg, ch, cz, de, dk, ee, es, fi, fr, gb, gr, hr, hu, ie, is, it, lt, lu, lv, me, mk, nl, no, pl, pt, ro, rs, se, si, sk


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
        <svg viewBox="0 0 500 440" style="width:100%;height:100%;max-height:155px;overflow:visible">${svgPaths}</svg>
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
