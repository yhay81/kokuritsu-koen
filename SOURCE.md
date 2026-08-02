# Source and transformation

## Official sources

- Provider: 環境省 自然環境局
- Data page: <https://www.env.go.jp/park/doc/data.html>
- Overview: <https://www.env.go.jp/park/doc/data/national/np_1.pdf>
- Zoning areas: <https://www.env.go.jp/park/doc/data/national/np_2.pdf>
- As of: 2026-04-10
- Retrieved: 2026-08-02
- Overview PDF: 307,132 bytes; SHA-256 `648195b060ac2545208e09239c30c9cf26ec37bd1ba47ad0f0d53c1a068197a4`
- Zoning PDF: 131,380 bytes; SHA-256 `7cfa24b4c1be30219aef2a375a20e54b499a21ebf9dffbd16ccae67095f0d9f2`
- Terms: 公共データ利用規約（第1.0版）
- Terms page: <https://www.env.go.jp/mail.html>

出典：環境省「国立公園の概要」「国立公園地種区分別面積」を加工して作成。

## Verified dimensions

- 35国立公園、関係都道府県42
- 陸域総面積 2,447,855ha
- 特別保護地区 366,129ha
- 第1種特別地域 331,776ha
- 第2種特別地域 549,772ha
- 第3種特別地域 585,134ha
- 普通地域 615,044ha
- 公園名、指定年月日、関係都道府県、各面積の欠損0
- 公園名とIDの重複0

全国の区分別合計は公式表と完全一致します。公園別の整数ha表示は丸めのため、大雪山で区分列合計が総面積より1ha多く、日高山脈襟裳十勝で1ha少なくなります。原表の表示値を補正せず保持します。

## Transformation / 加工

1. 2つの公式PDFを公園名で対応させる。
2. 和暦の指定年月日を西暦へ変換する。
3. 関係都道府県を配列化し、絞り込み候補を派生する。
4. 5区分の割合を各面積と陸域総面積からブラウザで計算する。
5. 英字の安定IDを公園ごとに付け、比較リストの端末保存にだけ使う。

公園区域、区分、面積を推測・補完しません。PDFのハッシュが変わった場合は更新内容を人が確認します。

## Interpretation boundary

総面積と区分面積は陸域のみです。海域公園地区は含みません。地種区分は公園計画上の保護規制区分で、面積構成は保全価値、自然度、訪問価値、立入可否の順位ではありません。現地の通行・利用条件は各公園の最新案内で確認してください。
