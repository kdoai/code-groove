# 依存関係と監査

Node 24 / Python 3.13、pnpm 10.27.0 / uv 0.6.11 を使用します。`pnpm-lock.yaml` と `uv.lock` をコミットし、CIとコンテナでは frozen install を必須にしています。TypeScriptは索引APIとlintの互換性を確認した6.0.2に固定しました。

2026-10-02の本番依存監査では、npm 114依存に既知の問題0件、Python本番依存に既知の問題0件でした。データベースにない問題まで保証するものではありません。結果は `artifacts/npm-audit.json` / `artifacts/python-audit.json`。

Firebaseの間接依存gRPCを修正版1.14.5、MonacoのDOMPurifyを3.4.16にoverrideしました。根拠は [gRPC advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j) と [DOMPurify advisory](https://github.com/advisories/GHSA-p98j-92pf-mc4p)。ブラウザではFirebase Authのみを使用し、Firestore/Storageへの直接アクセスは拒否しています。

有料モデル検証・全体テスト・監査をすべて毎回起動しません。通常CIは変更パスで選択し、ツール・配備コードは軽い静的検査だけを追加します。全体検証はリリース時、監査は依存更新時に実施してください。配備ジョブの再試行は成功した検証ジョブと同じSHAを使用し、既存イメージがある場合はビルドを再利用します。
