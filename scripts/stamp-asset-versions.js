#!/usr/bin/env node
/*
 * stamp-asset-versions.js
 * -----------------------
 * Cloudflare tells browsers to cache CSS and JS for 4 hours, while HTML is
 * always re-fetched. Without a version tag, a visitor can get a new page with
 * an old stylesheet (broken layout) or old events-data.js (missing events).
 *
 * This adds ?v=<content hash> to the links of the files below in every page,
 * so the URL changes whenever the file does and browsers fetch the new copy.
 * Runs after the Tailwind build (npm run build); run it by hand after editing
 * events-data.js, flier-popup.js or plant-photos.js:
 *
 *   node scripts/stamp-asset-versions.js
 *
 * plant-data.js is left alone: it is rebuilt nightly by a workflow.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ASSETS = ['dist/output.css', 'events-data.js', 'flier-popup.js', 'plant-photos.js'];

const versions = Object.fromEntries(ASSETS.map((a) => [
  a,
  crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, a))).digest('hex').slice(0, 8),
]));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const page of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, 'utf8');
  let html = before;
  for (const a of ASSETS) {
    // href="dist/output.css" or src="events-data.js", with or without an old ?v=
    const re = new RegExp(`((?:href|src)=")${escapeRe(a)}(?:\\?v=[0-9a-f]*)?"`, 'g');
    html = html.replace(re, `$1${a}?v=${versions[a]}"`);
  }
  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log('stamped', page);
  }
}
