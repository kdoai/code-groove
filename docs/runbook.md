# 運用手順

## モデル呼び出しを止める

Firestore `runtime_controls/global` に `kill_switch: true` を設定します。新規要求と実行中の次のモデル／ツール呼び出しを止め、保存結果の再生を残します。通常の利用を再開するときは false に戻します。Cloud Tasks `cg-analysis` の pause は配信を止めるだけで、実行中のモデル呼び出しは止めません。

## 登録失敗・切断

ブラウザを閉じても Cloud Tasks worker は処理します。ページを開き直すと project の run または最新 analysis を復元します。ENQUEUE_PENDING は同じ project の `retry-enqueue` APIを呼び、予算を再予約しません。失敗した解析の再実行は日次枠を使う明示操作です。

## ログと寿命

Cloud Logging は run_id / attempt_id / event_type / model_id / error_code を記録します。コード本文・パスワード・ID token はログに出しません。アプリ内の調査ログは所有者のみ閲覧可能で、保存期限は７日です。Firestore TTL は非同期なので、APIの期限検査を常に行います。GCSの後片付けは14日です。

## ロールバック

配備ジョブだけ失敗した場合は `gh run rerun <run-id> --failed --repo kdoai/code-groove` で再試行します。成功済みの検証ジョブは実行しません。同じSHAのイメージが存在すれば再ビルドせず再利用します。手動配備の開始時も、mainの同じSHAで成功したCIがあれば検証を再利用します。基盤のIAMを変更する権限は配備アカウントに与えません。

直前の成功したイメージを `artifacts/deployment.json` と GitHub Actions の履歴から確認し、同じ配備スクリプトで指定します。Artifact Registryは最新２バージョンを保持します。

```powershell
$env:PYTHONPATH='apps/backend;.'
$env:CG_DEPLOY_SKIP_IAM='1'
uv run python infra/gcp.py deploy --image <確認済みの過去イメージ>
```

## 費用

インフラの月6,000円予算は50% / 80% / 100%で通知します。AI は予算のサービスフィルタから外しています。通知は課金停止の保証ではありません。流量・日次モデル枠・保存量を確認し、異常時は kill_switch を先に使います。配備と有料モデル評価は手動起動です。

## 審査後

提出後は審査終了（指定された12月1日）まで main と配備の状態を保持します。以後の開発は別ブランチで行ってください。停止時はまずキューを pause、kill_switch を true にし、Cloud Run / 専用bucket / Artifact Registry / 専用IAM・WIFを確認してから削除します。本プロジェクトの他アプリのリソースは削除しません。アプリの予算通知も個別に削除します。

## 一時的なモデル障害

モデル側の429 / 503 / 504は最大３回の範囲で再試行します。使用量が不明な失敗も予約上限分を保守的に使用済みとして残し、次の出力枠を残予算に合わせます。予算・時間・提出検証を通らない結果は成功として扱いません。配備検証のために一度だけ行った解析回数のクレジットはruntime_controlsの監査レコードと実行記録に残しています。トークン消費・全体予算・恒久的な利用上限は変更していません。通常の失敗を自動で無料扱いする機能ではありません。
