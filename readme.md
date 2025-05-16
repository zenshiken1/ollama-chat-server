# AIチャットアプリケーション

このプロジェクトは、Node.js と Socket.IO を使用したリアルタイム AI チャットアプリケーションです。Ollama API 経由でさまざまなモデルを選択してチャットできる機能を備えています。

---

## ✨ 特徴

* **リアルタイム通信**：Socket.IO でクライアントとサーバー間の双方向通信を実現。
* **モデル選択機能**：利用可能なモデル一覧を動的に取得し、ユーザーがドロップダウンからモデルを選択可能。
* **ストリーミング応答**：AI の応答をストリーミング形式で表示し、リアルタイム性を強化。
* **履歴管理**：チャット履歴を一定ターン数までメモリ上に保持。\`

---

## 🚀 必要環境

* Node.js >= 16.x
* npm >= 8.x
* Ollama API がローカルまたは指定ホストで稼働していること

---

## 🛠 インストール

1. リポジトリをクローン

   ```bash
   git clone https://github.com/your-repo/ai-chat-app.git
   cd ai-chat-app
   ```

2. 必要な npm パッケージをインストール

   ```bash
   npm install
   ```

### インストールされる主なパッケージ

| パッケージ名      | 説明                        |
| ----------- | ------------------------- |
| `express`   | HTTP サーバーの構築用フレームワーク      |
| `socket.io` | WebSocket を利用した双方向通信ライブラリ |
| `axios`     | HTTP クライアントライブラリ          |

---

## ⚙️ 実行方法

1. サーバーを起動

   ```bash
   node server.js
   ```

   または package.json にスクリプトがあれば:

   ```bash
   npm start
   ```

2. ブラウザで以下 URL を開く

   ```
   http://localhost:3000
   ```

---

## 📝 ファイル構成

```plaintext
├── server.js        # サーバー実装 (Express + Socket.IO)
├── package.json     # プロジェクト設定と依存関係
└── public
    ├── index.html   # クライアント UI
```

