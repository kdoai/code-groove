# Code Groove

コードの設計を聴き、音から根拠をたどる開発支援ツールです。

Geminiがコードを読み、責務や処理の関係を整理します。その結果を音とタイムラインで表し、気になった箇所からコードと説明を確認できます。既存のコードやAI生成コードを引き継ぐときの理解を支援します。

[アプリを開く](https://code-groove-web-a5ygiois2a-an.a.run.app) · [開発手順](docs/DEVELOPMENT.md) · [ドキュメント](docs/README.md)

![Code Grooveの演奏画面と根拠コード](docs/images/workspace.png)

## 試す

1. アプリで「実画面のデモを見る」を開きます。
2. 演奏を開始し、気になる音を選びます。対応するコードとAgentの説明を確認できます。
3. 根拠一覧や確認候補から、関連するコードと判断理由を読みます。

デモにはTsugiaiのCheckout Agentを調べた保存済みの解析を使っています。再生と閲覧はログイン不要で、新しいAI解析は発生しません。調査済みなのは9実装です。コード全体や実行時の動作を検証した結果ではありません。

ログインすると解析結果を保存し、気になった箇所の追加調査を依頼できます。改善案は差分を確認して採用します。変更はアプリ内のコピーへ反映され、元のリポジトリは変更されません。

## 機能

- TypeScript、TSX、Pythonの静的なコード調査
- 責務と処理の配置を表すタイムライン・音の再生
- 音、根拠コード、Agentの説明の相互参照
- 選択した範囲の追加調査と、人が確認する改善案
- 解析結果の保存と再生

音はコードを理解するための補助です。設計の良し悪しやバグの有無は、コードと根拠を読んで判断します。

## ローカル開発

Node.js 24、pnpm 10.27.0、Python 3.13、uvを使います。

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
uv sync --locked
pnpm build:tools
```

既存の`.env`がある場合は上書きしないでください。APIとWebを別々の端末で起動する手順は[開発手順](docs/DEVELOPMENT.md)を参照してください。

## 構成

React、TypeScript、Monaco Editor、Tone.jsによるWeb画面と、FastAPIによるAPIを使います。Cloud Runで動作し、Cloud Tasksで解析ジョブを処理します。認証はFirebase Auth、データ保存はFirestoreとCloud Storageです。

[技術構成](docs/TECHNICAL_GUIDE.md) · [音の規則](docs/SONIFICATION.md) · [データの扱い](docs/data-handling.md) · [費用と利用上限](docs/cost-plan.md)

サンプルコードと音源のライセンスは、それぞれの同梱ファイルに記載しています。
