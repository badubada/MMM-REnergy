# MMM-REnergy

**MagicMirror² module** – Renewable Energy in Germany

Displays current relevant data for the development of renewable energies in for european countries (inial commit: only Germany is included) in up to four tiles in a flexible grid layout.
This module was vibe coded with Anthropic's Claude AI. Sonnet 4.6. Please feel free to adapt it / improve it / make suggestions.
Please be aware that this is my first created MagicMirror module - so for sure it does not fullfil the standards in module development (not yet ;-). 
Your feedback is very welcome!

---


## Preview

<img width="1073" height="363" alt="image" src="https://github.com/user-attachments/assets/a1091419-7227-42c1-89f5-3fb0d8e48051" />


---

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/YOUR_USERNAME/MMM-REnergy.git
```

No `npm install` required — the module uses only Node.js built-ins (`https`).

---

## Configuration

Minimal config:

```js
{
  module: "MMM-REnergy",
  position: "bottom_bar",
}
```

Full config with all options:

```js
{
  module: "MMM-REnergy",
  position: "bottom_bar",
  config: {

    // Display language: "de" (German) or "en" (English)
    language: "de",

    // Data refresh interval in milliseconds (default: 15 minutes)
    updateInterval: 15 * 60 * 1000,

    // Number of tiles shown simultaneously: 1 | 2 | 4
    tilesVisible: 4,

    // Grid layout (only relevant when tilesVisible is 4):
    //   "1x4" → all four tiles in a single row
    //   "2x2" → two rows of two tiles
    gridLayout: "1x4",

    // Tile order (remove or reorder as desired)
    tiles:     [
    "wind", 
    "solar", 
    "renewable", 
    "production",
    //"windExpansion",  //<-- actual data broken!
    "solarExpansion",
    "monthlyMix",
    "weeklyMix", 
    "renewableWeekly",
    "batteryLongTerm",
    "renewableEU",
    ],

    // Auto-rotate tiles (useful if tilesVisible < than the number of activated tiles)
    rotation: false,
    rotationInterval: 8000,   // ms between tile changes
    rotationTransition: 600,  // ms fade duration

    // Show sparkline charts in wind / solar / renewable tiles
    showMiniChart: true,

    // Number of days shown in sparkline charts
    chartDays: 30,
  }
}
```

---

## Layout Options
    
    // activate or deactivate the following tiles:
    tiles:  
    [
    "wind", 
    "solar", 
    "renewable", 
    "production",
    //"windExpansion",  //<-- actual data broken!
    "solarExpansion",
    "monthlyMix",
    "weeklyMix", 
    "renewableWeekly",
    "batteryLongTerm",
    "renewableEU",
    ],

    // select visible tiles, options: 1,2,4 (default: 4)
    tilesVisible: 4
    
    // select grid layout, options: "1x4", "2x2" <-- only used if tilesVisible > 2
    gridLayout: "2x2"

---

## Tiles

| Tile ID | Content |
|---|---|
| `wind` | Average & peak wind feed-in (GW), total GWh yesterday |
| `solar` | Average & peak solar feed-in (GW), total GWh yesterday |
| `renewable` | Renewable share yesterday (%), 30-day trend sparkline |
| `production` | Total generation (TWh), breakdown by carrier |
| `windExpansion` | Installed wind capacity over time (GW), currently broken data! |
| `solarExpansion` | Installed solar capacity over time (GW) |
| `monthlyMix` | Power mix current month — share per carrier (%) |
| `weeklyMix` | Hourly generation by carrier, last 7 days (GW) |
| `renewableWeekly` | Renewable vs. conventional share, last 7 days (%) |
| `batteryLongTerm` | Battery storage expansion history (GWh) |
| `renewableEU` | Renewable share per European country, yesterday (%) |

---

## Notes

- **Data delay**: SMARD updates day-resolution data with a 1–2 day lag, so values always reflect *yesterday*.
- **Peak GW**: Day-resolution data does not include 15-minute peaks. Values are estimated (wind ×1.4, solar ×2.5 of average).
- **30-day average**: Calculated from the last 30 days with complete data across all carriers.

---

## Further development

- bug fixes
- include data from all european countries
- ...

---

## License

MIT – module code  
CC BY 4.0 – data from Bundesnetzagentur | SMARD.de
CC BY 4.0 – data from Fraunhofer Institute for Solar Energy Systems ISE | https://www.energy-charts.info
CC BY 4.0 – WTH Aachen University | battery-charts.de/battery-charts

