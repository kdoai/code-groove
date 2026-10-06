> Historical record. This describes the version at that time, not R14 acceptance. Current specification: [SPEC.md](SPEC.md).

# R6 — 聴いて選び、Agentで調べる

中心の操作は全体を聴く → 気になるファイル・区間を選ぶ → 精密検査する、の一本です。ディレクトリの階層を維持し、全体／選択ファイルの再生を切り替えます。伴奏トラックは初期状態で非表示。繰り返し・伴奏の表示・ミュートは再生設定に置きます。伴奏は引き続き鳴り、品質点数ではなく音楽的背景です。発音イベントのない資料ファイルでは再生を停止し、コードを表示し続けます。ライト／ダーク設定は端末に保存します。

[NN/GのProgressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)を参照し、主操作を常時、補助設定と記録を必要時に表示します。[Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/)を参照し、取得・構文索引・Geminiの調査・楽譜変換を分けます。これらを本製品に当てはめた設計判断であり、ユーザーテストによる使いやすさの証明ではありません。

## 実際のAgentの活動

本人の実行中ジョブだけを返す `/account/activity` と、実ジョブの連番イベントを使用します。ツール操作の目的、直近に読んだファイル・行、公開の `record_hypothesis` 記録を表示します。内部思考や架空の進捗率は表示しません。画面やダイアログを変えても表示が残り、終了・期限切れ・削除・ログアウトで消えます。構文索引の段階を「Agentが意味を判断中」と表示しません。模擬テスト画像は `agent-activity-r6-mock.png` と命名し、実Geminiの証拠として扱いません。SDKによる適応的ツール調査と既存HITLを維持しています。

## 音源と再現性

`midnight-jazz-v4` は [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) の実録音12点と、自作のvibes等から作ります。録音は **CC BY 3.0**、上流コードはMITです。上流コミットを固定し、[出典とSHA-256](../assets/audio-source/sources.json)、[上流ライセンス](../assets/audio-source/LICENSE.txt)、アプリ内NOTICEに作者と変更内容を記載しました。実行時は外部CDNに接続せず、譜面で使う音源だけを読み込みます。

録音にはモノラルPCM化、フィルター、正規化、滑らかな端点、再生時のattack/releaseを適用しました。ベースE1〜G2、ピアノE3〜C6の6点ずつから近い音程を選び、過度な変速を減らします。違和感は根拠に紐づく既存のリズム／旋律の関係で表し、クリックやクリッピングで表現しません。ドラムはスケジュールしません。旧音源は過去の再現用に保持しています。

固定SemanticMap・grammar・kit hashから同じ譜面が出ます。音源変更は別kit hashになり、保存済み解釈から譜面だけを再構築します。Gemini再調査の判断は変わり得ます。端点・有限値・非クリッピングの技術検証は、楽しさや聴き心地の保証ではありません。新しい音はユーザーの試聴評価を継続します。

生成: `uv run --with imageio-ffmpeg python scripts/build-clean-kit.py`。検証: `uv run python scripts/build-clean-kit.py --verify`。ffmpegは制作時のみ使用し、本番には追加しません。再生処理は [MDN AudioParam ramp](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime) とインストール済みTone.js実装を確認しました。

## 大きいリポジトリの検査範囲

公開GitHub URLに、必要なら `src/checkout` のような相対フォルダーを指定します。指定範囲とルートREADME／主要設定を読み、範囲外を未検査としてAgent入力と画面に明示します。取り込み後は保存結果と既存の差分再検査を使います。非公開GitHubの権限連携やローカルアップロードは、主操作を増やすため今回は採用していません。

上限は40コードファイル・6,000行・1 MiB・32関数。アーカイブは圧縮10 MiB・展開40 MiB・1,000ファイルです。フォルダー指定でも全体のアーカイブを安全性検証します。巨大モノレポの全体一括健診は未対応です。テストでは60外部ファイル／300関数と、対象TS/Python2関数を持つ合成リポジトリを使用。全体の上限拒否、指定範囲の解析、範囲外の攻撃パスの拒否を検証しました。大規模実リポジトリに対するモデル品質の評価ではありません。

## 費用と安全境界

新しいクラウドサービス、IAM権限、常駐インスタンスは追加しません。既存のCloud Run scale-to-zero、認証・所有権・入力制限・期限・Secret Manager・WIF・AI予約上限を維持します。新しい活動APIも未認証・他人の実行・終了・期限切れを返しません。通常CIは変更範囲に応じて選び、音源生成スクリプトと原音の変更も音楽検証の対象になります。今回の音・UI検証で新規の有料モデル呼び出しは行いません。


## R8の表示整理

Agentパネルをヘッダーの「Agent」で開閉し、入力中の質問と選択を保持します。閉じた場合は演奏・コード欄が広がります。実行中ジョブの目的・読取箇所はパネルに関係なく残ります。ヘッダーと重複した全体フッター、コード欄の二重見出し、常時表示の音量・質問例・凡例行を整理しました。解析範囲は「解析済み13/13関数」と出典を簡潔に表示し、詳細はその一箇所から開きます。初回の検出結果、限界、トレースは削除していません。

開閉は [W3C Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) のbutton/aria-expanded/aria-controlsを使います。Spaceでボタンを操作しても全体再生ショートカットは割り込みません。小画面ではAgentを必要時に重ねて表示し、通常時は演奏とコードを維持します。

「サンプル」メニューに、実際に動く [Checkout Lab](../examples/checkout-lab/README.md) のZIP・起動手順・検査範囲を置きました。ダウンロードは公開の固定された自作サンプルのみで、ユーザーのソースや認証情報は含めません。バックエンドは利用者のリポジトリを実行しません。ローカルショップは別プロセスで動く信頼済みの自作デモです。
