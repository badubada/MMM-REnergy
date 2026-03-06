# MMM-REnergy

**MagicMirror² module** – Renewable Energy in Germany

Displays current energy feed-in and production data for Germany in up to four tiles, sourced from the official SMARD API of the Federal Network Agency (Bundesnetzagentur).

---


## Preview

```
<img width="1073" height="363" alt="image" src="https://github.com/user-attachments/assets/ad8d9d3f-1b56-4ccb-ba0f-db5ca7d73604" />

```

---

## Data Source

**SMARD.de – Federal Network Agency (Bundesnetzagentur)**  
Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)  
Source is cited in the module footer as required by the licence.

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
    tiles: ["wind", "solar", "renewable", "production"],

    // Auto-rotate tiles (useful when tilesVisible is 1 or 2)
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
// 4 tiles side by side (default)
config: { tilesVisible: 4, gridLayout: "1x4" }

// 2×2 grid
config: { tilesVisible: 4, gridLayout: "2x2" }

// 2 tiles, auto-rotating every 10 s
config: { tilesVisible: 2, rotation: true, rotationInterval: 10000 }

// 1 tile with rotation dots
config: { tilesVisible: 1, rotation: true, rotationInterval: 8000 }
```

---

## Tiles

| Tile ID | Content | SMARD filters |
|---|---|---|
| `wind` | Average & peak feed-in power (GW), total GWh, share, sparkline | 4068 + 1225 |
| `solar` | Average & peak feed-in power (GW), total GWh, share, sparkline | 4067 |
| `renewable` | Renewable share (%), 30-day average, sparkline | all vs. total |
| `production` | Total generation (TWh), horizontal bar chart per carrier | all |

---

## Notes

- **Data delay**: SMARD updates day-resolution data with a 1–2 day lag, so values always reflect *yesterday*.
- **Peak GW**: Day-resolution data does not include 15-minute peaks. Values are estimated (wind ×1.4, solar ×2.5 of average).
- **30-day average**: Calculated from the last 30 days with complete data across all carriers.

---

## License

MIT – module code  
CC BY 4.0 – data from Bundesnetzagentur | SMARD.de
