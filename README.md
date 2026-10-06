# Code Groove

知らないコードの設計を、音からたどる開発支援ツールです。Geminiが静的なコードを読み、変更理由に基づく責務・意味イベント・根拠を提出します。固定規則で音に変換し、気になった音からコードと判断理由へ戻れます。

音はAIの解釈を確かめる入口です。欠陥の証明や、通常のAIレビューより速いという実証はありません。

Agentの説明を読んだ後、「Agentの説明を二関数で問い直す · 構造を比較して聴く」から静的TypeScript二関数を選べます。左右コード・順序を保った構文対応・共有呼び出しフレーズを確認し、音なしでも期待／観察／疑問を記録できます。確認状態は再生やAI回答では変わりません。メモは端末内に保持し、明示操作でJSONへ書き出します。[使い方と境界](docs/STRUCTURE_COMPARISON.md)を参照してください。

## 試す

「実画面のデモを見る」でTsugiaiの実在コードを開きます。51ファイル・19,541行を参考として読み、Checkout Agentの9実装の**保存済みGemini実解析**を聴けます。再生にログイン・新規AI費用は不要です。

保存済みの読取記録11ファイルと全体の参考コードは別です。未解析の参考コードに音は付きません。「確認する箇所」から根拠行を選び、伴奏なしで判断の打点を聴けます。反証未確認の懸念候補は欠陥と断定しません。演奏中のコードが発音中の位置へ追従し、質問はログイン前から入力できます。

[公開アプリ](https://code-groove-web-a5ygiois2a-an.a.run.app)。配備と実測の正本は`EXECUTION_PLAN.md`のR16欄です。店舗／Webの三つの同じ判断を聴く小さな比較教材もサンプルメニューから選べます。

## 現在の機能と境界

- TypeScript/TSX・Pythonの静的索引。入れ子の関数・lambda・メソッドも所有関係を保持します。対象のコードは実行しません。
- ADKの単一カスタムAgentとGeminiアダプター。アプリが読取ツール、根拠検証、時間・トークン上限、停止を管理します。
- 分割解析と保存再利用。2–4範囲・最大32実装の新規統合調査で、同じ変更理由かを読み直します。選択外とRepository全体は未判定です。
- 音と根拠の双方向参照、音なしで選べる判断一覧、反証・検討案・判断保留を別表示します。
- 追加調査、解釈の採用、改善案の差分承認。反映先はアプリ内コピーだけです。対象Repositoryにpushしません。

模擬（fixture）／保存済み実解析（recorded_live）／新規実解析（live）を明示します。保存済みの説明を読む操作は新規解析ではありません。新規解析は招待アカウントで明示的に開始し、1ユーザー1日10回（UTC）などの上限を適用します。

## 開発と検証

Node.js 24 / pnpm 10 / Python 3.13 / uvを使います。

```powershell
pnpm install --frozen-lockfile
uv sync --locked
pnpm build:tools
pnpm dev:web
uv run uvicorn code_groove.app:app --app-dir apps/backend --port 8080
```

既定はfixture/localです。開発環境で実解析を有効にしないでください。

```powershell
pnpm typecheck
pnpm lint
pnpm test
uv run ruff check apps/backend tests
uv run mypy apps/backend/code_groove
uv run pytest
pnpm test:e2e
```

有料・実モデルE2Eは明示的なopt-inです。通常検証では起動しません。テスト用の模擬Agentは意味解析の精度の証拠にはしません。

## 仕様・運用・提出

[現行仕様](docs/SPEC.md)、[音の規則](docs/SONIFICATION.md)、[構成](docs/TECHNICAL_GUIDE.md)、[データ扱い](docs/data-handling.md)、[費用](docs/cost-plan.md)、[運用・審査期間](docs/runbook.md)、[検証範囲](docs/acceptance.md)、[提出案内](docs/submission.md)を参照してください。実行記録は[EXECUTION_PLAN.md](EXECUTION_PLAN.md)、旧文書は[履歴](docs/history/R13/README.md)です。

東京・scale to zero・AIを除く月6,000円を目標とします。審査アカウント情報は公開文書・Git・動画に含めず、提出先の非公開欄へ別途登録します。
