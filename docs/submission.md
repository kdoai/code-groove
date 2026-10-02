# 提出用ドラフト

Code Groove — コードの設計を聴き、根拠をたどるレビュー・ワークスペース。

対象は、既存のTypeScriptプロジェクトを理解する開発者やレビュー担当者です。同じ責務が散らばっているのか、似て見える実装に正当な違いがあるのかは、ファイル一覧や依存グラフだけでは捉えにくい。Code GrooveはGeminiがコード・テスト・呼び出し関係を調べ、根拠付きの意味イベントを復元します。

責務別のThemeと実装順のRepoを、同じ打点・音源で聴き比べます。気になる音を選ぶとInspectでコードと根拠が開き、Agentが例外や反証を追加調査します。音の違いを設計の悪さと決めつけず、判断保留や理由のある違いも示します。

Google Cloud Runでwebと非公開workerを実行し、Vertex経由のGemini API（Google Gen AI SDK）を使用します。Firebase Auth、Firestore、Cloud Storage、Cloud Tasks、Secret Managerを使用。Agentのツールはサーバーが管理する読み取り専用操作に限定し、対象コードは実行しません。所有権・期限・実行権・日次クォータ・トークン予約・停止スイッチで自律性を制御します。

GitHub: https://github.com/kdoai/code-groove （非公開。ダッシュボードからGitHub Appで連携）

URL: https://code-groove-web-a5ygiois2a-an.a.run.app 。審査メールは `reviewer@example.invalid`。パスワードは管理者がSecret Managerから取得して、非公開の「動作確認の方法」欄へ記入してください。メール受信やソーシャルログインは不要です。

動作確認：初回ガイドで混在サンプルを開く → Play → ThemeとRepoを比較 → 打点を選ぶ → Inspectでコードを確認。Openの「実解析を再生」で実際のGeminiツール記録と例外の追加調査を閲覧できます。実解析はログインして「このサンプルを実解析」。審査アカウントのOpenには保存済みの作業も表示されます。保存結果の閲覧でもAI費用は発生しません。

構成図: `artifacts/architecture.png`（編集元 `docs/architecture.svg`）。３分デモ: `artifacts/code-groove-demo.mp4`。字幕付きの実画面録画で、音声は同じPCM音源・楽譜から収録タイミングに合わせて再構成しています。ナレーションはありません。配信用MP4と再生成スクリプトをGit管理し、収録元の生動画・音声は除外しています。

```powershell
node scripts/capture-demo.mjs
uv run --with imageio-ffmpeg python scripts/assemble-demo.py
```

収録は公開サンプルだけを使い、新規AI呼び出しは0件です。再生成にはPlaywright Chromiumが必要です。

## ３分デモ台本

0:00–0:25 課題と価値。ファイルの場所と意味のまとまりの違いを説明。

0:25–1:00 Arrangeで混在・分散サンプルを比較。Repoを再生し、停止してThemeへ。同じ素材で配置だけが変わることを示す。

1:00–1:35 実解析済みのサンプルを開き、打点からInspectへ。Agentがコードを読み、仮説を立て、関連実装やテストを調べた実ログと根拠を示す。

1:35–2:15 「例外はある？」で理由のある違いを調べる。証拠リンクから該当行へ移動。評価と限界を説明。

2:15–2:40 非公開worker、読み取り専用ツール、所有権・クォータ・予算・再生時のモデル呼び出しゼロを紹介。

2:40–3:00 対象ユーザーと今後の拡張（言語・解析範囲・チーム運用）をまとめる。

YouTubeへの公開・URL登録は未実施です。提出完了と動画公開を装わないでください。
