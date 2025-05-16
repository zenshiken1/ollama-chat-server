// server.js
const express  = require('express');
const http     = require('http');
const socketIO = require('socket.io');
const axios    = require('axios');

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server);

app.use(express.static('public'));

// —— 可调参数 ——————————————————————————
const MODEL_NAME   = 'gemma3:12b'; // 换成你的模型
const MAX_TURNS    = 10;        // 记忆最近 N 轮（1 轮 = user+assistant）
const SEP_USER     = 'User: ';
const SEP_ASSIST   = 'AI: ';
// ————————————————————————————————

// <socket.id, history[]>
const histories = new Map();

io.on('connection', (socket) => {
  console.log('🟢  新用户连接', socket.id);
  histories.set(socket.id, []);

  // 清空历史（前端可自定义按钮触发）
  socket.on('clearHistory', () => {
    histories.set(socket.id, []);
    console.log(`🗑  清空历史 ${socket.id}`);
  });

  socket.on('disconnect', () => {
    histories.delete(socket.id);
    console.log('🔴  用户断开', socket.id);
  });

  // —— 主流程：收到用户消息 ————————————
  socket.on('userMessage', async (msg) => {
    const history = histories.get(socket.id) || [];

    // 1. 拼接最近对话为 prompt（最后 MAX_TURNS 轮）
    const recent = history.slice(-MAX_TURNS * 2);
    let prompt = recent.map(h =>
      (h.role === 'user' ? SEP_USER : SEP_ASSIST) + h.content
    ).join('\n');
    prompt += `\n${SEP_USER}${msg}\n${SEP_ASSIST}`;  // 加上新问题

    // 2. 向前端声明“AI 开始打字”
    socket.emit('botStart');

    try {
      // 3. 调用 Ollama，开启流式
      const res = await axios({
        method: 'post',
        url:    'http://localhost:11434/api/generate',
        responseType: 'stream',
        data: { model: MODEL_NAME, prompt, stream: true }
      });

      let answer = '';  // 累积整段回复

      res.data.on('data', chunk => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const j = JSON.parse(line);
            if (j.response) {
              answer += j.response;
              socket.emit('botStream', j.response); // 增量推送
            }
            if (j.done) {
              socket.emit('botDone');
              // 4. 把这一轮问答写入历史
              history.push({ role: 'user',      content: msg });
              history.push({ role: 'assistant', content: answer });
            }
          } catch { /* 忽略无效行 */ }
        }
      });

    } catch (err) {
      console.error('❌  调用 Ollama 失败:', err.message);
      socket.emit('botStream', '[错误] 无法连接 Ollama');
      socket.emit('botDone');
    }
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () =>
  console.log(`🌐  访问：http://<你的局域网IP>:${PORT}`)
);
