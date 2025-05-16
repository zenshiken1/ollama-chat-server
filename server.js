/* server.js */
const express  = require('express');
const http     = require('http');
const socketIO = require('socket.io');
const axios    = require('axios');

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server);

app.use(express.static('public'));

// <socket.id, history[]>
const histories = new Map();
// <socket.id, 選択モデル名>
const modelSelections = new Map();

// メモリに保持する最大対話ターン数
const MAX_TURNS  = 10;        // 直近 N ターン（1 ターン = user + assistant）
const SEP_USER   = 'User: ';
const SEP_ASSIST = 'AI: ';

// モデル一覧を取得するヘルパー関数
async function fetchModels() {
  // タグAPIを優先、その後従来のエンドポイントを試行
  const endpoints = [
    'http://localhost:11434/api/tags',      // Ollama のタグAPI
    'http://localhost:11434/api/models',    // 従来のモデル一覧API
    'http://localhost:11434/models'         // フォールバック
  ];
  for (const url of endpoints) {
    try {
      const res = await axios.get(url);
      const data = res.data;
      // /api/tags の場合、models はオブジェクト配列
      if (Array.isArray(data.models) && data.models.length > 0) {
        // オブジェクトなら name を抽出
        if (typeof data.models[0] === 'object') {
          return data.models.map(m => m.name);
        }
        // 配列が文字列ならそのまま返却
        return data.models;
      }
      // 直接配列を返すケース
      if (Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.warn(`モデル一覧取得に失敗 (${url}): ${err.message}`);
    }
  }
  console.error('モデル一覧取得に全て失敗しました');
  return [];
}

io.on('connection', async (socket) => {
  console.log('🟢 新ユーザー接続', socket.id);
  histories.set(socket.id, []);

  // 接続時に利用可能なモデル一覧をクライアントへ送信
  const models = await fetchModels();
  if (models.length > 0) {
    modelSelections.set(socket.id, models[0]); // デフォルトは最初のモデル
  }
  socket.emit('modelList', models);

  // クライアントからモデル選択イベントを受信
  socket.on('selectModel', (modelName) => {
    console.log(`モデル選択: ${modelName} by ${socket.id}`);
    modelSelections.set(socket.id, modelName);
  });

  // チャット履歴クリア
  socket.on('clearHistory', () => {
    histories.set(socket.id, []);
    console.log(`🗑 履歴クリア: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    histories.delete(socket.id);
    modelSelections.delete(socket.id);
    console.log('🔴 ユーザー断開', socket.id);
  });

  // ユーザーメッセージ受信
  socket.on('userMessage', async (msg) => {
    const history       = histories.get(socket.id) || [];
    const selectedModel = modelSelections.get(socket.id);

    // 1. 直近対話からプロンプト生成
    const recent = history.slice(-MAX_TURNS * 2);
    let prompt = recent.map(h =>
      (h.role === 'user' ? SEP_USER : SEP_ASSIST) + h.content
    ).join('\n');
    prompt += `\n${SEP_USER}${msg}\n${SEP_ASSIST}`;

    // 2. クライアントへ打字開始通知
    socket.emit('botStart');

    try {
      // 3. Ollama APIへリクエスト（ストリーミング対応）
      const res = await axios({
        method: 'post',
        url:    'http://localhost:11434/api/generate',
        responseType: 'stream',
        data: { model: selectedModel, prompt, stream: true }
      });

      let answer = '';
      res.data.on('data', chunk => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const j = JSON.parse(line);
            if (j.response) {
              answer += j.response;
              socket.emit('botStream', j.response);
            }
            if (j.done) {
              socket.emit('botDone');
              // 4. 対話履歴に保存
              history.push({ role: 'user',      content: msg });
              history.push({ role: 'assistant', content: answer });
            }
          } catch {} // JSON パース失敗は無視
        }
      });
    } catch (err) {
      console.error('❌ Ollama 呼び出し失敗:', err.message);
      socket.emit('botStream', '[エラー] Ollama に接続できません');
      socket.emit('botDone');
    }
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () =>
  console.log(`🌐 アクセス: http://localhost:${PORT}`)
);
