// Zips the built extension for the site's Extension page and writes the
// manifest the page checks for updates:
//
//   web/app/public/downloads/raaga-extension-chrome (<version>).zip
//   web/app/public/downloads/raaga-extension-firefox (<version>).zip
//   web/app/public/downloads/extension.json    { version, builtAt, files }
//
// Each zip holds a single folder (raaga-extension-<browser> (<version>)/) rather than
// loose files, so "Extract here" leaves one tidy folder to load unpacked.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const output = fileURLToPath(new URL('../.output/', import.meta.url));
const target = fileURLToPath(new URL('../../app/public/downloads/', import.meta.url));
mkdirSync(target, { recursive: true });

// Clear old zips
if (existsSync(target)) {
  for (const name of readdirSync(target)) {
    if (/^(bitchord|raaga)-extension-.*\.zip$/.test(name)) {
      rmSync(join(target, name));
    }
  }
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const builds = { chrome: 'chrome-mv3', firefox: 'firefox-mv3' };
const files = {};
let version;

for (const [browser, folder] of Object.entries(builds)) {
  const root = join(output, folder);
  if (!existsSync(join(root, 'manifest.json'))) {
    console.warn(`Skipping ${browser}: manifest.json not found in ${root}`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  if (version && manifest.version !== version) {
    throw new Error(`Chrome and Firefox builds disagree on the version (${version} vs ${manifest.version}); rebuild both`);
  }
  version = manifest.version;

  // The version in brackets, on the zip and the folder inside it: "raaga-extension-chrome (0.4.4)".
  const parent = `raaga-extension-${browser} (${manifest.version})`;
  const entries = {};
  for (const file of filesUnder(root)) {
    entries[`${parent}/${relative(root, file).split(sep).join('/')}`] = readFileSync(file);
  }
  const name = `${parent}.zip`;
  const zipBuffer = zipSync(entries, { level: 9 });
  
  // Write versioned zip
  writeFileSync(join(target, name), zipBuffer);
  // Write unversioned aliases so both URLs always work
  writeFileSync(join(target, `raaga-extension-${browser}.zip`), zipBuffer);
  writeFileSync(join(target, `bitchord-extension-${browser}.zip`), zipBuffer);

  files[browser] = `raaga-extension-${browser}.zip`;
  console.log(`${folder} -> app/public/downloads/${name} (${parent}/, v${version})`);
}

writeFileSync(
  join(target, 'extension.json'),
  `${JSON.stringify({ version, builtAt: new Date().toISOString(), files }, null, 2)}\n`,
);
console.log(`app/public/downloads/extension.json (v${version})`);
