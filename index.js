import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import { getCryptoNews, getAINews } from './news.js';

dotenv.config();

// 环境变量获取
const KIMI_API_KEY = process.env.KIMI_API_KEY;

// 账户配置列表：对应你申请的 2 个 Neynar API 和 4 个 Signer
const ACCOUNTS = [
  {
    id: 'Account_A',
    role: 'Crypto 猎手 / 链上数据分析师',
    prompt: 'You are an elite crypto degen and on-chain data analyst active on Farcaster. Write a short, highly engaging cast (under 250 characters) in English. Share an alpha, a sharp observation about a new DeFi protocol, Base ecosystem, or on-chain metric. Tone: edgy, confident, casual crypto slang (use terms like "tbh", "ngl", "alpha", "based", but don\'t overdo it). Do NOT use hashtags. Do NOT sound like an AI assistant. If you include a URL, it MUST be a complete, real, and clickable link (e.g., https://base.org), never use placeholders or ellipses like "https://...". Just post the raw text directly.',
    neynarKey: process.env.NEYNAR_API_KEY_1,
    signerUuid: process.env.SIGNER_UUID_A
  },
  {
    id: 'Account_B',
    role: 'Crypto 哲学家 / 行业观察者',
    prompt: 'You are a deep-thinking Web3 philosopher and industry observer on Farcaster. Write a short, thought-provoking cast (under 280 characters) in English. Discuss the future of decentralization, the endgame of Layer 2s, or the philosophy behind the crypto movement. Tone: intellectual, slightly poetic, calm, and analytical. Ask a rhetorical question at the end to spark discussion. Do NOT use hashtags or emojis excessively. Do NOT sound like an AI. If you include a URL, it MUST be a complete, real link, never use placeholders or ellipses. Just post the raw text directly.',
    neynarKey: process.env.NEYNAR_API_KEY_1,
    signerUuid: process.env.SIGNER_UUID_B
  },
  {
    id: 'Account_C',
    role: 'Vibe Coder / 独立开发者',
    prompt: 'You are a passionate indie hacker and "vibe coder" building fast with AI tools (like Cursor or Trae) on Farcaster. Write a short, energetic cast (under 250 characters) in English. Share a quick win, a bug you just squashed, or how AI is 10x-ing your shipping speed today. Tone: enthusiastic, casual, builder-centric (use "shipping", "building", "lfg"). Do NOT use hashtags. Do NOT sound like an AI generating text. If you include a URL to a tool or your project, it MUST be a complete, real link (e.g., https://cursor.com), never use placeholders or ellipses. Just post the raw text directly.',
    neynarKey: process.env.NEYNAR_API_KEY_2,
    signerUuid: process.env.SIGNER_UUID_C
  },
  {
    id: 'Account_D',
    role: 'AI 开源研究员',
    prompt: 'You are a hardcore open-source AI researcher and model evaluator on Farcaster. Write a short, technical cast (under 280 characters) in English. Share a sharp insight about a recent open-source LLM, Agent architectures, or RAG techniques. Tone: rigorous, highly technical, objective, and slightly nerdy. Do NOT use hashtags or hype words. Do NOT sound like a generic AI assistant. If you mention a GitHub repo or research paper, the URL MUST be complete and real (e.g., https://github.com/...), never use placeholders or ellipses. Just post the raw text directly.',
    neynarKey: process.env.NEYNAR_API_KEY_2,
    signerUuid: process.env.SIGNER_UUID_D
  }
];

// 1. 调用 Kimi API 生成内容 (返回 JSON 包含选择和内容)
async function generateCastContent(prompt) {
  try {
    const response = await axios.post(
      'https://api.moonshot.ai/v1/chat/completions',
      {
        model: "kimi-k2-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8
      },
      { headers: { 'Authorization': `Bearer ${KIMI_API_KEY}` } }
    );
    let content = response.data.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    return JSON.parse(content);
  } catch (error) {
    console.error('Kimi API 调用失败:', error?.response?.data || error.message);
    return null;
  }
}

// 2. 调用 Neynar API 发布 Cast (支持 embeds 图文链接)
async function publishCast(neynarKey, signerUuid, text, embeds = []) {
  try {
    const body = { signer_uuid: signerUuid, text: text };
    if (embeds.length > 0) {
      body.embeds = embeds;
    }
    const response = await axios.post(
      'https://api.neynar.com/v2/farcaster/cast',
      body,
      { headers: { 'api_key': neynarKey, 'Content-Type': 'application/json' } }
    );
    return response.data?.cast?.hash; // 返回发帖成功的 hash
  } catch (error) {
    console.error('Neynar API 调用失败:', error?.response?.data || error.message);
    return null;
  }
}

