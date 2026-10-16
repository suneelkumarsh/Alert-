/*
 * Copyright (c) 2026. Deutsche Telekom AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generator for getCellSitesInArea.json (Wiremock stub)
 *
 * Usage:
 *   node generate-cell-sites-in-area.js [options]
 *
 * Options:
 *   --regular-sites  N    Number of regular sites (NR n1+n78 / LTE b3+b20)  [default: 35]
 *   --allfreq-sites  N    Number of all-frequency sites (all RATs/bands)     [default:  5]
 *   --city           NAME City preset sets coordinate bounds automatically
 *                         Available: munich | prague | athens                [default: munich]
 *   --lat-min        F    Minimum latitude bound (overrides --city)          [default: 48.060]
 *   --lat-max        F    Maximum latitude bound (overrides --city)          [default: 48.250]
 *   --lon-min        F    Minimum longitude bound (overrides --city)         [default: 11.360]
 *   --lon-max        F    Maximum longitude bound (overrides --city)         [default: 11.720]
 *   --managed-by-tnap     managedByTNAP value (true/false)                   [default: false]
 *   --seed           N    Random seed for reproducible coordinates           [default:  42]
 *   --output         PATH Output path for the JSON file                      [default: ../wiremock/mappings/cell-site-map/getCellSitesInArea.json]
 *   --help                Show this help message
 *
 * Examples:
 *   node generate-cell-sites-in-area.js
 *   node generate-cell-sites-in-area.js --city prague
 *   node generate-cell-sites-in-area.js --city athens --regular-sites 20 --allfreq-sites 10
 *   node generate-cell-sites-in-area.js --lat-min 48.10 --lat-max 48.20 --lon-min 11.50 --lon-max 11.70
 *   node generate-cell-sites-in-area.js --output /tmp/test-sites.json
 */

const fs   = require('fs');
const path = require('path');

// ─── City presets (coordinate bounds) ───────────────────────────────────────
//
//  Each entry defines a sensible map extent for the respective city
//  (approx. 10x10 km, typical network planning area).
//
//  munich  – Munich city centre + ring
//            Centre: 48.1351° N, 11.5820° E
//  prague  – Prague city centre + districts
//            Centre: 50.0755° N, 14.4378° E
//  athens  – Athens city centre + metropolitan area
//            Centre: 37.9838° N, 23.7275° E

const CITY_PRESETS = {
  munich: { latMin: 48.060, latMax: 48.250, lonMin: 11.360, lonMax: 11.720 },
  prague: { latMin: 49.970, latMax: 50.180, lonMin: 14.220, lonMax: 14.710 },
  athens: { latMin: 37.870, latMax: 38.100, lonMin: 23.550, lonMax: 24.000 },
};

// ─── Default configuration ───────────────────────────────────────────────────

const DEFAULTS = {
  regularSites: 35,
  allfreqSites: 5,
  ...CITY_PRESETS.munich,   // Default city: Munich
  managedByTNAP: false,
  seed: 42,
  output: path.resolve(__dirname, '../wiremock/mappings/cell-site-map/getCellSitesInArea.json'),
};

// ─── Band/frequency definitions from getCellSitesFilters.json ───────────────

/** Cell groups for regular sites: NR n1, LTE b3, NR n78, LTE b20 */
const REGULAR_GROUPS = [
  { rat: 'NR',  band: 'n1',       freq: '430030', az: [0, 120, 240], ct: 'macro', mno: 'TNAP'   },
  { rat: 'LTE', band: 'b3',       freq: '1300',   az: [60, 180, 270],ct: 'small', mno: 'MVNO-1' },
  { rat: 'NR',  band: 'n78',      freq: '640000', az: [0, 120, 240], ct: 'macro', mno: 'TNAP'   },
  { rat: 'LTE', band: 'b20',      freq: '6300',   az: [60, 180, 270],ct: 'small', mno: 'MVNO-1' },
];

