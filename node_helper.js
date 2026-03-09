/* MMM-REnergy — node_helper.js
 *
 * Data source: Fraunhofer ISE Energy-Charts API (CC BY 4.0)
 *   https://api.energy-charts.info
 *
 * Configurable via config.country:
 *   Any ISO 3166-1 alpha-2 code supported by the API (de, fr, at, es, it, …)
 *   "eu"    → EU-27 aggregate
 *   "alleu" → all ENTSO-E tracked European countries
 *
 * API endpoints used:
 *   /public_power?country=XX&start=YYYY-MM-DD&end=YYYY-MM-DD
 *   /ren_share_daily_avg?country=XX
 *   /installed_power?country=XX&time_step=yearly|monthly
 *
 * Carrier name patterns (case-insensitive, work across countries/languages):
 *   Wind onshore : /wind on/i
 *   Wind offshore: /wind off/i
 *   Solar        : /solar|photovoltaic/i
 *   Biomass      : /biomass/i
 *   Hard coal    : /hard coal|coal/i   (matched before generic "coal")
 *   Lignite      : /lignite|brown coal/i
 *   Gas          : /natural gas|gas/i
 */

"use strict";

const NodeHelper = require("node_helper");
const https      = require("https");

const TAG = "MMM-REnergy";
const EC  = { BASE: "https://api.energy-charts.info" };