// 3. 保存战报到本地文件
function saveReportToFile(reportText) {
  try {
    const dateStr = new Date().toLocaleDateString();
    let existing = '';
    try { existing = fs.readFileSync('report.md', 'utf8'); } catch(e) {}
    
    // 如果今天还没有写入过发帖战报，则清空并写入全新的一天；否则追加
    if (!existing.includes(dateStr)) {
      fs.writeFileSync('report.md', reportText + '\n\n', 'utf8');
    } else {
      fs.appendFileSync('report.md', reportText + '\n\n', 'utf8');
    }
    console.log('✅ 战报已成功保存到 report.md');
  } catch (error) {
    console.error('保存战报失败:', error.message);
  }
}

// 辅助函数：随机休眠 (防并发风控的核心)
const randomSleep = async (minMinutes, maxMinutes) => {
  const ms = Math.floor(Math.random() * (maxMinutes - minMinutes + 1) + minMinutes) * 60 * 1000;
  console.log(`[系统] 等待 ${ms / 1000 / 60} 分钟后继续执行下一个账户...`);
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 主流程：依次执行 4 个账号
async function main() {
  console.log('🚀 开始执行 Farcaster AI 舰队每日发帖任务...');
  let reportLines = [`📊 Farcaster 舰队执行报告 (${new Date().toLocaleDateString()})\n`];

  console.log('正在获取最新行业新闻...');
  const cryptoNews = await getCryptoNews();
  const aiNews = await getAINews();

  // 读取或初始化状态文件（供后续协同使用）
  let state = {};
  if (fs.existsSync('state.json')) {
    try { state = JSON.parse(fs.readFileSync('state.json', 'utf8')); } catch(e){}
  }

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    console.log(`\n--- 正在处理账户: ${account.id} (${account.role}) ---`);
    
    let finalPrompt = account.prompt;
    let availableNews = [];
    if (account.id.includes('A') || account.id.includes('B')) {
      availableNews = cryptoNews;
    } else {
      availableNews = aiNews;
    }

    if (availableNews && availableNews.length > 0) {
      const newsJson = JSON.stringify(availableNews.map((n, idx) => ({ index: idx, title: n.title, link: n.link })), null, 2);
      finalPrompt += `\n\nHere are today's top news:\n${newsJson}\n\nPick ONE news item to comment on. Your commentary MUST NOT contain the news URL itself in the text (it will be attached as an embed separately). Output ONLY a valid JSON object in this format:\n{"selected_index": 0, "commentary": "your sharp insight..."}`;
    } else {
      finalPrompt += `\n\nOutput ONLY a valid JSON object in this format:\n{"selected_index": -1, "commentary": "your sharp insight..."}`;
    }

    // 生成内容
    const result = await generateCastContent(finalPrompt);
    if (!result || !result.commentary) {
      reportLines.push(`❌ ${account.id}: 内容生成失败`);
      continue;
    }
    console.log(`📝 生成内容: ${result.commentary}`);

    let embeds = [];
    if (result.selected_index !== undefined && result.selected_index >= 0 && availableNews[result.selected_index]) {
      const selectedNews = availableNews[result.selected_index];
      embeds.push({ url: selectedNews.link });
      // 如果新闻有图片，也加到 embed 里（Farcaster 支持多个 embed）
      if (selectedNews.image) {
        embeds.push({ url: selectedNews.image });
      }
      console.log(`🔗 附带链接: ${selectedNews.link}`);
    }

    // 发送到 Farcaster
    const castHash = await publishCast(account.neynarKey, account.signerUuid, result.commentary, embeds);
    if (castHash) {
      reportLines.push(`✅ ${account.id}: 发帖成功\n内容: ${result.commentary}`);
      console.log(`✅ 发帖成功! Hash: ${castHash}`);
      // 记录帖子 hash 和 username，用于后续巡检时的 Quote 捧哏协同
      state[account.id] = {
        hash: castHash,
        username: "unknown" // 发帖接口未返回 username，协同脚本用 URL fallback 处理
      }; 
    } else {
      reportLines.push(`❌ ${account.id}: 发帖失败`);
    }

    // 关键防并发：除了最后一个账户，其他账户执行完都要随机休息 5 ~ 15 分钟
    if (i < ACCOUNTS.length - 1) {
      await randomSleep(5, 15);
    }
  }

  // 保存状态供协同脚本使用
  fs.writeFileSync('state.json', JSON.stringify(state, null, 2));

  // 任务全部结束，保存战报
  console.log('\n✅ 任务全部完成，正在生成本地战报文件...');
  saveReportToFile(reportLines.join('\n'));
}

// 启动执行
main();
