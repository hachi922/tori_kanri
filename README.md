# 🐦 とり体重管理アプリ

インコ・小鳥の体重・健康を記録するWebアプリです。  
GitHub Pages でホスティングし、GitHub Gist をバックエンドとして複数端末で同期できます。

**URL：** https://hachi922.github.io/tori_kanri/

---

## 機能

- **体重記録** — 3羽分の体重を日ごとに記録。年単位で折りたたみ表示
- **グラフ** — 体重推移グラフ（目標体重ラインつき）
- **メモ** — 通院 / 水浴び / 爪切り / 餌購入 / 体調メモ / その他を年単位で管理
- **設定** — 名前・テーマカラー変更、CSVエクスポート
- **複数端末同期** — GitHub Gist 経由でスマホ・PCどちらでも同じデータを使える

---

## セットアップ

### 1. GitHub Gist の準備

1. https://gist.github.com/ で新しい Gist を作成
2. ファイル名を `pet_data.json`、内容を `{}` にして保存（Secret gist 推奨）
3. Gist の URL から ID をコピー（`gist.github.com/<ユーザー名>/<この部分>`）
4. `app.js` の先頭にある `GIST_ID` を書き換える

```js
const GIST_ID   = '（Gist の ID）';
const GIST_FILE = 'pet_data.json';
```

### 2. Personal Access Token（PAT）の取得

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 「Generate new token」→ スコープは `gist` だけチェック
3. 生成されたトークン（`ghp_...`）をコピーして保管

### 3. GitHub Pages の有効化

1. リポジトリの Settings → Pages
2. Source：「Deploy from a branch」、Branch：`main / (root)` → Save

### 4. アプリにPATを入力

1. アプリを開いて「設定」タブ → GitHub連携（PAT）欄
2. コピーしたトークンを貼り付けて「保存」
3. ※ PAT は各端末のブラウザに1回だけ入力が必要

---

## データ形式（Gist JSON）

```json
{
  "weightData": [
    { "date": "2026-10-07", "w": [57.1, 36.0, 53.9] }
  ],
  "vetData": [
    { "date": "2026-09-01", "type": "vet",  "cost": 3500, "notes": "定期健診" },
    { "date": "2026-10-01", "type": "bath",               "notes": "" },
    { "date": "2026-10-05", "type": "food", "cost": 800,  "notes": "ペレット補充" }
  ],
  "config": {
    "names": ["うた", "はる", "なな"],
    "goalWeights": [54.0, 35.0, 50.0],
    "themeIdx": 0
  }
}
```

### メモの種別

| type | 表示 | 費用入力 |
|------|------|----------|
| `vet`   | 🩺 通院    | あり |
| `bath`  | 💧 水浴び  | なし |
| `nail`  | ✂️ 爪切り  | なし |
| `note`  | 📝 体調メモ | なし |
| `food`  | 🌾 餌購入  | あり |
| `other` | ⭐ その他  | なし |

---

## 技術スタック

- HTML / CSS / Vanilla JS（フレームワークなし）
- [Chart.js](https://www.chartjs.org/) — グラフ描画
- [Tabler Icons](https://tabler-icons.io/) — アイコン
- GitHub Gist — データ保存・同期
- GitHub Pages — ホスティング