/** Cell groups for all-frequency sites: all RATs and bands */
const ALL_FREQ_GROUPS = [
  // NR – Azimuth set A {0, 120, 240}
  { rat: 'NR',  band: 'n1',       freq: '430030', az: [0, 120, 240], ct: 'macro', mno: 'TNAP'   },
  { rat: 'NR',  band: 'n78',      freq: '640000', az: [0, 120, 240], ct: 'macro', mno: 'TNAP'   },
  { rat: 'NR',  band: 'n20',      freq: '158200', az: [0, 120, 240], ct: 'macro', mno: 'TNAP'   },
  { rat: 'NR',  band: 'n28',      freq: '155000', az: [0, 120, 240], ct: 'macro', mno: 'TNAP'   },
  { rat: 'NR',  band: 'n3',       freq: '368500', az: [0, 120, 240], ct: 'macro', mno: 'TNAP'   },
  // LTE – Azimuth set B {60, 180, 270}
  { rat: 'LTE', band: 'b3',       freq: '1300',   az: [60, 180, 270],ct: 'small', mno: 'MVNO-1' },
  { rat: 'LTE', band: 'b20',      freq: '6300',   az: [60, 180, 270],ct: 'small', mno: 'MVNO-1' },
  { rat: 'LTE', band: 'b7',       freq: '2850',   az: [60, 180, 270],ct: 'small', mno: 'MVNO-1' },
  { rat: 'LTE', band: 'b28',      freq: '9410',   az: [60, 180, 270],ct: 'small', mno: 'MVNO-1' },
  { rat: 'LTE', band: 'b1',       freq: '300',    az: [60, 180, 270],ct: 'small', mno: 'MVNO-1' },
  // GSM – Azimuth set A {0, 120, 240}
  { rat: 'GSM', band: 'dcs_1800', freq: '700',    az: [0, 120, 240], ct: 'small', mno: 'MVNO-2' },
  { rat: 'GSM', band: 'gsm_900',  freq: '62',     az: [0, 120, 240], ct: 'small', mno: 'MVNO-2' },
  // IoT – Azimuth set B {60, 180, 270}
  { rat: 'IoT', band: '8',        freq: '3749',   az: [60, 180, 270],ct: 'small', mno: 'MVNO-3' },
];

// ─── Seeded PRNG (Mulberry32) ────────────────────────────────────────────────

function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Helper functions ────────────────────────────────────────────────────────

function genCells(siteNum, lon, lat, groups) {
  const cells = [];
  let cn = 1;
  const base = (102 + siteNum - 1) * 100;
  for (const g of groups) {
    for (const az of g.az) {
      cells.push({
        cellId:                `TNAP_AREA_CELL_1_${siteNum}_${cn}`,
        cellName:              `TNAP_AREA_CELL_1_${siteNum}_${cn}`,
        sitePhysicalLocationId:`TNAP_AREA_SITE_1_${siteNum}_${cn}`,
        radioAccessTechnology: g.rat,
        cellType:              g.ct,
        mnoId:                 g.mno,
        nodeId:               `AREA_NODE_1_${siteNum}_${cn}`,
        coverageArea:         `AreaCoverage_1_${siteNum}_${cn}`,
        frequencyBand:         g.freq,
        band:                  g.band,
        mcc: '001', mnc: '01', selflink: '',
        height: 20.0, azimuth: az, beamwidth: 65.0,
        mechanicalTilt: 5.0, electricalTilt: 3.0,
        cellLocalId: base + cn,
        longitude: lon, latitude: lat,
        serviceInstanceId: `AREA_SERVICE_1_${siteNum}_${cn}`,
        dataSource: 'TNAP',
      });
      cn++;
    }
  }
  return cells;
}

function genSite(siteNum, lon, lat, groups, managedByTNAP) {
  return {
    physicalLocationId: `TNAP_AREA_SITE_1_${siteNum}`,
    siteName:           `TNAP_AREA_SITE_1_${siteNum}`,
    insertType: 'outdoor',
    street1:   `AreaStreet_1_${siteNum}`,
    street2:   '',
    state:     `AreaState_1_${siteNum}`,
    city:      `AreaCity_1_${siteNum}`,
    postalCode: '',
    country:   `AreaCountry_1_${siteNum}`,
    region:    `AreaRegion_1_${siteNum}`,
    longitude:  lon,
    latitude:   lat,
    dataCenterCode: `AREA_DC_1_${siteNum}`,
    identityUrl:    `https://identity.tnap/area_1_${siteNum}`,
    timeZone:  `UTC_1_${siteNum}`,
    elevation: '0',
    lata:      `AREA_LATA_1_${siteNum}`,
    managedByTNAP,
    cells: genCells(siteNum, lon, lat, groups),
  };
}

