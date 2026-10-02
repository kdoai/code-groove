# 検証の範囲

実デプロイ先：https://code-groove-web-a5ygiois2a-an.a.run.app

模擬サンプルと有料モデル実測を別に記録しています。保存済み実解析２例は実際の Gemini 応答と根拠を公開サンプルに固定したものです。再生時にモデルを呼びません。審査員はログインなしでも、実解析の打点・コード・調査ログ・理由のある違いを確認できます。

| 対象 | 確認した内容 | 証跡 |
|---|---|---|
| 音と楽譜 | Theme/Repoのイベント保存、再現性、責務の音源固定、無音の未確定単位、サンプル30点のハッシュとピーク | compiler tests / kit manifest |
| 静的索引 | ローカルimport aliasとシンボル関係、外部パッケージ未解決、対象コード・設定を実行しない | indexer tests |
| Agent | SDKの関数ID/Content維持、read/search/relations/反証、token/tool制限、final修復、許可されない操作の拒否 | test_agent_loop.py / live-agent-cases.json |
| GCP実解析 | Firebase審査ログイン、Cloud Tasks、private worker、Gemini initial + investigation、6点の新規根拠、justified_difference | deployed-smoke.json / deployed-*-trace.json |
| API | 所有権/期限、idempotency、同時実行、予約/精算、lease、キャンセル、削除、キュー障害時の再投入、chunked body制限 | Python tests |
| UI | 初回ガイド、Arrange、Theme/Repo、コード選択、サンプル、保存済み実解析、実ログ、ログイン/追加調査、音声開始 | Playwright + in-app browser / deployed-live-*.png |
| 配備 | lock固定、静的検査、選択的CI、鍵なしWIF、Cloud Build、SHA固定コンテナ | GitHub Actions / deployment.json |

有料実測は３ケースとGCP上の解析・追加調査に限定しました。通常のCI/E2Eは模擬または保存済み結果で検証します。リリース時のみ全体テスト、日常変更は影響する領域だけを実行します。

音として責務を理解しやすいかは人による聴取評価が必要です。画像・PCMの技術確認を人の評価として扱いません。YouTube公開と審査ダッシュボードへの提出も未実施です。
