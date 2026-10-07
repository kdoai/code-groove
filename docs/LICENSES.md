# ライセンスと第三者素材

Code Groove本体、同梱コード、録音、依存ライブラリは別々の条件で扱います。第三者への再配布では、この文書だけでなく、該当するライセンス本文と著作権・出典表示を保持してください。

## アプリ本体

ルートの`LICENSE`はなく、本体全体の再利用条件は未指定です。第三者素材のMIT表記を、本体全体への許諾と読み替えることはできません。公開GitHub上での閲覧・forkの扱いと、別のサービスへの転用・再配布の許諾は別です。[GitHubの説明](https://choosealicense.com/no-permission/)

本体をオープンソースとして再配布可能にする場合は、権利者がライセンスを選び、適用範囲を明示する必要があります。

## 同梱するソース

| 対象 | 出典と条件 | 保持している表示 |
|---|---|---|
| Tsugiaiの解析用ソースと参考ソース | [固定版のMIT License](https://github.com/kdoai/tsugiai/blob/35a951488d7b00518e7e73a329d46713cbeacbe8/LICENSE) | [解析用](../fixtures/licenses/tsugiai-LICENSE.txt)・[参考用](../fixtures/repository-reference/TSUGIAI_LICENSE.txt)に著作権表示と許諾全文 |
| SoundCoding2026、Codelody | 表示や探索の発想を参考にしたもの | コード・音源の流用なし。将来コピーする際は、その版の利用条件を別途確認 |

[MIT](https://opensource.org/license/mit)は利用・改変・再配布を認めますが、コピーまたは重要な部分には著作権表示と許諾本文を残す条件があります。Tsugiaiの固定版と同梱の表示は対応しています。解析対象のコードは実行していません。

## 音源

録音Bass・Pianoは[tonejs-instrumentsの固定版](https://github.com/nbrosowsky/tonejs-instruments/tree/622c2f1c32c8cfce4158ddc3eb26e518ddef37e5)から取得しています。上流は**コードをMIT、録音をCC BY 3.0**と区別しており、録音をMIT素材として扱っていません。

[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)は商用を含む利用・改変・再配布を認めます。著作者・指定された出典、ライセンスへのリンク、改変の表示など、[本文の条件](https://creativecommons.org/licenses/by/3.0/legalcode)を満たす必要があります。

- [取得元と固定hash](../assets/audio-source/sources.json)を記録し、[上流のライセンス表示](../assets/audio-source/LICENSE.txt)を同梱しています。
- [公開音源のNOTICE](../apps/web/public/audio/midnight-jazz-v4/NOTICE.txt)に、Nicholaus P. Brosowsky、Karoryfer、VSO2、上流URL、CC BY 3.0へのリンク、モノラル化・フィルタ・正規化などの加工内容を記載しています。再生画面からも開けます。
- 自作Vibes等は既存のNOTICEでMITとされています。ただし、個別の権利者表示と許諾本文は未整備です。録音素材や本体と一括して許諾済みと解釈せず、再配布前に適用範囲と本文を整える必要があります。

上流の条件と出典表示の照合は、元録音の権利関係すべてを独立に証明するものではありません。

## 依存ライブラリと配布物

依存の版は`pnpm-lock.yaml`と`uv.lock`で固定しています。JavaScript依存の宣言にはMIT、Apache-2.0、BSD、ISCなどがあり、開発依存にはMPL-2.0やCC BY 4.0もあります。パッケージ名とライセンス名だけで、全配布条件を満たしたと判断しません。

Webビルドは[Viteのライセンス出力](https://vite.dev/config/build-options.html#build-license)を使い、実際にbundleへ入る依存の本文を`dist/web/THIRD_PARTY_LICENSES.md`へ出力します。このファイルもCloud Runへ配備し、[公開URL](https://code-groove-web-a5ygiois2a-an.a.run.app/THIRD_PARTY_LICENSES.md)で参照できます。音源のNOTICEとは別のファイルです。

Firebaseの配布パッケージには本文ファイルがなく、上記の自動出力だけでは名前とApache-2.0の識別子しか残りません。[FirebaseのLICENSE全文](../apps/web/public/licenses/Firebase-LICENSE.txt)と[著作権・取得元の表示](../apps/web/public/licenses/Firebase-NOTICE.txt)を別途同梱しています。Monacoも、MIT本文に加えて[配布パッケージのThirdPartyNotices](../apps/web/public/licenses/Monaco-ThirdPartyNotices.txt)をそのまま保持します。editor workerにも適用されます。依存更新時には、これらの固定版との対応も確認してください。

Python依存は配布パッケージのライセンス文書を仮想環境に保持し、その環境をコンテナに同梱します。[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)のLICENSE・該当するNOTICE、MITやBSD等の著作権表示も、依存を更新・加工・再配布するときに保持する必要があります。

## 確認範囲と残る判断

確認したのは、同梱素材の出典・指定ライセンス・表示、固定依存の宣言と配布文書、Web成果物への本文の同梱です。本体のライセンス選択、自作音源の許諾表示の整備は権利者の判断が残ります。

特許・商標、元素材の権利者による許諾の有効性、解析へ提供するコードの利用権限、外部サービスの契約条件すべてを網羅した法的審査ではありません。「法的に問題が一切ない」と保証する説明はしていません。自分のコード以外を解析・公開するときは、モデルへの送信と公開範囲を含め、利用権限を確認してください。[送信と保存の範囲](data-handling.md)