module.exports = NodeHelper.create({

  start() {
    console.log(`[${TAG}] node_helper started`);
    this._lastGoodData = null;
    this._retryTimer   = null;
    this._country      = "de";
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "FETCH_ENERGY_DATA") {
      this._country = payload.country || "de";
      this.fetchAllData(payload.chartDays || 30);
    }
  },

  // ── Main orchestrator ─────────────────────────────────────────
  async fetchAllData(chartDays) {
    const t0 = Date.now();
    const cc = this._country;
    console.log(`[${TAG}] fetchAllData start (country=${cc})`);

    try {
      // 1. Yesterday's generation via /public_power
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const ymd = yesterday.toISOString().slice(0, 10); // "YYYY-MM-DD"

      const [ppData, renAvgData] = await Promise.all([
        this.fetchJson(`${EC.BASE}/public_power?country=${cc}&start=${ymd}&end=${ymd}`),
        this.fetchJson(`${EC.BASE}/ren_share_daily_avg?country=${cc}`),
      ]);

      if (!ppData?.production_types?.length || !ppData?.unix_seconds?.length) {
        throw new Error("energy-charts /public_power returned no data");
      }

      // 2. Extract carrier totals from 15-min MW values
      // GWh = sum(MW_i * 0.25 h) / 1000   |   Peak GW = max(MW_i) / 1000
      const find    = (pat) => ppData.production_types.find((p) => pat.test(p.name));
      const findAll = (pat) => ppData.production_types.filter((p) => pat.test(p.name));

      const sumGWhPts = (...pts) =>
        pts.reduce((total, pt) => {
          if (!pt?.data) return total;
          return total + pt.data.reduce((s, v) => s + (v !== null ? v * 0.25 : 0), 0);
        }, 0) / 1000;

      const peakGWPts = (...pts) => {
        let max = 0;
        for (const pt of pts) {
          if (!pt?.data) continue;
          for (const v of pt.data) { if (v !== null && v > max) max = v; }
        }
        return max / 1000;
      };

      // avgGW: mean over ALL 15-min slots including null→0 (solar nights count as 0)
      const avgGWPts = (...pts) => {
        let sum = 0, n = 0;
        for (const pt of pts) {
          if (!pt?.data?.length) continue;
          n = Math.max(n, pt.data.length);
          for (const v of pt.data) sum += (v !== null ? v : 0);
        }
        return n ? (sum / n) / 1000 : 0;
      };

      const windOn   = find(/wind on/i);
      const windOff  = find(/wind off/i);
      const solarPts = findAll(/solar|photovoltaic/i);
      const biomass  = find(/biomass/i);
      const coal     = find(/hard coal|coal/i);
      const lignite  = find(/lignite|brown coal/i);
      const gas      = find(/natural gas|gas/i);
      console.log(`[${TAG}] Carriers: ${ppData.production_types.map((p) => p.name).join(", ")}`);

      const windGWh    = sumGWhPts(windOn, windOff);
      const solarGWh   = sumGWhPts(...solarPts);
      const biomassGWh = sumGWhPts(biomass);
      const coalGWh    = sumGWhPts(coal, lignite);
      const gasGWh     = sumGWhPts(gas);
      const totalGWh   = windGWh + solarGWh + biomassGWh + coalGWh + gasGWh;

      if (totalGWh < 10) {
        throw new Error(`energy-charts total only ${totalGWh.toFixed(1)} GWh — data likely not yet available`);
      }

      const pct = (gwh) => Math.round((gwh / totalGWh) * 100);

      // Two renewable definitions:
      // "Wind+Solar" matches the energy-charts.info renewable_share chart definition.
      // "Full" adds biomass/hydro for a broader picture.
      const renewWindSolarPct = pct(windGWh + solarGWh);
      const renewFullPct      = pct(windGWh + solarGWh + biomassGWh);

      const windAvgGW   = avgGWPts(windOn, windOff);
      const windPeakGW  = peakGWPts(windOn, windOff);
      const solarPeakGW = peakGWPts(...solarPts);
      const solarAvgGW  = avgGWPts(...solarPts);

      const windHistory  = this._buildDaySparkline(windOn, windOff);
      const solarHistory = this._buildDaySparkline(...solarPts);

      console.log(`[${TAG}] ${ymd}: wind=${windGWh.toFixed(0)} solar=${solarGWh.toFixed(0)} biomass=${biomassGWh.toFixed(0)} coal=${coalGWh.toFixed(0)} gas=${gasGWh.toFixed(0)} total=${totalGWh.toFixed(0)} GWh`);
      console.log(`[${TAG}] Renewable: ${renewWindSolarPct}% (wind+solar) / ${renewFullPct}% (incl. biomass)`);

      // 3. 30-day renewable average from ren_share_daily_avg
      let renewableAvg30 = 0;
      if (renAvgData?.data?.length) {
        const recent = renAvgData.data.filter((v) => v !== null).slice(-30);
        if (recent.length) renewableAvg30 = Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);
      }
      const renewableHistory = renAvgData?.data
        ? renAvgData.data.filter((v) => v !== null).slice(-chartDays).map(Math.round)
        : [];
      console.log(`[${TAG}] 30-day renewable avg: ${renewableAvg30}%`);

      // 4. Supplementary data — all fetched in parallel
      const [monthlyMixData, weeklyData, expansionData, batteryData, euMapData] = await Promise.all([
        this.fetchMonthlyMix(cc),
        this.fetchWeeklyStacked(cc),
        this.fetchInstalledPower(cc, 30),  // needs 2024 baseline + full 2025 + 2026 months
        this.fetchBatteryHistory(cc),
        this.fetchEuropeRenShare(),
      ]);

      // 5. Assemble result object
      const result = {
        country: cc,
        wind: {
          avgGW:    parseFloat(windAvgGW.toFixed(2)),
          maxGW:    parseFloat(windPeakGW.toFixed(1)),
          totalGWh: parseFloat(windGWh.toFixed(1)),
          history:  windHistory,
        },
        solar: {
          avgGW:    parseFloat(solarAvgGW.toFixed(2)),
          maxGW:    parseFloat(solarPeakGW.toFixed(1)),
          totalGWh: parseFloat(solarGWh.toFixed(1)),
          history:  solarHistory,
        },
        renewablePercent:     renewWindSolarPct,
        renewablePercentFull: renewFullPct,
        renewableAvg30,
        renewableHistory,
        totalTWh: parseFloat((totalGWh / 1000).toFixed(3)),
        mix: {
          wind:    pct(windGWh),
          solar:   pct(solarGWh),
          biomass: pct(biomassGWh),
          coal:    pct(coalGWh),
          gas:     pct(gasGWh),
          other:   Math.max(0, 100 - pct(windGWh) - pct(solarGWh) - pct(biomassGWh) - pct(coalGWh) - pct(gasGWh)),
        },
        expansion:      expansionData,
        monthlyMix:     monthlyMixData,
        weeklyStacked:  weeklyData,
        battery:        batteryData,
        europeRenShare: euMapData,
        lastUpdate: new Date().toLocaleString("en-GB", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
        dataDate: ymd,
      };

      this._lastGoodData = result;
      if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
      this.sendSocketNotification("ENERGY_DATA_RESULT", result);
      console.log(`[${TAG}] fetchAllData done in ${Date.now() - t0} ms`);

    } catch (err) {
      console.error(`[${TAG}] fetchAllData error: ${err.message}`);
      if (this._lastGoodData) {
        console.log(`[${TAG}] Sending cached data (from ${this._lastGoodData.lastUpdate})`);
        this.sendSocketNotification("ENERGY_DATA_RESULT", this._lastGoodData);
      }
      if (!this._retryTimer) {
        const delay = err.message.includes("not yet available") ? 20 * 60 * 1000 : 5 * 60 * 1000;
        this._retryTimer = setTimeout(() => { this._retryTimer = null; this.fetchAllData(chartDays); }, delay);
      }
      if (!this._lastGoodData) {
        this.sendSocketNotification("ENERGY_DATA_RESULT", { error: err.message });
      }
    }
  },

  // ── Intraday sparkline (~48 points downsampled from 15-min data) ──
  _buildDaySparkline(...pts) {
    const n    = pts[0]?.data?.length || 0;
    if (n === 0) return [];
    const step = Math.max(1, Math.floor(n / 48));
    const out  = [];
    for (let i = 0; i < n; i += step) {
      let sum = 0, count = 0;
      for (const pt of pts) {
        if (!pt?.data) continue;
        for (let j = i; j < Math.min(i + step, n); j++) {
          if (pt.data[j] !== null) { sum += pt.data[j]; count++; }
        }
      }
      out.push(parseFloat((count ? sum / count / 1000 : 0).toFixed(2)));
    }
    return out;
  },

  // ── Monthly power mix (current month to date) ─────────────────
  async fetchMonthlyMix(cc) {
    try {
      const now   = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const end   = now.toISOString().slice(0, 10);
      const data  = await this.fetchJson(`${EC.BASE}/public_power?country=${cc}&start=${start}&end=${end}`);
      if (!data?.production_types?.length) return null;

      const find    = (pat) => data.production_types.find((p) => pat.test(p.name));
      const findAll = (pat) => data.production_types.filter((p) => pat.test(p.name));
      const sumGWh  = (pt)  => (pt?.data?.reduce((s, v) => s + (v !== null ? v * 0.25 : 0), 0) ?? 0) / 1000;
      const sumAll  = (...pts) => pts.reduce((t, pt) => t + sumGWh(pt), 0);

      const windGWh    = sumAll(find(/wind on/i), find(/wind off/i));
      const solarGWh   = sumAll(...findAll(/solar|photovoltaic/i));
      const biomassGWh = sumGWh(find(/biomass/i));
      const coalGWh    = sumAll(find(/hard coal|coal/i), find(/lignite|brown coal/i));
      const gasGWh     = sumGWh(find(/natural gas|gas/i));
      const totalGWh   = windGWh + solarGWh + biomassGWh + coalGWh + gasGWh;
      if (totalGWh < 1) return null;

      const pct    = (v) => Math.round((v / totalGWh) * 100);
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return {
        wind: pct(windGWh), solar: pct(solarGWh), biomass: pct(biomassGWh),
        coal: pct(coalGWh), gas:   pct(gasGWh),
        other: Math.max(0, 100 - pct(windGWh) - pct(solarGWh) - pct(biomassGWh) - pct(coalGWh) - pct(gasGWh)),
        totalTWh: totalGWh / 1000,
        month: now.getMonth(), year: now.getFullYear(),
        monthName: MONTHS[now.getMonth()],
      };
    } catch (e) {
      console.warn(`[${TAG}] fetchMonthlyMix error: ${e.message}`);
      return null;
    }
  },

  // ── Weekly stacked generation (last 7 days, ~84 points downsampled) ───
  async fetchWeeklyStacked(cc) {
    try {
      const end   = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const s    = start.toISOString().slice(0, 10);
      const e    = end.toISOString().slice(0, 10);
      const data = await this.fetchJson(`${EC.BASE}/public_power?country=${cc}&start=${s}&end=${e}`);
      if (!data?.production_types?.length || !data?.unix_seconds?.length) return null;

      const find    = (pat) => data.production_types.find((p) => pat.test(p.name));
      const findAll = (pat) => data.production_types.filter((p) => pat.test(p.name));

      // Merge multiple carriers into a single time series
      const merge = (...pts) => {
        const len = Math.max(0, ...pts.map((p) => p?.data?.length ?? 0));
        const out = new Array(len).fill(0);
        for (const pt of pts) {
          if (!pt?.data) continue;
          pt.data.forEach((v, i) => { if (v !== null) out[i] += v; });
        }
        return out;
      };

      const windData    = merge(find(/wind on/i), find(/wind off/i));
      const solarData   = merge(...findAll(/solar|photovoltaic/i));
      const biomassData = find(/biomass/i)?.data          ?? [];
      const coalData    = merge(find(/hard coal|coal/i), find(/lignite|brown coal/i));
      const gasData     = find(/natural gas|gas/i)?.data  ?? [];

      const n    = data.unix_seconds.length;
      const step = Math.max(1, Math.floor(n / 84));
      const result = { timestamps: [], wind: [], solar: [], biomass: [], coal: [], gas: [] };

      for (let i = 0; i < n; i += step) {
        result.timestamps.push(data.unix_seconds[i]);
        const f = (v) => parseFloat(((v ?? 0) / 1000).toFixed(2));
        result.wind.push(f(windData[i]));
        result.solar.push(f(solarData[i]));
        result.biomass.push(f(biomassData[i] ?? 0));
        result.coal.push(f(coalData[i]));
        result.gas.push(f(gasData[i] ?? 0));
      }
      return result;
    } catch (e) {
      console.warn(`[${TAG}] fetchWeeklyStacked error: ${e.message}`);
      return null;
    }
  },

  // ── European renewable share map ─────────────────────────────
  // Fetches ren_share_daily_avg for each country in batches of 5 with a
  // 400 ms delay between batches to stay within the API rate limit.
  // Norway is excluded — it does not report to the ENTSO-E transparency platform.
  async fetchEuropeRenShare() {
    const COUNTRIES = [
      "de","at","ch","fr","nl","be","lu",
      "pl","cz","sk","hu","ro","bg",
      "dk","se","fi","ee","lv","lt",
      "gb","ie","es","pt","it",
      "hr","si","rs","al","gr","ba","mk",
    ];
    const BATCH = 5;
    const DELAY = 400;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const map   = {};

    try {
      for (let b = 0; b < COUNTRIES.length; b += BATCH) {
        const settled = await Promise.allSettled(
          COUNTRIES.slice(b, b + BATCH).map((code) =>
            this.fetchJson(`${EC.BASE}/ren_share_daily_avg?country=${code}`)
              .then((d) => {
                if (!Array.isArray(d?.data)) return null;
                for (let i = d.data.length - 1; i >= 0; i--) {
                  if (d.data[i] != null) return { code, pct: Math.round(d.data[i]) };
                }
                return null;
              })
              .catch(() => null)
          )
        );
        for (const r of settled) {
          if (r.status === "fulfilled" && r.value) map[r.value.code] = r.value.pct;
        }
        if (b + BATCH < COUNTRIES.length) await sleep(DELAY);
      }
      const count = Object.keys(map).length;
      console.log(`[${TAG}] EuropeRenShare: ${count} countries — DE=${map["de"]}% FR=${map["fr"]}% SE=${map["se"]}%`);
      return count > 0 ? map : null;
    } catch (e) {
      console.warn(`[${TAG}] fetchEuropeRenShare error: ${e.message}`);
      return null;
    }
  },

  // ── Installed power history (wind + solar cumulative GW) ──────
  // API field names confirmed from live logs (energy-charts.info, country=de):
  //   Solar monthly: "Solar DC" (use this — DC-side installed capacity, authoritative)
  //                  "Solar AC" (lower value, ignore)
  //   Solar yearly:  "Solar DC"=undefined, "Solar AC"=undefined,
  //                  "Solar planned (EEG 2023)"=215 GW (planning value — never use)
  //     → yearly solar data is unusable; build solar anchors from monthly data only
  //   Wind monthly+yearly: "Wind onshore", "Wind offshore" (sum both)
  //     → yearly wind also returns undefined for DE; build wind anchors from monthly too
  //
  // Strategy: use monthly data exclusively.
  //   yearlyAnchors built from the last available monthly datapoint of each year
  //   (i.e. the December value, or the latest available month for the current year).
  //   SKIP=3 is applied only to the series window, NOT to anchor calculation
  //   (anchors look back further to find Dec of prior years).
  async fetchInstalledPower(cc, months) {
    try {
      const SKIP = 3; // MaStR registration lag — skip last 3 months for display series

      const monthly = await this.fetchJson(
        `${EC.BASE}/installed_power?country=${cc}&time_step=monthly&installation_decommission=false`
      );

      if (!monthly?.time?.length || !monthly?.production_types?.length) {
        console.warn(`[${TAG}] fetchInstalledPower: monthly data empty`);
        return null;
      }


      // Time format from API is "MM.YYYY" (e.g. "01.2002", "03.2026")
      const parseTime = (t) => {
        const s = String(t || "");
        if (s.includes(".")) {
          // MM.YYYY format
          const [mm, yyyy] = s.split(".");
          return { year: parseInt(yyyy, 10) || 0, month: (parseInt(mm, 10) || 1) - 1 };
        }
        // Fallback: YYYY-MM format
        const [yyyy, mm] = s.split("-");
        return { year: parseInt(yyyy, 10) || 0, month: (parseInt(mm, 10) || 1) - 1 };
      };

      const findIn = (pat) => monthly.production_types.find((p) => pat.test(p.name));

      // Solar DC is the authoritative installed capacity field (AC is always lower)
      // Explicitly exclude planning/forecast fields ("planned", "EEG")
      const mSolarDC  = findIn(/solar\s*dc/i);
      const mWindOn   = findIn(/wind.*on|onshore.*wind/i);
      const mWindOff  = findIn(/wind.*off|offshore.*wind/i);

      if (!mSolarDC) {
        console.warn(`[${TAG}] fetchInstalledPower: "Solar DC" field not found — available: ${monthly.production_types.map((p) => p.name).join(", ")}`);
      }
      const nM    = monthly.time.length;
      const limit = Math.max(0, nM - SKIP); // last index to include in display series

      // ── Build yearlyAnchors from monthly data ──────────────────
      // For each year: take the LAST available monthly datapoint of that year.
      // We scan ALL monthly data (ignoring SKIP) so Dec values are always captured.
      const yearlyAnchors = {};
      for (let i = 0; i < nM; i++) {
        const { year: yr, month } = parseTime(monthly.time[i]);
        if (yr < 2020) continue;
        const windGW  = parseFloat(((mWindOn?.data?.[i] ?? 0) + (mWindOff?.data?.[i] ?? 0)).toFixed(2));
        const solarGW = parseFloat((mSolarDC?.data?.[i] ?? 0).toFixed(2));
        if (windGW > 0 || solarGW > 0) yearlyAnchors[yr] = { windGW, solarGW };
      }
      const anchorYears = Object.keys(yearlyAnchors).sort();
      const anchorLast  = yearlyAnchors[anchorYears[anchorYears.length - 1]];
      console.log(`[${TAG}] Anchors built from monthly: years=${anchorYears.join(",")} latest wind=${anchorLast?.windGW} solar=${anchorLast?.solarGW} GW`);

      // ── Build display series (SKIP-trimmed window) ─────────────
      const start  = Math.max(0, limit - months);
      const series = [];
      for (let i = start; i < limit; i++) {
        const { year, month } = parseTime(monthly.time[i]);
        if (year < 2020) continue;
        const windGW  = parseFloat(((mWindOn?.data?.[i] ?? 0) + (mWindOff?.data?.[i] ?? 0)).toFixed(2));
        const solarGW = parseFloat((mSolarDC?.data?.[i] ?? 0).toFixed(2));
        if (windGW > 0 || solarGW > 0) series.push({ year, month, windGW, solarGW });
      }

      if (!series.length) {
        console.warn(`[${TAG}] fetchInstalledPower: series empty after SKIP trim`);
        return null;
      }

      const last = series[series.length - 1];
      console.log(`[${TAG}] Series: ${series.length} months, last=${last.year}-${last.month + 1} wind=${last.windGW} solar=${last.solarGW} GW`);
      return { series, yearlyAnchors, isMonthly: true };
    } catch (e) {
      console.warn(`[${TAG}] fetchInstalledPower error: ${e.message}`);
      return null;
    }
  },

  // ── Battery storage capacity history (yearly cumulative GWh) ──
  async fetchBatteryHistory(cc) {
    try {
      const data = await this.fetchJson(`${EC.BASE}/installed_power?country=${cc}&time_step=yearly`);
      if (!data?.time?.length || !Array.isArray(data.production_types)) return null;

      // Try patterns in order: prefer "capacity" (GWh) over "power" (GW)
      const PATTERNS = [
        /battery storage.*capacity/i,
        /battery storage.*power/i,
        /battery/i,
        /speicher/i,
      ];
      let entry = null;
      for (const pat of PATTERNS) {
        entry = data.production_types.find((pt) => pat.test(pt.name));
        if (entry) { console.log(`[${TAG}] Battery matched: "${entry.name}"`); break; }
      }
      if (!entry?.data?.length) { console.warn(`[${TAG}] No battery data found`); return null; }

      const series = [];
      for (let i = 0; i < Math.min(entry.data.length, data.time.length); i++) {
        const v = entry.data[i];
        if (v != null && v > 0) {
          const year = parseInt(String(data.time[i] || "").slice(0, 4), 10) || 0;
          if (year > 2000) series.push({ year, month: 0, value: parseFloat(v.toFixed(2)) });
        }
      }
      if (!series.length) return null;
      const trimmed = series.slice(-36);
      const last    = trimmed[trimmed.length - 1];
      console.log(`[${TAG}] Battery: ${trimmed.length} years, latest=${last.value} GWh (${last.year})`);
      return { series: trimmed, latestValue: last.value, latestYear: last.year, unit: "GWh" };
    } catch (e) {
      console.warn(`[${TAG}] fetchBatteryHistory error: ${e.message}`);
      return null;
    }
  },

  // ── Low-level HTTP JSON fetch ──────────────────────────────────
  fetchJson(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { "User-Agent": "MagicMirror/MMM-REnergy (https://github.com)" },
      }, (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${url}`));
            return;
          }
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
        });
      });
      req.on("error", reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    });
  },
});