// ─── CLI argument parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const cfg = { ...DEFAULTS };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help': case '-h':
        console.log(module.exports ? '' : fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[0]);
        process.exit(0);
        break;
      case '--regular-sites':  cfg.regularSites   = parseInt(args[++i], 10); break;
      case '--allfreq-sites':  cfg.allfreqSites    = parseInt(args[++i], 10); break;
      case '--city': {
        const city = args[++i].toLowerCase();
        if (!CITY_PRESETS[city]) {
          console.error(`Unknown city: "${city}". Available: ${Object.keys(CITY_PRESETS).join(', ')}`);
          process.exit(1);
        }
        Object.assign(cfg, CITY_PRESETS[city]);
        break;
      }
      case '--lat-min':        cfg.latMin          = parseFloat(args[++i]);   break;
      case '--lat-max':        cfg.latMax          = parseFloat(args[++i]);   break;
      case '--lon-min':        cfg.lonMin          = parseFloat(args[++i]);   break;
      case '--lon-max':        cfg.lonMax          = parseFloat(args[++i]);   break;
      case '--managed-by-tnap': {
        const val = args[i + 1];
        if (val === undefined || val.startsWith('--')) {
          console.error('--managed-by-tnap requires a value: true or false');
          process.exit(1);
        }
        cfg.managedByTNAP = args[++i] !== 'false';
        break;
      }
      case '--seed':           cfg.seed            = parseInt(args[++i], 10); break;
      case '--output': case '-o': cfg.output       = path.resolve(args[++i]); break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }
  return cfg;
}

// ─── Main logic ──────────────────────────────────────────────────────────────

function generate(cfg) {
  const rng = createRng(cfg.seed);
  const totalSites = cfg.regularSites + cfg.allfreqSites;
  const cellSites  = [];

  for (let i = 0; i < totalSites; i++) {
    const siteNum = i + 1;
    const isAllFreq = i >= cfg.regularSites;
    const groups    = isAllFreq ? ALL_FREQ_GROUPS : REGULAR_GROUPS;

    // All coordinates are generated deterministically within the bounding box
    let lon, lat;
    lon = cfg.lonMin + rng() * (cfg.lonMax - cfg.lonMin);
    lat = cfg.latMin + rng() * (cfg.latMax - cfg.latMin);
    lon = Math.round(lon * 1e6) / 1e6;
    lat = Math.round(lat * 1e6) / 1e6;

    cellSites.push(genSite(siteNum, lon, lat, groups, cfg.managedByTNAP));
  }

  return {
    request: {
      method: 'GET',
      urlPath: '/api/cell-sites/area',
      queryParameters: {
        minLong: { matches: '.*' },
        minLat:  { matches: '.*' },
        maxLong: { matches: '.*' },
        maxLat:  { matches: '.*' },
      },
    },
    response: {
      status: 200,
      headers: {
        'Content-Type':  'application/json',
        'X-API-Version': '1.0.0',
        'X-Environment': 'TNAP',
      },
      jsonBody: { cellSites, totalCount: cellSites.length },
      delayDistribution: { type: 'uniform', lower: 50, upper: 50 },
    },
    priority: 1,
  };
}

// ─── Execution ───────────────────────────────────────────────────────────────

const cfg    = parseArgs(process.argv);
const result = generate(cfg);
const json   = JSON.stringify(result, null, 2);

fs.writeFileSync(cfg.output, json, 'utf8');

const totalCells = result.response.jsonBody.cellSites.reduce((s, site) => s + site.cells.length, 0);
console.log(`✓ Generated: ${cfg.regularSites} regular sites + ${cfg.allfreqSites} all-freq sites = ${cfg.regularSites + cfg.allfreqSites} sites, ${totalCells} cells`);
console.log(`  Coordinate bounds: lat [${cfg.latMin}, ${cfg.latMax}], lon [${cfg.lonMin}, ${cfg.lonMax}]`);
console.log(`  managedByTNAP: ${cfg.managedByTNAP}, seed: ${cfg.seed}`);
console.log(`  Output: ${cfg.output}`);
