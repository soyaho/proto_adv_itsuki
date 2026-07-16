/**
 * runHarness — 全プロファイル×全シナリオを実行し、report.json とサマリを出す（ゲーム非依存）
 *
 *   runHarness({
 *     profiles,     // [{name, viewport, url}, ...]
 *     scenarioDir,  // {name, run(driver)} を module.exports する .js を置くディレクトリ
 *     Driver,       // BaseDriver のサブクラス（静的 launch(profile) を持つこと）
 *     reportPath,   // report.json の出力先
 *     argv,         // 省略時 process.argv.slice(2)。--profile <name> / --scenario <name>
 *   })
 */
const fs = require('fs');
const path = require('path');

async function runHarness({ profiles, scenarioDir, Driver, reportPath, argv = process.argv.slice(2) }) {
  const pFilter = argv.includes('--profile') ? argv[argv.indexOf('--profile') + 1] : null;
  const sFilter = argv.includes('--scenario') ? argv[argv.indexOf('--scenario') + 1] : null;

  const scenarios = fs.readdirSync(scenarioDir).filter(f => f.endsWith('.js'))
    .map(f => require(path.join(scenarioDir, f)))
    .filter(s => !sFilter || s.name === sFilter);

  const report = [];
  let failed = false;

  for (const profile of profiles.filter(p => !pFilter || p.name === pFilter)) {
    for (const sc of scenarios) {
      console.log(`\n=== [${profile.name}] ${sc.name} ===`);
      const d = await Driver.launch(profile);
      let fatal = null;
      try { await sc.run(d); }
      catch (e) { fatal = String(e.message || e); failed = true; }
      for (const st of d.steps) console.log(`  ${st.ok ? '✔' : '✘'} ${st.name} (${st.ms}ms)${st.err ? ' — ' + st.err : ''}`);
      if (d.errors.length) { failed = true; console.log('  ✘ JSエラー:', d.errors.join(' | ')); }
      for (const w of d.warnings) console.log('  ⚠ ' + w);
      report.push({ profile: profile.name, scenario: sc.name, fatal, steps: d.steps, jsErrors: d.errors, warnings: d.warnings });
      await d.close();
    }
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const total = report.reduce((a, r) => a + r.steps.length, 0);
  const ok = report.reduce((a, r) => a + r.steps.filter(s => s.ok).length, 0);
  console.log(`\n結果: ${ok}/${total} steps green ${failed ? '— ✘ FAILED' : '— ✔ ALL GREEN'}（詳細: ${path.relative(process.cwd(), reportPath)}）`);
  process.exit(failed ? 1 : 0);
}

module.exports = { runHarness };
