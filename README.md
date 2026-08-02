# 国立公園くらべ

日本の35国立公園を名前・関係都道府県から探し、陸域面積と5つの地種区分を最大4公園で比較する日本語Webサービスです。

- Production: <https://kokuritsu-koen.yhay81.com>
- Source: 環境省「国立公園の概要」「国立公園地種区分別面積」（2026年4月10日現在）
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:check
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

公式PDFから公園名、指定年月日、関係都道府県、陸域総面積、特別保護地区、第1〜3種特別地域、普通地域の面積だけを収録します。海域公園地区、施設、登山道、通行規制、交通、天候、利用者数は含みません。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
