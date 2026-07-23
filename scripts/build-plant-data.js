#!/usr/bin/env node
/*
 * build-plant-data.js
 * -------------------
 * Regenerates plant-data.js from the published CommonWild "Native Plants
 * Reference Sheet" (a 6-tab Google Sheet). The Google Sheet is the single
 * source of truth; this script is run automatically (nightly) by
 * .github/workflows/update-plant-data.yml, which commits any changes so
 * Cloudflare redeploys the site.
 *
 * It also keeps the two hard-coded species-count fallbacks in
 * plant-database.html in sync with the real total.
 *
 * Safe by design: if the sheet can't be fetched, a tab comes back empty,
 * the expected header layout is missing, or the parsed total looks
 * implausibly small, the script throws and writes nothing — so a bad
 * fetch or a structural change to the sheet can never publish garbage or
 * wipe good data. The workflow simply fails loudly instead.
 *
 * Run locally:  node scripts/build-plant-data.js
 *   Add --dry-run to print what would change without writing files.
 */

const fs = require('fs');
const path = require('path');

const SHEET_PUB_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT0y0oxP7GtzrbR4boGWP7_RDN7AClS6blTDNqp523HS9N_4iSXwXycdZ7wGR3yyes3bvyKYld6gKM1/pub';

// Each visible tab of the sheet and its gid (the id in the tab's URL).
const CATEGORIES = [
  { name: 'Forbs & Ferns', gid: '1538472824' },
  { name: 'Shrubs', gid: '1190877394' },
  { name: 'Trees', gid: '310908915' },
  { name: 'Vines', gid: '603294041' },
  { name: 'Grasses & Sedges', gid: '784262121' },
  { name: 'Aquatic', gid: '169427518' },
];

