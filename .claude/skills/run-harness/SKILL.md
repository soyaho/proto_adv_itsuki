---
name: run-harness
description: 実入力テストハーネスを実行して結果を確認する。index.html を変更したあとの緑確認や、特定シナリオ／プロファイルだけ回したいときに使う。
user-invocable: true
allowed-tools: Bash, Read
argument-hint: 省略可（例: --profile mobile / --scenario starter-smoke）
---

# ハーネス実行

```bash
(cd framework && npm i) && (cd harness && npm i)  # 初回のみ（node_modules が無ければ。framework は file: 依存のため両方）
node harness/run.js                # 全プロファイル×全シナリオ
node harness/run.js --profile mobile
node harness/run.js --profile mobile-landscape
node harness/run.js --scenario starter-smoke
```

- プロファイル: `desktop` / `mobile`(390x844) / `mobile-landscape`(844x390)。
- シナリオ: `harness/scenarios/` の各ファイル（`name` で指定）。
- 結果は末尾の `結果: N/M steps green` と `✘`/`⚠` 行を見る。詳細は `harness/report.json`。
- ブラウザは `/opt/pw-browsers/chromium`（`PLAYWRIGHT_CHROMIUM_PATH` で上書き可）。

大量に回すなら `harness-runner` エージェントに委譲して結果要約だけ受け取ってもよい。
