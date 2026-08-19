#!/usr/bin/env node
/**
 * push-to-github.js
 * Pushes the strobe-app project to a GitHub repo using the GitHub REST API.
 * No git binary required — only Node.js built-ins.
 *
 * Usage:
 *   node push-to-github.js <github-username> <repo-name> <personal-access-token>
 *
 * Example:
 *   node push-to-github.js Bristo strobe-chromatics ghp_xxxxxxxxxxxxx
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const [,, USERNAME, REPO, TOKEN] = process.argv;

if (!USERNAME || !REPO || !TOKEN) {
  console.error('Usage: node push-to-github.js <github-username> <repo-name> <PAT-token>');
  process.exit(1);
}

// Files/dirs to exclude from the push
const EXCLUDE = new Set([
  'node_modules', '.git', 'dist', '.DS_Store', 'push-to-github.js',
]);

// File extensions to skip (binary assets that are large/unnecessary)
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf']);

// ── Collect all project files ────────────────────────────────────────────────
function collectFiles(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    if (EXCLUDE.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const relPath  = base ? `${base}/${entry}` : entry;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath, relPath));
    } else {
      const ext = path.extname(entry).toLowerCase();
      if (!SKIP_EXT.has(ext)) {
        results.push({ fullPath, relPath });
      }
    }
  }
  return results;
}

// ── GitHub API helper ────────────────────────────────────────────────────────
function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent':    'strobe-chromatics-pusher',
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Main push routine ────────────────────────────────────────────────────────
async function main() {
  const projectDir = path.join(__dirname);
  const files = collectFiles(projectDir);

  console.log(`\n🌈 Strobe Chromatics — GitHub Pusher`);
  console.log(`📦 Repo  : ${USERNAME}/${REPO}`);
  console.log(`📁 Files : ${files.length} files to push\n`);

  // Check repo exists
  const repoCheck = await apiRequest('GET', `/repos/${USERNAME}/${REPO}`);
  if (repoCheck.status === 404) {
    console.error(`❌ Repo not found: ${USERNAME}/${REPO}`);
    console.error('   Create it on github.com first (empty, no README), then re-run.');
    process.exit(1);
  }
  console.log(`✅ Repo found: ${repoCheck.body.html_url}\n`);

  let pushed = 0, skipped = 0, failed = 0;

  for (const { fullPath, relPath } of files) {
    // Get current SHA if file exists (needed for updates)
    const existing = await apiRequest('GET', `/repos/${USERNAME}/${REPO}/contents/${relPath}`);
    const sha = existing.status === 200 ? existing.body.sha : undefined;

    const content = fs.readFileSync(fullPath);
    const encoded = content.toString('base64');

    const payload = {
      message: sha ? `update: ${relPath}` : `add: ${relPath}`,
      content: encoded,
      ...(sha ? { sha } : {}),
    };

    const result = await apiRequest('PUT', `/repos/${USERNAME}/${REPO}/contents/${relPath}`, payload);

    if (result.status === 200 || result.status === 201) {
      console.log(`  ✅ ${relPath}`);
      pushed++;
    } else {
      console.warn(`  ⚠️  ${relPath} — HTTP ${result.status}: ${JSON.stringify(result.body?.message)}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅ Pushed  : ${pushed} files`);
  if (skipped) console.log(`⏭  Skipped : ${skipped} files`);
  if (failed)  console.log(`❌ Failed  : ${failed} files`);
  console.log(`\n🔗 View at: https://github.com/${USERNAME}/${REPO}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
