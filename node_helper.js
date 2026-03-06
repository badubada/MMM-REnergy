/* MMM-REnergy – node_helper.js
 * Primary data source: Fraunhofer ISE Energy-Charts API (CC BY 4.0)
 *   https://api.energy-charts.info/public_power  — yesterday's generation by carrier (GW, 15-min)
 *   https://api.energy-charts.info/ren_share_daily_avg — daily avg renewable share (last 365 days)
 * Secondary data source: Bundesnetzagentur SMARD API (CC BY 4.0)
 *   Used only for: expansion history, weekly stacked, battery history
 *   SMARD is unreliable early morning (data not yet finalized) — energy-charts has no such issue.
 *
 * energy-charts /public_power response:
 *   { unix_seconds: [int,...], production_types: [{name, data:[GW|null,...]},...], deprecated }
 *   Names for DE: "Wind Onshore", "Wind Offshore", "Photovoltaics", "Biomass",
 *                 "Hard Coal", "Lignite", "Natural Gas", "Run of River", "Pumped Storage",
 *                 "Others", "Nuclear", "Load", "Residual load", "Renewable share of load"
 *
 * ren_share_daily_avg response:
 *   { days: ["dd.mm.yyyy",...], data: [float|null,...], deprecated }
 */

"use strict";

const NodeHelper = require("node_helper");
const https      = require("https");

const TAG = "MMM-REnergy";

// ── Energy-Charts API ─────────────────────────────────────────
const EC = {
  BASE: "https://api.energy-charts.info",
};

// ── SMARD API (secondary — for historical charts only) ────────
const SMARD = {
  BASE: "https://www.smard.de/app/chart_data",
  FILTERS: {
    windOnshore:  4067,   // Wind onshore
    windOffshore: 1225,   // Wind offshore
    solar:        4068,   // Photovoltaik
    biomass:      4066,   // Biomasse
    coal:         1223,   // Steinkohle
    lignite:      1224,   // Braunkohle
    gas:          4169,   // Erdgas
  },
};

