#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# 仕様反証ゲート（原則47）: リポジトリ直下の仕様書（台帳・規約以外の .md）に
# 反証スタンプ（先頭の「反証:」行）が無ければ、セッション開始時に知らせる。
# 運用は CLAUDE.md「仕様書の鮮度ルール」と /spec-falsify スキル。
for f in *.md; do
  [ -f "$f" ] || continue
  case "$f" in
    CLAUDE.md|README.md|DECISIONS.md|TODO_SYNC.md) continue ;;
  esac
  if ! head -20 "$f" | grep -q '^反証:'; then
    echo "仕様反証リマインド: $f に反証スタンプ（先頭の「反証:」行）が無い。実装に入る前に /spec-falsify を実行すること"
  fi
done

# 設計判断の出所・確信度（DECISIONS.md D5）: D4 以降の決定ブロックに
# 「出所と確信度」の欄が無ければ知らせる（D1〜D3 は遡及対象外）。
if [ -f DECISIONS.md ]; then
  missing=$(awk '
    function flush() { if (id != "" && num >= 4 && !ok) miss = miss (miss == "" ? "" : "・") id }
    /^## D[0-9]+:/ { flush(); match($0, /D[0-9]+/); id = substr($0, RSTART, RLENGTH); num = substr(id, 2) + 0; ok = 0; next }
    /出所と確信度/ { ok = 1 }
    END { flush(); print miss }
  ' DECISIONS.md)
  if [ -n "$missing" ]; then
    echo "設計判断リマインド: DECISIONS.md の $missing に「出所と確信度」の行が無い（書き方は同ファイル冒頭・運用は D5）"
  fi
fi

# Claude Code on the web のセッション開始時に、ハーネスの依存を自動インストールする。
# framework は file: 依存（symlink）なので framework 側→harness 側の順に両方入れる。
# 出力はログへ逃がして、セッション文脈に流れる行を最小にする。
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
LOG=/tmp/session-start-npm.log
(cd framework && npm install --no-audit --no-fund) > "$LOG" 2>&1
(cd harness && npm install --no-audit --no-fund) >> "$LOG" 2>&1
echo "harness deps ready: framework+harness npm install 完了（node harness/run.js が実行可能。ログ: $LOG）"