// Guardrail: if the pipeline ever parses fewer plants than this, something
// is wrong (a tab failed to load, the sheet was gutted, etc.) — abort
// rather than overwrite good data with a near-empty file.
const MIN_EXPECTED_PLANTS = 600;

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_JS = path.join(REPO_ROOT, 'plant-data.js');
const DB_HTML = path.join(REPO_ROOT, 'plant-database.html');
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCsv(cat) {
  const url = `${SHEET_PUB_BASE}?output=csv&gid=${cat.gid}&single=true`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Per-attempt timeout so a slow/hung response (not just an HTTP error)
      // is treated as a failure and retried, rather than stalling the job.
      const resp = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      // A real tab is many KB. Anything tiny means an error page or an
      // empty/renamed tab — refuse it so we don't publish nothing.
      if (text.length < 500) {
        throw new Error(`suspiciously small response (${text.length} bytes)`);
      }
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  throw new Error(`Failed to fetch tab "${cat.name}" (gid ${cat.gid}): ${lastErr.message}`);
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++; continue;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

function g(row, i) {
  return (row[i] || '').trim();
}

function clean(s) {
  s = (s || '').trim();
  if (['no entry', 'n/a', 'na', '-', ''].includes(s.toLowerCase())) return '';
  return s;
}

function num(v) {
  v = clean(v);
  if (!v) return null;
  const f = parseFloat(v);
  return Number.isFinite(f) && /^-?\d+(\.\d+)?$/.test(v) ? f : null;
}

function extractNums(str) {
  if (!str) return [];
  const matches = String(str).match(/\d*\.\d+|\d+/g);
  return matches ? matches.map(Number).filter((x) => Number.isFinite(x)) : [];
}

// Confirm the tab still has the column layout this parser assumes. Every
// field below is read by fixed column position, so if someone INSERTS,
// DELETES, or REORDERS columns in the sheet, the positions shift and we
// would silently map the wrong data. To prevent that, we verify a set of
// header labels at their expected columns spanning the whole width; if any
// anchor is missing we abort and publish nothing. (If the sheet's columns
// are changed on purpose, update these anchors and the indices in
// rowToPlant together.)
// Labels verified identical across all six tabs at these columns. They span
// from col 1 through the moisture block (col 32), so an inserted/deleted/
// reordered column anywhere in that range trips the check. (Columns to the
// right of ~32 — soil type, root, availability, notes — have tab-specific
// sub-headers and aren't anchored; an insertion there is far less likely and
// would at worst garble notes/availability text, not the core fields.)
const HEADER_ANCHORS = [
  [1, /common name/i, 'Common Name(s)'],
  [2, /botanical/i, 'Botanical name(s)'],
  [3, /n1-?n5|n1/i, 'Native Status (N1-N5)'],
  [6, /gardening for moths/i, 'Gardening for Moths'],
  [14, /score|pollinator|1-?11/i, 'Pollinator score'],
  [18, /spring/i, 'Spring'],
  [27, /full sun/i, 'Full Sun'],
  [28, /part sun/i, 'Part Sun'],
  [31, /dry/i, 'Dry (moisture)'],
  [32, /med(ium)?/i, 'Medium (moisture)'],
];

function assertExpectedLayout(cat, rows) {
  const headerIdx = rows.findIndex(
    (r) => /common name/i.test(r[1] || '') && /botanical/i.test(r[2] || '')
  );
  if (headerIdx === -1) {
    throw new Error(
      `Tab "${cat.name}": could not find the header row ` +
        `(col B "Common Name(s)", col C "Botanical name(s)"). ` +
        `The sheet layout may have changed — aborting so bad data is not published.`
    );
  }
  const header = rows[headerIdx];
  for (const [col, re, label] of HEADER_ANCHORS) {
    if (!re.test(header[col] || '')) {
      throw new Error(
        `Tab "${cat.name}": expected column ${col} to be "${label}" but found ` +
          `"${(header[col] || '').slice(0, 40)}". A column was likely inserted, ` +
          `deleted, or reordered in the sheet — aborting so mismapped data is not ` +
          `published. Update the column anchors/indices in scripts/build-plant-data.js.`
      );
    }
  }
  return headerIdx;
}

// ---------------------------------------------------------------------------
// Row -> plant object
// ---------------------------------------------------------------------------

function rowToPlant(row, categoryName) {
  const common_raw = clean(g(row, 1));
  const botanical = clean(g(row, 2));
  const primary = common_raw ? common_raw.split(/,| \(/)[0].trim() : botanical;

  const light = [];
  [[27, 'Full Sun'], [28, 'Part Sun'], [29, 'Part Shade'], [30, 'Shade']].forEach(([idx, label]) => {
    if (g(row, idx)) light.push(label);
  });

  const moisture = [];
  [[31, 'Dry'], [32, 'Medium'], [33, 'Moist'], [34, 'Wet']].forEach(([idx, label]) => {
    if (g(row, idx)) moisture.push(label);
  });

  const soilType = [];
  [[35, 'Sandy/Silty'], [36, 'Loam/Rich'], [37, 'Clay'], [38, 'Nutrient Poor']].forEach(([idx, label]) => {
    if (g(row, idx)) soilType.push(label);
  });

  const bloom = [];
  [[18, 'Spring'], [19, 'Summer'], [20, 'Fall']].forEach(([idx, label]) => {
    if (g(row, idx)) bloom.push(label);
  });
  const bloomDetail = [...new Set([g(row, 18), g(row, 19), g(row, 20)].filter(Boolean))].join(', ');

  const lepidopteraCount = clean(g(row, 6)) || clean(g(row, 7));

  const notesCols = [9, 10, 11, 12, 13, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59];
  const seen = new Set();
  const notesParts = [];
  for (const idx of notesCols) {
    const v = clean(g(row, idx));
    if (v && !seen.has(v)) { seen.add(v); notesParts.push(v); }
  }
  const notes = notesParts.join(' ');

  const plant = {
    name: primary || botanical,
    category: categoryName,
    altNames: common_raw,
    botanical,
    status: clean(g(row, 3)),
    statusNote: clean(g(row, 4)),
    rarity: clean(g(row, 5)),
    lepidopteraCount,
    lepidopteraNotes: clean(g(row, 8)),
    pollinators: clean(g(row, 9)),
    birds: clean(g(row, 13)),
    buzzScore: num(g(row, 14)),
    showyBlooms: num(g(row, 15)),
    showyFoliage: num(g(row, 16)),
    fragrant: num(g(row, 17)),
    bloom,
    bloomDetail,
    winterAppeal: clean(g(row, 22)),
    ephemeral: clean(g(row, 23)),
    maxHeight: clean(g(row, 24)),
    heightRange: clean(g(row, 25)),
    spreadWidth: clean(g(row, 26)),
    light,
    moisture,
    soilType,
    root: clean(g(row, 39)),
    leguminous: clean(g(row, 40)),
    erosionControl: clean(g(row, 41)),
    pioneer: clean(g(row, 42)),
    selection: clean(g(row, 43)),
    lifespan: clean(g(row, 44)),
    gardenerLevel: clean(g(row, 45)),
    viewAvailable: clean(g(row, 46)),
    seedsAvailable: clean(g(row, 47)),
    buyAvailable: clean(g(row, 48)),
    vaseLife: clean(g(row, 60)),
    notes,
  };

  // Drop empty fields to keep the payload small (matches the existing file).
  const cleaned = {};
  for (const [k, v] of Object.entries(plant)) {
    if (v === '' || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    cleaned[k] = v;
  }
  if (!cleaned.name) cleaned.name = botanical || '(unnamed)';

  // Numeric height bounds power the min/max height filter. Appended last,
  // matching the existing file's key order.
  const rangeNums = extractNums(cleaned.heightRange);
  const maxNums = extractNums(cleaned.maxHeight);
  let hMin = null;
  let hMax = null;
  if (rangeNums.length) {
    hMin = Math.min(...rangeNums);
    hMax = Math.max(...rangeNums);
  }
  if (maxNums.length) {
    const cand = Math.max(...maxNums);
    hMax = hMax === null ? cand : Math.max(hMax, cand);
    if (hMin === null) hMin = 0;
  }
  if (hMin !== null && hMax !== null) {
    cleaned.heightMinFt = hMin;
    cleaned.heightMaxFt = hMax;
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const allPlants = [];
  const perCategory = {};

  for (const cat of CATEGORIES) {
    const raw = await fetchCsv(cat);
    const rows = parseCSV(raw);
    // Data starts on the row after the verified header — derived, not
    // hardcoded, so inserting/removing rows above the data can't silently
    // shift the parse (it either still lines up or trips the layout check).
    const headerIdx = assertExpectedLayout(cat, rows);

    let count = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const common_raw = clean(g(row, 1));
      const botanical = clean(g(row, 2));
      // A trailer row (section header, "Questions:", "Sources:") puts text in
      // column A and has no plant name. Skip those and blank spacer rows — but
      // never skip a row that has a real name, even if column A has a stray
      // value an editor typed in.
      if (!common_raw && !botanical) continue;

      allPlants.push(rowToPlant(row, cat.name));
      count++;
    }
    perCategory[cat.name] = count;
    console.log(`  ${cat.name}: ${count}`);

    // A tab that parsed cleanly (header check passed) but yielded zero plant
    // rows means it was silently emptied or half-loaded — abort rather than
    // quietly drop a whole category from the site.
    if (count === 0) {
      throw new Error(
        `Tab "${cat.name}" produced 0 plant rows. Aborting so a category is not ` +
          `silently dropped from the published database.`
      );
    }
  }

  console.log(`  TOTAL: ${allPlants.length}`);

  if (allPlants.length < MIN_EXPECTED_PLANTS) {
    throw new Error(
      `Only ${allPlants.length} plants parsed (expected >= ${MIN_EXPECTED_PLANTS}). ` +
        `Refusing to overwrite plant-data.js with what looks like incomplete data.`
    );
  }

  const withBotanical = allPlants.filter((p) => p.botanical).length;
  console.log(`  (${withBotanical}/${allPlants.length} have a botanical name)`);

  // ---- plant-data.js ----
  const header =
    '// AUTO-GENERATED — do not edit by hand.\n' +
    '// Regenerated from the published CommonWild Native Plants Reference Sheet by\n' +
    '// scripts/build-plant-data.js (run nightly via .github/workflows/update-plant-data.yml).\n' +
    '// To change plant data, edit the Google Sheet — this file is overwritten on each run.\n';
  const js = header + 'window.NATIVE_PLANTS = ' + JSON.stringify(allPlants) + ';\n';

  // ---- keep the two count fallbacks in plant-database.html honest ----
  let html = fs.readFileSync(DB_HTML, 'utf8');
  const total = allPlants.length;
  let htmlChanged = false;
  const htmlBefore = html;
  html = html.replace(
    /(<span id="total-count-inline">)\d+(<\/span>)/,
    `$1${total}$2`
  );
  html = html.replace(
    /Showing \d+ of \d+ species/,
    `Showing ${total} of ${total} species`
  );
  htmlChanged = html !== htmlBefore;

  if (DRY_RUN) {
    const current = fs.existsSync(OUT_JS) ? fs.readFileSync(OUT_JS, 'utf8') : '';
    console.log('\n[dry-run] plant-data.js would ' + (current === js ? 'be UNCHANGED' : 'CHANGE'));
    console.log('[dry-run] plant-database.html counts would ' + (htmlChanged ? `update to ${total}` : 'be UNCHANGED'));
    return;
  }

  fs.writeFileSync(OUT_JS, js, 'utf8');
  console.log(`  wrote plant-data.js (${(Buffer.byteLength(js) / 1024).toFixed(0)} KB)`);
  if (htmlChanged) {
    fs.writeFileSync(DB_HTML, html, 'utf8');
    console.log(`  updated species count in plant-database.html -> ${total}`);
  }
}

main().catch((err) => {
  console.error('\nBUILD FAILED: ' + err.message);
  console.error('(No files were written.)');
  process.exit(1);
});
