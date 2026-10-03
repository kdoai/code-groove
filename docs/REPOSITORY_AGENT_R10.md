# Repository Agent R10

2026-10-03. Google Gen AI SDKの既存tool loopを、大きな固定スナップショットの分割検査へ拡張した。全文を毎回送らず、静的索引から範囲を決め、Geminiが必要なコード・関係・テスト候補を読んで根拠付き結果を提出する。

## 実装

1. TypeScriptの全シンボルとPythonのトップレベル関数・クラス直下メソッドを静的索引化する。対象コードのimport・依存インストール・実行はしない。
2. 入れ子のTypeScript関数は字句上の所有元へまとめ、全シンボルは元索引に保持する。Pythonクラスメソッドは個別の候補とする。
3. 同じディレクトリの所有単位を最大24件、本文読取の見積り18回以内を目安に分割する。単独の長大関数は1範囲となり、予算不足なら未解決のまま残る。
4. 範囲の小さな索引、全体件数、関連単位の要約をGeminiへ渡す。全体ファイル一覧・検索・呼出元/先・テスト候補はページ付きtoolで取得する。本文は最大160行/read。長い関数の検査済み判定には、連続する複数readが全行を覆う必要がある。
5. 検証済みSemanticMap・ソース・履歴・譜面をprivate artifactsに保存する。「検査範囲と続きを選ぶ」から保存結果を開く場合はモデル呼出し0件。未検査範囲・未解決の再検査は明示ボタンから通常の解析枠を消費する。

キャッシュは本文、推移的な解決済みimport先、全README/設定/テスト、索引版・分割版・指示版・モデルIDで照合する。未解決のローカルimport、または未解決Python importがあれば全ソースhashを使い、変更の取り逃しを避ける。この場合の命中率は下がる。動的呼出・動的importの完全解決は保証しない。

## 境界と費用

| 対象 | 上限・方針 |
|---|---|
| 静的索引 | 実装400ファイル、60,000行、全投影4 MiB、4,096シンボル |
| ローカル取り込み | 文書/設定込み500ファイル、1ファイル200 KiB、本文合計4 MiB、JSONリクエスト8 MiB |
| Gemini analysis run | 既存18モデルrequest / 48tool / 入力400,000token / 出力48,000token / 480秒を維持 |
| 実解析 | 3件/ユーザー/UTC日。分割の続き・未解決の再検査も1件と数える |
| 再取得・キャッシュ照合 | 10件/UTC日の既存refresh枠。保存結果のGETはモデルを呼ばない |
| 保存 | 既存7日。全範囲を期限内に終えられる保証はない。必要な範囲を優先する |
| GCP | Tokyo、web min0/max2、worker min0/max1、Tasks concurrency1。新サービス・容量・IAM・日次枠を追加しない |

裏で全範囲を有料検査する動作はない。トークン事前計数、予約/消費、取消、attempt guardを既存経路に保持する。受け入れ拒否された取り込みはartifactを作らず、ソース本文はFirestoreへ入れない。

明示的なGemini context cacheは導入していない。保存済み検証結果で再解析を減らし、provider cacheの保存課金を追加しない。非AIインフラ月6,000円は運用目標であり請求上のハード停止ではない。今回の変更で目標の達成を計測したとは主張しない。

## 取り込み

```powershell
$env:PYTHONPATH = 'apps/backend;.'
uv run python scripts/repository-preflight.py 'C:\path\to\repository' --partitioned --prepare
```

CLIはコミット済みGit blobだけを読み、ignored `.local/repository-preflight/<revision>/<scope>/import.json` を生成する。ログイン後「Repositoryを開く」→「固定したローカルスナップショットを取り込む」→JSONを選択する。`--ref`で既存コミットを指定できる。

`POST /api/v1/projects/import` は認証・許可アカウント・origin・idempotency・パス・サイズ・secret投影を検査し、サーバー側で索引を作る。クライアントの索引は受け付けない。APIへ直接送ったrevisionは利用者の申告であり、サーバーが独立検証したGit SHAではない。投影本文hashは別途固定する。

`GET /projects/{id}/repository` は所有者に範囲別の保存・未検査・未解決件数を返す。`POST /projects/{id}/chunks` で存在するchunkを選ぶ。`retry_partial: true` は未解決のある保存範囲だけに許可し、解析枠を消費する。期限・所有権・active run・idempotencyを維持する。

## 検証と残り

実Tsugiaiのコミット `35a951488d7b00518e7e73a329d46713cbeacbe8` は51ソース / 19,541行 / 873シンボル / 281所有単位 / 28範囲として静的準備に成功した。Pythonメソッド63件を含み、構文エラー0件。最長所有単位1,219行。関数を持たない12ファイルも明示する。元の2ファイルの未コミット変更は維持し、Tsugiai本文はGitや公開sampleへ入れていない。

所有権・取り込み・依存変更・長い証拠範囲・キャッシュ・実解析3件枠・未解決の明示再検査を、mock modelと本物のparser/譜面compilerで検証した。Playwrightでも取り込み→範囲表示→保存再生（追加POSTなし）→続き→未解決の再検査をmock APIで確認した。`artifacts/repository-r10-mock.png` は模擬API画面でありTsugiaiのGemini結果ではない。

本日の実解析枠は既存3件で消費済み。Tsugiaiの新規Gemini解析、全範囲の実モデル品質・音楽、実モデルの1,219行関数検査は未検証。増枠・返金・別アカウントによる回避はしていない。

配備済みruntimeは `808ee3e44cc9fecb1a97d18a0b9071aee4112ae0`。CIはbackend71 / indexer・music23 / E2E7成功、有料3件skip。GCP配備は成功した同一SHAのCIを再利用した。本番の認証境界・保存済み採用結果の再生・選択ファイルのブラウザE2Eが成功し、実IABで新しい取り込み上限と既存録音サンプルの再生進行を確認した。インフラ容量は従来のまま。詳細はEXECUTION_PLAN.mdとsource-free `artifacts/deployed-r10-*.json` に保存している。

範囲別の責務分類・モチーフは独立である。全範囲の結果が保存されても `cross_partition_review: not_run` と全体 `partial` を維持する。範囲間の意味的統合と統合全体演奏は未実装。古い保存範囲は再生できるが、精密検査/提案/採用の競合防止は既存のproject最新analysis規則に従う。

## 参照した公式資料

- [Google Gen AI SDK: manual function calling / token counting](https://googleapis.github.io/python-genai/)：アプリがtool実行・返答・回数を管理し、SDKの元Contentを保持する。
- [ADK workflow agents](https://adk.dev/agents/workflow-agents/)：固定工程とモデル判断の分離を参照。今回は既存SDKの安全境界・予約処理を維持し、第二のADK runtimeは導入しない。
- [Gemini context caching](https://ai.google.dev/gemini-api/docs/caching)：明示cacheの保存費用を踏まえ、まずアプリ側の結果キャッシュを使う。
- [Google Cloud function calling](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tools/function-calling)：モデルのtool要求をサーバー側で検証する。
