# 依存関係 — R14

Pythonは`uv.lock`、Webは`pnpm-lock.yaml`を固定します。ADKは2.11.0を指定しました。Google Gen AI、FastAPI、Google Cloud clientなどの解決済み版はlockを正本にします。

ADK導入で追加のPython依存とFastAPI等の版変更が生じました。新しい外部サービス・常駐プロセスは追加しません。採用目的はcustom Agent実行とGeminiモデル境界の統一です。代償は依存数、imageサイズ、cold startと更新時の互換性検証です。追加モデル要求、並列Agent、remote sessionはありません。

更新時は関数ID／思考署名、budget、429/503/504再試行、打ち切り、期限、所有権、APIとUI E2Eを確認します。SDKを単に最新へ追従せず、lockの差分と公式release noteを照合します。実モデル互換性は有料テストが実行されるまで未検証です。

[ADK Python公式](https://adk.dev/get-started/python/)（2026-10-04確認）。ADK Webは開発用であり、本番APIとして公開しません。

2026-10-04のlock済みruntime依存71件をpip-auditで調べ、既知脆弱性は0件でした（`artifacts/dependency-audit-r14.json`）。未知の脆弱性や本番の設定安全性を保証する結果ではありません。動画のローカル編集にはdev依存のimageio-ffmpegとPillowを使用し、本番imageには追加しません。
