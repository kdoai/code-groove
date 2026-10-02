# Code Groove

コードの責務を音のフレーズに変え、実装の配置と聴き比べる、読み取り専用のレビュー・ワークスペースです。TypeScript / TSX の公開リポジトリを固定 SHA で取得し、Gemini がコード・関係・テストを調べて根拠付きの意味イベントを提出します。

**Theme** は責務ごと、**Repo** は実装の場所ごと。同じイベント・音源・強さを保持し、配置だけを変えます。気になる打点から **Inspect** に進み、コードと追加調査の根拠を確認できます。音の違いだけで設計を悪いと判定しません。

## 試す

公開模擬サンプル５種類と保存済み実解析２種類はログイン不要・モデル呼び出しなしです。実解析は審査・招待アカウントのみ。メール受信は不要です。初回ガイドの「今後このメッセージを表示しない」は端末内に保存され、右上のヘルプから再表示できます。

[アプリを開く](https://code-groove-web-a5ygiois2a-an.a.run.app)。配備イメージは [artifacts/deployment.json](artifacts/deployment.json) に記録します。審査用メールは `reviewer@example.invalid`。パスワードは `reviewer-password-placeholder` という Secret Manager の secret に保存し、リポジトリには置きません。

管理者が PowerShell でパスワードをクリップボードへ取得する手順：

```powershell
[private administrative command removed]
```

## 開発

Node 24 / pnpm 10.27.0 / Python 3.13 / uv。依存関係はロックファイルで固定しています。

```powershell
pnpm install --frozen-lockfile
uv sync --frozen
Copy-Item .env.example .env
pnpm build:tools
$env:PYTHONPATH='apps/backend;.'
uv run python scripts/dev.py
```

別ターミナルで `pnpm dev:web` を実行し、`http://127.0.0.1:5173` を開きます。初期設定は模擬サンプルのみで、AI費用は発生しません。ライブ解析には Firebase 設定・サーバー allowlist・ADC と `MODEL_MODE=live` / `ENABLE_LIVE_ANALYSIS=true` が必要です。モデルは `gemini-3.8-flash`、global、MEDIUM。別モデルへの自動フォールバックはありません。

## 変更に応じた検証

```powershell
pnpm test:changed --base <比較するGitコミット>
```

文書のみの変更ではアプリのテストを実行しません。バックエンドは Python / 認可・寿命管理、楽譜は不変条件、UI・共有契約はブラウザ E2E を含めて検証します。初回・リリース時の全体確認は `pnpm test:changed --all`。有料モデルの評価は `uv run python scripts/live_agent_cases.py scattered justified` を明示した場合だけ実行します。通常の CI にはモデル認証情報を渡しません。

`ruff` / `mypy` / ESLint / TypeScript を使用します。Python は snake_case、TS は camelCase、React コンポーネント・型は PascalCase、通信契約は snake_case。生成済み契約を手編集せず、`scripts/generate-contracts.py` と `scripts/generate-types.mjs` から更新してください。

## GCP と配備

`artful-bonsai-491601-p3` / `asia-northeast1`。同一コンテナを公開 web と非公開 worker に分けています。Firestore の transaction、Cloud Tasks の OIDC、90秒 lease / 15秒 heartbeat、最大２回の worker attempt を使用します。生コードや credential をログに出しません。

```powershell
$env:PYTHONPATH='apps/backend;.'
$env:GOOGLE_CLOUD_QUOTA_PROJECT='artful-bonsai-491601-p3'
uv run python infra/gcp.py bootstrap
uv run python scripts/create_reviewer.py
uv run python infra/operations.py
uv run python scripts/release.py --revision <40桁のGitコミットSHA>
```

通常の配備は GitHub Actions の **Deploy verified revision** を手動実行します。main の検証済みコードだけを対象にし、Workload Identity Federation をリポジトリの数値ID・所有者ID・main・production 環境に限定します。サービスアカウント鍵は作りません。基盤の IAM と Firebase 設定を変更する権限は CI に付与しません。

インフラは min instances 0、web 最大２・worker 最大１、キュー同時実行１。常時稼働の DB / VM / Redis は使いません。各利用者は１実行同時、UTC日次３解析・10追加調査。全体で日次入力300万 / 出力30万トークンの予約上限。保存結果の再生は AI を呼びません。詳細は [費用設計](docs/cost-plan.md) と [運用手順](docs/runbook.md)。

## 構成と成果物

- `apps/web`: React / SVGシーケンサー / 読み取り専用 Monaco / Tone.js
- `apps/backend/code_groove`: FastAPI / Firebase Auth / Gemini SDK の制限付きツールループ
- `packages/groove-core`: 決定的な Theme / Repo コンパイラ
- `packages/repo-indexer`: TypeScript Compiler API の静的索引。対象コードを実行しない
- `fixtures`: ５サンプルとサーバー側の固定ソース
- `prompts` / `contracts`: プロンプト・Pydantic正本から生成したスキーマ
- `EXECUTION_PLAN.md` / `BLOCKERS.md`: 進捗・外部入力だけの残作業
- `artifacts`: 実測トレース、スクリーンショット、信号検証。fixture と実解析を明示して分ける

保存期限は７日。APIは期限切れを410で拒否し、Firestore TTL と GCS 14日 lifecycle で物理削除します。削除要求後は直ちに閲覧不能になり、worker が保存物を消します。サンプル音源は本リポジトリで合成した PCM 素材です。

仕様の詳細と採用した差分は [統合仕様](docs/SPEC.md) / [設計判断](docs/implementation-decisions.md)。[検証記録](docs/acceptance.md) と [構成図](artifacts/architecture.png)、[提出用説明・３分台本](docs/submission.md) も用意しています。技術検証と、人による聴きやすさの評価・YouTube公開は別々に記録します。