module.exports = NodeHelper.create({

  start () {
    console.log(`[${TAG}] node_helper started — primary: energy-charts.info, secondary: SMARD`);
    this._lastGoodData = null;
    this._retryTimer   = null;
  },

  socketNotificationReceived (notification, payload) {
    if (notification === "FETCH_ENERGY_DATA") {
      this.fetchAllData(payload.chartDays || 30);
    }
  },

  // ── Main data fetch ───────────────────────────────────────────
  async fetchAllData (chartDays) {
    const t0 = Date.now();
    console.log(`[${TAG}] fetchAllData start`);

    try {
      // ── 1. Yesterday via energy-charts /public_power ──────────
      // No start/end → returns today. We want yesterday: subtract 1 day.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const ymd = yesterday.toISOString().slice(0, 10); // "YYYY-MM-DD"

      const [ppData, renAvgData] = await Promise.all([
        this.fetchJson(`${EC.BASE}/public_power?country=de&start=${ymd}&end=${ymd}`),
        this.fetchJson(`${EC.BASE}/ren_share_daily_avg?country=de`),
      ]);

      if (!ppData?.production_types?.length || !ppData?.unix_seconds?.length) {
        throw new Error("energy-charts /public_power returned no data");
      }

      // ── 2. Extract carrier totals from 15-min GW values ───────
      // Sum GW values × 0.25h = GWh per 15-min slot → total GWh for the day
      // Case-insensitive find — API names vary ("Wind onshore" vs "Wind Onshore", "Solar DC"/"Solar AC" etc.)
      const find      = (pat) => ppData.production_types.find((p) => pat.test(p.name));
      const findAll   = (pat) => ppData.production_types.filter((p) => pat.test(p.name));

      // API values are in MW (not GW).
      // GWh = sum(MW_i * 0.25h) / 1000
      // Peak GW = max(MW_i) / 1000
      // Avg GW  = mean over ALL slots (incl. zeros for solar nights) / 1000
      const sumGWhPts = (...pts) => pts.reduce((total, pt) => {
        if (!pt?.data) return total;
        return total + pt.data.reduce((s, v) => s + (v !== null ? v * 0.25 : 0), 0);
      }, 0) / 1000;   // MW*h → GWh
      const peakGWPts = (...pts) => {
        let max = 0;
        for (const pt of pts) { if (!pt?.data) continue; for (const v of pt.data) { if (v !== null && v > max) max = v; } }
        return max / 1000;  // MW → GW
      };
      // avgGW: sum all slots (including null→0) divided by total slot count
      // This matches "mean power over 24h" — for solar, nights count as 0
      const avgGWPts = (...pts) => {
        let sum = 0, n = 0;
        for (const pt of pts) {
          if (!pt?.data?.length) continue;
          n = Math.max(n, pt.data.length);  // use max slot count across carriers
          for (const v of pt.data) sum += (v !== null ? v : 0);
        }
        return n ? (sum / n) / 1000 : 0;  // MW → GW, all slots
      };
      const sumGWh = (pt) => sumGWhPts(pt);
      const peakGW = (pt) => peakGWPts(pt);
      const avgGW  = (pt) => avgGWPts(pt);

      const windOn   = find(/wind on/i);
      const windOff  = find(/wind off/i);
      const solarPts = findAll(/solar|photovoltaic/i); // "Solar DC" + "Solar AC" or "Photovoltaics"
      const biomass  = find(/biomass/i);
      const coal     = find(/hard coal|steinkohle/i);
      const lignite  = find(/lignite|braunkohle/i);
      const gas      = find(/natural gas|erdgas/i);
      console.log(`[${TAG}] Carriers: ${ppData.production_types.map((p) => p.name).join(", ")}`);

      const windOnGWh  = sumGWh(windOn);
      const windOffGWh = sumGWh(windOff);
      const solarGWh   = sumGWhPts(...solarPts);
      const biomassGWh = sumGWh(biomass);
      const coalGWh    = sumGWh(coal) + sumGWh(lignite);
      const gasGWh     = sumGWh(gas);
      const windGWh    = windOnGWh + windOffGWh;

      const totalGWh = windGWh + solarGWh + biomassGWh + coalGWh + gasGWh;
      if (totalGWh < 10) {
        throw new Error(`energy-charts total only ${totalGWh.toFixed(1)} GWh — data likely not yet available`);
      }

      const pct = (gwh) => Math.round((gwh / totalGWh) * 100);

      // Renewable % definitions:
      // Wind+Solar only → matches energy-charts.info renewable_share chart
      const renewWindSolarPct = pct(windGWh + solarGWh);
      const renewFullPct      = pct(windGWh + solarGWh + biomassGWh);

      // Peak and avg GW for wind/solar tiles
      const windAvgGW   = avgGWPts(windOn, windOff);
      const windPeakGW  = peakGWPts(windOn, windOff);
      const solarPeakGW = peakGWPts(...solarPts);
      const solarAvgGW  = avgGWPts(...solarPts);

      // History sparkline for wind/solar tiles: daily GW averages from ren_share_daily_avg
      // We use the 15-min values per carrier for today to build an intraday sparkline
      const windHistory  = this._buildDaySparkline(windOn, windOff);
      const solarHistory = this._buildDaySparkline(...solarPts);

      console.log(`[${TAG}] Yesterday ${ymd}: wind=${windGWh.toFixed(0)} GWh solar=${solarGWh.toFixed(0)} GWh biomass=${biomassGWh.toFixed(0)} GWh coal=${coalGWh.toFixed(0)} GWh gas=${gasGWh.toFixed(0)} GWh total=${totalGWh.toFixed(0)} GWh`);
      console.log(`[${TAG}] wind peak=${windPeakGW.toFixed(1)} GW  solar peak=${solarPeakGW.toFixed(1)} GW`);
      console.log(`[${TAG}] Renewable: ${renewWindSolarPct}% (Wind+Solar) / ${renewFullPct}% (incl. Biomasse)`);

      // ── 3. 30-day renewable average from ren_share_daily_avg ──
      // Response: { days:["dd.mm.yyyy",...], data:[float|null,...] }
      // Wind+Solar only share (matches energy-charts.info definition)
      let renewableAvg30 = 0;
      if (renAvgData?.data?.length) {
        const recent = renAvgData.data.filter((v) => v !== null).slice(-30);
        if (recent.length > 0) {
          renewableAvg30 = Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);
        }
      }
      // Build renewable history array (last chartDays values) for sparkline
      const renewableHistory = renAvgData?.data
        ? renAvgData.data.filter((v) => v !== null).slice(-chartDays).map(Math.round)
        : [];

      console.log(`[${TAG}] 30-day renewable avg: ${renewableAvg30}%`);

      // ── 4. Secondary data (SMARD) — historical charts ─────────
      const [monthlyMixData, weeklyStackedData, expansionData, batteryData, europeRenShareData] = await Promise.all([
        this.fetchMonthlyMix(),
        this.fetchWeeklyStacked(),
        this.fetchInstalledPower(12),
        this.fetchBatteryHistory(),
        this.fetchEuropeRenShare(),
      ]);

      // ── 5. Build result ───────────────────────────────────────
      const result = {
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
        expansion:     expansionData,
        monthlyMix:    monthlyMixData,
        weeklyStacked: weeklyStackedData,
        battery:         batteryData,
        europeRenShare:  europeRenShareData,
        lastUpdate: new Date().toLocaleString("de-DE", {
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
      } else {
        this.sendSocketNotification("ENERGY_DATA_RESULT", { error: err.message });
      }
      // Retry in 20 min if data not yet available
      if (!this._retryTimer) {
        const delay = err.message.includes("not yet available") ? 20 * 60 * 1000 : 5 * 60 * 1000;
        this._retryTimer = setTimeout(() => {
          this._retryTimer = null;
          this.fetchAllData(chartDays);
        }, delay);
      }
      // Always send something so the frontend shows error state instead of infinite spinner
      if (!this._lastGoodData) {
        this.sendSocketNotification("ENERGY_DATA_RESULT", { error: err.message });
      }
    }
  },

  // ── Build intraday sparkline from 15-min GW values ───────────
  // Downsamples to ~24 points (1 per hour) for the sparkline chart
  _buildDaySparkline (...pts) {
    // pts = one or more production_type objects (e.g. windOn + windOff)
    const n = pts[0]?.data?.length || 0;
    if (n === 0) return [];
    const step = Math.max(1, Math.floor(n / 48)); // ~30-min buckets
    const result = [];
    for (let i = 0; i < n; i += step) {
      let sum = 0;
      for (const pt of pts) {
        const v = pt?.data?.[i];
        sum += (v !== null && v !== undefined) ? v : 0;  // include zeros (solar nights)
      }
      result.push(parseFloat((sum / 1000).toFixed(2)));  // MW → GW
    }
    return result;
  },

  // ── Fetch monthly mix from energy-charts /public_power ───────
  // Used by monthlyMix tile — current month to date
  async fetchMonthlyMix () {
    try {
      const now   = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const end   = now.toISOString().slice(0, 10);
      const data  = await this.fetchJson(`${EC.BASE}/public_power?country=de&start=${start}&end=${end}`);
      if (!data?.production_types?.length) return null;

      const find    = (pat) => data.production_types.find((p) => pat.test(p.name));
      const findAll = (pat) => data.production_types.filter((p) => pat.test(p.name));
      const sumGWh  = (pt) => (pt?.data?.reduce((s, v) => s + (v !== null ? v * 0.25 : 0), 0) ?? 0) / 1000;
      const sumGWhAll = (...pts) => pts.reduce((t, pt) => t + sumGWh(pt), 0);

      const windGWh    = sumGWh(find(/wind on/i)) + sumGWh(find(/wind off/i));
      const solarGWh   = sumGWhAll(...findAll(/solar|photovoltaic/i));
      const biomassGWh = sumGWh(find(/biomass/i));
      const coalGWh    = sumGWh(find(/hard coal/i)) + sumGWh(find(/lignite/i));
      const gasGWh     = sumGWh(find(/natural gas/i));
      const totalGWh   = windGWh + solarGWh + biomassGWh + coalGWh + gasGWh;
      if (totalGWh < 1) return null;

      const pct = (v) => Math.round((v / totalGWh) * 100);
      const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
      return {
        wind: pct(windGWh), solar: pct(solarGWh), biomass: pct(biomassGWh),
        coal: pct(coalGWh), gas: pct(gasGWh),
        other: Math.max(0, 100 - pct(windGWh) - pct(solarGWh) - pct(biomassGWh) - pct(coalGWh) - pct(gasGWh)),
        totalTWh: totalGWh / 1000,
        month: now.getMonth(), year: now.getFullYear(),
        monthName: MONTH_NAMES[now.getMonth()],
      };
    } catch (e) {
      console.warn(`[${TAG}] fetchMonthlyMix error: ${e.message}`);
      return null;
    }
  },

  // ── Fetch weekly stacked from energy-charts /public_power ────
  // Used by weeklyMix + renewableWeekly tiles
  async fetchWeeklyStacked () {
    try {
      const end   = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const s = start.toISOString().slice(0, 10);
      const e = end.toISOString().slice(0, 10);
      const data = await this.fetchJson(`${EC.BASE}/public_power?country=de&start=${s}&end=${e}`);
      if (!data?.production_types?.length || !data?.unix_seconds?.length) return null;

      const find    = (pat) => data.production_types.find((p) => pat.test(p.name));
      const findAll = (pat) => data.production_types.filter((p) => pat.test(p.name));
      const mergeData = (...pts) => {
        const maxLen = Math.max(0, ...pts.map((p) => p?.data?.length ?? 0));
        const out = new Array(maxLen).fill(0);
        for (const pt of pts) { if (!pt?.data) continue; pt.data.forEach((v, i) => { if (v !== null) out[i] += v; }); }
        return out;
      };
      const windOn      = find(/wind on/i)?.data  ?? [];
      const windOff     = find(/wind off/i)?.data ?? [];
      const solarData   = mergeData(...findAll(/solar|photovoltaic/i));
      const biomassData = find(/biomass/i)?.data   ?? [];
      const coalData    = find(/hard coal/i)?.data ?? [];
      const ligniteData = find(/lignite/i)?.data   ?? [];
      const gasData     = find(/natural gas/i)?.data ?? [];

      const timestamps = data.unix_seconds;
      const n = timestamps.length;

      // Downsample to ~84 points (every 2h = 8 quarters)
      const step = Math.max(1, Math.floor(n / 84));
      const result = { timestamps: [], wind: [], solar: [], biomass: [], coal: [], gas: [] };
      for (let i = 0; i < n; i += step) {
        result.timestamps.push(timestamps[i]);
        const f = (v) => parseFloat((v / 1000).toFixed(2));  // MW → GW
        result.wind.push(f((windOn[i] ?? 0) + (windOff[i] ?? 0)));
        result.solar.push(f(solarData[i] ?? 0));
        result.biomass.push(f(biomassData[i] ?? 0));
        result.coal.push(f((coalData[i] ?? 0) + (ligniteData[i] ?? 0)));
        result.gas.push(f(gasData[i] ?? 0));
      }
      return result;
    } catch (e) {
      console.warn(`[${TAG}] fetchWeeklyStacked error: ${e.message}`);
      return null;
    }
  },


  // ── Fetch renewable share for European countries ─────────────────────────
  // Fetches ren_share_daily_avg in sequential batches of 5 to avoid rate-limit.
  // Uses confirmed energy-charts country codes (ISO 3166-1 alpha-2).
  // Norway ("no") is excluded — API returns null for ren_share_daily_avg.
  async fetchEuropeRenShare () {
    // Confirmed working codes for ren_share_daily_avg endpoint
    const COUNTRIES = [
      "de","at","ch","fr","nl","be","lu",
      "pl","cz","sk","hu","ro","bg",
      "dk","se","fi","ee","lv","lt",
      "gb","ie","es","pt","it",
      "hr","si","rs","al","gr","ba","mk",
    ];
    const BATCH_SIZE  = 5;
    const BATCH_DELAY = 400;  // ms between batches — stay under rate limit

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const map = {};
    try {
      for (let b = 0; b < COUNTRIES.length; b += BATCH_SIZE) {
        const batch = COUNTRIES.slice(b, b + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((cc) =>
            this.fetchJson(`${EC.BASE}/ren_share_daily_avg?country=${cc}`)
              .then((data) => {
                if (!Array.isArray(data?.data)) return null;
                // Walk backwards to find last non-null value
                for (let i = data.data.length - 1; i >= 0; i--) {
                  if (data.data[i] !== null && data.data[i] !== undefined) {
                    return { cc, pct: Math.round(data.data[i]) };
                  }
                }
                return null;
              })
              .catch(() => null)
          )
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) map[r.value.cc] = r.value.pct;
        }
        if (b + BATCH_SIZE < COUNTRIES.length) await delay(BATCH_DELAY);
      }
      const count = Object.keys(map).length;
      console.log(`[${TAG}] EuropeRenShare: ${count} countries, DE=${map["de"]}% FR=${map["fr"]}% SE=${map["se"]}% IT=${map["it"]}%`);
      return count > 0 ? map : null;
    } catch (e) {
      console.warn(`[${TAG}] fetchEuropeRenShare error: ${e.message}`);
      return null;
    }
  },

  // ── Fetch installed power history: monthly GW + yearly current total ────────
  //
  // Strategy (MaStR Meldeverzug):
  //   1. time_step=monthly, installation_decommission=false → cumulative GW per month
  //      BUT the last ~3 months are null (registrations lag ~3 months in MaStR).
  //      We skip the last 3 months and use up to 36 months of reliable data.
  //   2. time_step=yearly → authoritative current total (always complete).
  //      Used as the big-number headline. The last reliable monthly point is the
  //      displayed chart endpoint; the yearly value fills in the actual latest total.
  //
  // Result: { series:[{year,month,windGW,solarGW},...], latestWindGW, latestSolarGW, isMonthly:true }
  async fetchInstalledPower (months) {
    try {
      const SKIP_RECENT = 3;  // skip last N months (MaStR registration lag)

      // ── Fetch both resolutions in parallel ──────────────────
      const [monthly, yearly] = await Promise.all([
        this.fetchJson(`${EC.BASE}/installed_power?country=de&time_step=monthly&installation_decommission=false`),
        this.fetchJson(`${EC.BASE}/installed_power?country=de&time_step=yearly`),
      ]);

      // ── Helpers ─────────────────────────────────────────────
      const findIn    = (data, pat) => data.production_types.find((p) => pat.test(p.name));
      const findAllIn = (data, pat) => data.production_types.filter((p) => pat.test(p.name));

      // ── Latest totals from yearly (authoritative) ───────────
      let latestWindGW = 0, latestSolarGW = 0;
      if (yearly?.time?.length && yearly?.production_types?.length) {
        const n = yearly.time.length;
        const yWindOn  = findIn(yearly, /wind.*on|onshore.*wind/i);
        const yWindOff = findIn(yearly, /wind.*off|offshore.*wind/i);
        const ySolar   = findAllIn(yearly, /solar|photovoltaic/i);
        latestWindGW  = parseFloat(((yWindOn?.data?.[n-1] ?? 0) + (yWindOff?.data?.[n-1] ?? 0)).toFixed(1));
        latestSolarGW = parseFloat(ySolar.reduce((s, pt) => s + (pt?.data?.[n-1] ?? 0), 0).toFixed(1));
        console.log(`[${TAG}] Yearly latest: wind=${latestWindGW} GW solar=${latestSolarGW} GW (${yearly.time[n-1]})`);
      }

      // ── Monthly series (skip last SKIP_RECENT months) ───────
      if (!monthly?.time?.length || !monthly?.production_types?.length) {
        console.warn(`[${TAG}] fetchInstalledPower: monthly response empty, falling back to yearly-only`);
        // Build a yearly-only series as fallback
        if (!yearly?.time?.length) return null;
        const yWindOn  = findIn(yearly, /wind.*on|onshore.*wind/i);
        const yWindOff = findIn(yearly, /wind.*off|offshore.*wind/i);
        const ySolar   = findAllIn(yearly, /solar|photovoltaic/i);
        const series = yearly.time.slice(-months).map((t, i) => {
          const idx   = yearly.time.length - months + i;
          const year  = parseInt(String(t).slice(0, 4), 10) || 0;
          const windGW  = parseFloat(((yWindOn?.data?.[idx] ?? 0) + (yWindOff?.data?.[idx] ?? 0)).toFixed(1));
          const solarGW = parseFloat(ySolar.reduce((s, pt) => s + (pt?.data?.[idx] ?? 0), 0).toFixed(1));
          return { year, month: 6, windGW, solarGW };
        }).filter((s) => s.year >= 2010);
        return { series, latestWindGW, latestSolarGW, isMonthly: false };
      }

      const mWindOn  = findIn(monthly, /wind.*on|onshore.*wind/i);
      const mWindOff = findIn(monthly, /wind.*off|offshore.*wind/i);
      const mSolar   = findAllIn(monthly, /solar|photovoltaic/i);

      const nM    = monthly.time.length;
      const limit = Math.max(0, nM - SKIP_RECENT);  // exclude last 3 (null / incomplete)
      const start = Math.max(0, limit - months);

      console.log(`[${TAG}] Monthly: ${nM} entries (${monthly.time[0]}–${monthly.time[nM-1]}), using [${start}..${limit-1}], windOn sample: ${mWindOn?.data?.slice(start, start+3).join(", ")}`);

      const series = [];
      for (let i = start; i < limit; i++) {
        const timeStr = String(monthly.time[i] || "");
        const parts   = timeStr.split("-");
        const year    = parseInt(parts[0], 10) || 0;
        const month   = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : 0;  // 0-indexed
        if (year < 2020) continue;  // focus on last ~5 years for meaningful monthly detail

        const windOnGW  = mWindOn?.data?.[i]  ?? null;
        const windOffGW = mWindOff?.data?.[i] ?? null;
        const solarArr  = mSolar.map((pt) => pt?.data?.[i] ?? null);

        // Skip entries where any key carrier is null (incomplete month)
        if (windOnGW === null || solarArr.some((v) => v === null)) continue;

        const windGW  = parseFloat((windOnGW + (windOffGW ?? 0)).toFixed(1));
        const solarGW = parseFloat(solarArr.reduce((s, v) => s + v, 0).toFixed(1));

        if (windGW > 0 || solarGW > 0) {
          series.push({ year, month, windGW, solarGW });
        }
      }

      if (!series.length) {
        console.warn(`[${TAG}] fetchInstalledPower: monthly series empty (all null?), falling back to yearly`);
        // Repeat yearly fallback
        if (!yearly?.time?.length) return null;
        const yWindOn  = findIn(yearly, /wind.*on|onshore.*wind/i);
        const yWindOff = findIn(yearly, /wind.*off|offshore.*wind/i);
        const ySolar   = findAllIn(yearly, /solar|photovoltaic/i);
        const fbSeries = yearly.time.slice(-12).map((t, i) => {
          const idx   = yearly.time.length - 12 + i;
          const year  = parseInt(String(t).slice(0, 4), 10) || 0;
          const windGW  = parseFloat(((yWindOn?.data?.[idx] ?? 0) + (yWindOff?.data?.[idx] ?? 0)).toFixed(1));
          const solarGW = parseFloat(ySolar.reduce((s, pt) => s + (pt?.data?.[idx] ?? 0), 0).toFixed(1));
          return { year, month: 6, windGW, solarGW };
        }).filter((s) => s.year >= 2010);
        return { series: fbSeries, latestWindGW, latestSolarGW, isMonthly: false };
      }

      const last = series[series.length - 1];
      console.log(`[${TAG}] Installed power: ${series.length} monthly entries, last: ${last.year}-${last.month+1} wind=${last.windGW} GW solar=${last.solarGW} GW | latest total: wind=${latestWindGW} GW solar=${latestSolarGW} GW`);
      return { series, latestWindGW, latestSolarGW, isMonthly: true };
    } catch (e) {
      console.warn(`[${TAG}] fetchInstalledPower error: ${e.message}`);
      return null;
    }
  },

  // ── Fetch battery storage history from energy-charts ─────────
  async fetchBatteryHistory () {
    try {
      // Use yearly — monthly gives net-MW additions often null for recent months
      const url  = `${EC.BASE}/installed_power?country=de&time_step=yearly`;
      const data = await this.fetchJson(url);
      if (!data?.time?.length || !Array.isArray(data.production_types)) return null;

      const allNames = data.production_types.map((pt) => `"${pt.name}"`).join(", ");
      console.log(`[${TAG}] Battery API types: ${allNames}`);

      // Prefer "capacity" (GWh) over "power" (GW)
      const PATTERNS = [
        /battery storage.*capacity/i,   // "Battery storage (capacity)" → GWh
        /batterie.*kapazit/i,
        /battery storage.*power/i,      // "Battery storage (power)"  → GW fallback
        /battery/i,
        /batterie/i,
        /speicher/i,
      ];
      let entry = null;
      for (const pat of PATTERNS) {
        entry = data.production_types.find((pt) => pat.test(pt.name));
        if (entry) { console.log(`[${TAG}] Battery matched: "${entry.name}"`); break; }
      }
      if (!entry?.data?.length) { console.warn(`[${TAG}] No battery entry found`); return null; }

      console.log(`[${TAG}] Battery raw last 5: ${JSON.stringify(entry.data.slice(-5))}, time last 5: ${JSON.stringify(data.time.slice(-5))}`);

      const series = [];
      for (let i = 0; i < Math.min(entry.data.length, data.time.length); i++) {
        const v = entry.data[i];
        if (v !== null && v !== undefined && v > 0) {
          // Yearly format: time entries are plain "YYYY" strings
          const year = parseInt(String(data.time[i] || "").slice(0, 4), 10) || 0;
          if (year > 2000) series.push({ year, month: 0, value: parseFloat(v.toFixed(2)) });
        }
      }
      const trimmed = series.slice(-36);
      if (!trimmed.length) return null;
      const last = trimmed[trimmed.length - 1];
      console.log(`[${TAG}] Battery: ${trimmed.length} years, latest=${last.value} GWh (${last.year})`);
      return { series: trimmed, latestValue: last.value, latestYear: last.year, unit: "GWh" };
    } catch (e) {
      console.warn(`[${TAG}] fetchBatteryHistory error: ${e.message}`);
      return null;
    }
  },

  // ── Low-level HTTP JSON fetch ─────────────────────────────────
  fetchJson (url) {
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
          catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
        });
      });
      req.on("error", reject);
      req.setTimeout(12000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    });
  },

  // ── Extract numeric value from SMARD series entry ─────────────
  extractVal (entry) {
    if (entry === null || entry === undefined) return 0;
    if (typeof entry === "number")             return entry;
    if (Array.isArray(entry) && entry.length >= 2) {
      const v = entry[1];
      if (typeof v === "number") return v;
    }
    return 0;
  },
});
