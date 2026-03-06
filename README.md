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

## Layout Examples

```js
config: {
    language: "en",  // options: "en", "de"
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
    tilesVisible: 4, // options: 1,2,4
    gridLayout: "2x2",  //options: "1x4", "2x2" <-- only used if tilesVisible > 2
    tileWidth:  200,   // tile width in px (null = auto)
    tileHeight: 280,   // tile height in px (null = auto)
    rotation: true, // has only an effect if tilesVisible < 4
    rotationInterval: 10000, // miliseconds
    fetchInterval: 24 * 60 * 60 * 1000, // once per day
    } 
},
```

---

## Tiles

| Tile ID | Content |
|---|---|
| `wind` | Average & peak feed-in power (GW), total GWh |
| `solar` | Average & peak feed-in power (GW), total GWh |
| `renewable` | Renewable share (%), 30-day average |
| `production` | Total generation (TWh) |

| `windExpansion` | Development of installed capacity (GW), corrupt data |
| `solarExpansion` | Development of installed power  (GW) |
| `monthlyMix` | Distribution across renewable energies (%), 30-day average |
| `weeklyMix` | Distribution across renewable energies (%), 7-day data |
| `renewableWeekly` | Average & peak feed-in power (%) |
| `batteryLongTerm` | Battery storage expansion (GWh) |
| `renewableEU` | Renevable energy share in EU contries (%), unfinished, experimental |

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

