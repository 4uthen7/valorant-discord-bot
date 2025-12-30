# Valorant Discord Stats Bot


🎮 VALORANT Discord Stats Bot
Discord上でVALORANTプレイヤーの統計情報を素早く、美しく表示するためのボットです。

✨ 特徴
正確なデータ照合: 名前とタグに加え、内部ID（PUUID）を使用してプレイヤーを特定するため、データの齟齬がありません。

詳細な戦績レポート: ランク情報だけでなく、K/DやHS率、直近5試合の勝敗状況を網羅しています。

日本語対応: ランク名やインターフェースはすべて日本語に最適化されています。

🚀 使い方
Discordのチャンネルで以下のコマンドを入力するだけです。

!stats プレイヤー名#タグ
例: !stats TenZ#0915

📊 表示される情報
ランク情報: 現在のランク・RR、過去の最高ランク

パフォーマンス: 平均K/D、平均ヘッドショット率、直近5試合の勝率

エージェント: 最も使用しているエージェント

試合履歴: 直近5試合の勝敗、エージェント、スコア詳細

🛠️ 技術スタック
Engine: Node.js 18.0.0以上

Library: discord.js v14

API: Henrik-3 Valorant API

⚙️ セットアップ
このリポジトリをクローンします。

npm install で依存関係（discord.js, axios）をインストールします。

環境変数（.env）に DISCORD_TOKEN と HENRIK_API_KEY を設定します。

npm start でボットを起動します。

📝 ライセンス
このプロジェクトは MITライセンス の下で公開されています。

## 使い方

```
!stats プレイヤー名#タグ
```

例: `!stats Faker#0001`

## 表示される情報

- 現在のランク・RR
- 最高ランク
- 平均K/D比率
- 平均ヘッドショット率
- 直近5試合の勝率
- 最も使用したエージェント
- 直近5試合の詳細

## 技術スタック

- Discord.js v14
- Henrik-3 Valorant API
- Node.js 18+
