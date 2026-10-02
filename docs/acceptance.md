# 検証の範囲

実デプロイ先：https://code-groove-web-a5ygiois2a-an.a.run.app

模擬サンプルと実測を区別します。保存済み実解析４例は、実際のGemini応答・ツール記録・根拠を固定したものです。再生時にモデルを呼びません。R3はユーザーのDTM方向の要望に合わせ、編曲画面・音楽規則・Agentの判断を更新しています。リリースの結果はEXECUTION_PLAN.mdに追記します。

| 対象 | 確認した内容 | 証跡 |
|---|---|---|
| 音と楽譜 | イベント保存、証拠IDに依存しないハッシュ、固定モチーフ、スウィング、根拠のあるリズム応答、未確認コードに意味を作らない | compiler / jazz tests、kit manifest |
| 音源・比較 | 42個の自作PCM、14編曲が有限・非無音・クリップなし。改善前151行・改善後116行の24動作比較 | audio-verification-v2.json、comparison.test.ts |
| 静的索引 | TSのローカルalias、Pythonの関数とローカル呼出し。対象コード・設定を実行しない | indexer / test_python_indexer.py |
| Agent | 仮説・読み取り・関連調査・反証。懸念は具体的な変更シナリオと実際の別理由確認を要求 | validation tests、live-returns-*-trace.json |
| 保存・差分 | 同じスナップショットはparser・Gemini不要。変更された関数と新旧の呼出し元へ限定、根拠を再検証、資料変更は意味の再利用を無効化 | test_incremental.py、test_jobs_api.py |
| API | 所有権・期限、idempotency、予約・精算、lease、キャンセル、削除、キュー障害、本文制限 | Python tests |
| UI | 実操作のガイド、ディレクトリ、全発音表示、根拠・A/B、質問、伴奏ミュート。1440×900 / 1280×720 / 980×600で文書スクロールなし。複数sceneでも再生継続 | Playwright workspace / recorded、rhythm-review-*.png |
| セキュリティ | 非公開worker、認証・所有権、直接Firestore/Storage拒否、CSP/HSTS/nosniff、既知依存問題0件 | SECURITY_REVIEW_R1.md、audit/deployed-security artifacts |
| 配備 | lock固定、選択的CI、正確なSHAのCI再利用、鍵なしWIF、Cloud Build | GitHub Actions、deployment.json |

最新のローカル実SDK調査：改善前108.05秒・4モデル呼出し・8ツール調査・9意味イベント、改善後148.19秒・7モデル呼出し・11ツール調査・11意味イベント。改善前に共有ポリシーの重複を指摘し、改善後はチャネルごとの妥当な境界と判断しました。実データを読んだ事実と、判断の正しさを完全に保証することは区別します。

基準版M0–M5はGCP配備・Firebaseログイン・実解析・追加調査・保存済み作業の再生まで成功しています。R3のGCP確認はEXECUTION_PLAN.mdと新しいdeployed-r3-*報告に記録します。

有料モデル実測は明示した検証だけで実行します。通常CIの有料E2Eはスキップし、保存された結果を使います。日常変更は影響する領域だけを検証し、確認済みの同じSHAを配備する際は全スイートを繰り返しません。

音として設計を理解しやすいかは人の聴取評価が必要です。画像・PCMの技術確認を人の評価として扱いません。YouTube公開と審査ダッシュボードへの提出も未実施です。

R3 CI: [37012266943 SUCCESS](https://github.com/kdoai/code-groove/actions/runs/37012266943)、Python36件・JS16件・E2E3件成功。有料E2Eは通常CIでスキップ。生成契約、静的検査、ビルド、自作PCM音源の検証も成功しました。

R3最終配備：[37015106391 SUCCESS](https://github.com/kdoai/code-groove/actions/runs/37015106391)、SHA337f1fd。Agentの回復処理だけを変更したCIはPython38件成功で、無関係な音楽/UIスイートは再実行していません。本番の新規Gemini調査は115.41秒・5モデル呼出し・9意味イベントで完了。同じソースの更新は索引・解析を再利用し、モデル呼出し・入出力トークンすべて0です。先行の504失敗と１回の検証クレジットも隠さず記録しています。

最終の有料ブラウザ確認も成功（59.9秒）。審査ログイン、保存した実ソース、質問からの新規Agent調査、新しい根拠リンク、演奏を確認し、ページエラー0件でした。新版デモは180.0秒・H.264/AAC・1280×816で、配備画面の収録を確認しています。
