import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// 环境变量获取
const KIMI_API_KEY = process.env.KIMI_API_KEY;

// 账户配置列表：对应你申请的 2 个 Neynar API 和 4 个 Signer
const ACCOUNTS = [
  {
    id: 'Account_A',
    role: 'Crypto 猎手 / 链上数据分析师',
    prompt: '你是一个加密货币极客，喜欢用数据说话。用中文发一条简短的推文(Farcaster cast)，字数少于 150 字。可以探讨某个新协议、DeFi 机制或 Base 链生态的新事物。语言风格：极客、敏锐、经常带有 Degen 或 Alpha 等词汇。不要加标签(#)。',
    neynarKey: process.env.NEYNAR_API_KEY_1,
    signerUuid: process.env.SIGNER_UUID_A
  },
  {
    id: 'Account_B',
    role: 'Crypto 哲学家 / 行业观察者',
    prompt: '你是一个 Web3 行业观察者。用中文发一条简短的推文(Farcaster cast)，字数少于 150 字。探讨 Web3 愿景、去中心化理念或 Layer2 的未来。语言风格：理性、深刻，喜欢探讨“为什么”。不要加标签(#)。',
    neynarKey: process.env.NEYNAR_API_KEY_1,
    signerUuid: process.env.SIGNER_UUID_B
  },
  {
    id: 'Account_C',
    role: 'Vibe Coder / 独立开发者',
    prompt: '你是一个充满激情的独立开发者，倡导 Vibe Coding 和 AI 辅助编程。用中文发一条简短的推文(Farcaster cast)，字数少于 150 字。分享你用 Cursor/Trae 等 AI 工具快速构建产品的体验或心得。语言风格：充满热情、鼓励动手。不要加标签(#)。',
    neynarKey: process.env.NEYNAR_API_KEY_2,
    signerUuid: process.env.SIGNER_UUID_C
  },
  {
    id: 'Account_D',
    role: 'AI 开源研究员',
    prompt: '你是一个严谨的 AI 开源模型研究员。用中文发一条简短的推文(Farcaster cast)，字数少于 150 字。分享关于大语言模型、Agent 架构或优秀 GitHub 开源项目的见解。语言风格：严谨、硬核。不要加标签(#)。',
    neynarKey: process.env.NEYNAR_API_KEY_2,
    signerUuid: process.env.SIGNER_UUID_D
  }
];

// 1. 调用 Kimi API 生成内容
async function generateCastContent(prompt) {
  try {
    const response = await axios.post(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        model: "moonshot-v1-8k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8
      },
      { headers: { 'Authorization': `Bearer ${KIMI_API_KEY}` } }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Kimi API 调用失败:', error?.response?.data || error.message);
    return null;
  }
}

// 2. 调用 Neynar API 发布 Cast
async function publishCast(neynarKey, signerUuid, text) {
  try {
    const response = await axios.post(
      'https://api.neynar.com/v2/farcaster/cast',
      { signer_uuid: signerUuid, text: text },
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
    fs.writeFileSync('report.md', reportText, 'utf8');
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

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    console.log(`\n--- 正在处理账户: ${account.id} (${account.role}) ---`);
    
    // 生成内容
    const content = await generateCastContent(account.prompt);
    if (!content) {
      reportLines.push(`❌ ${account.id}: 内容生成失败`);
      continue;
    }
    console.log(`📝 生成内容: ${content}`);

    // 发送到 Farcaster
    const castHash = await publishCast(account.neynarKey, account.signerUuid, content);
    if (castHash) {
      reportLines.push(`✅ ${account.id}: 发帖成功\n内容: ${content}`);
      console.log(`✅ 发帖成功! Hash: ${castHash}`);
    } else {
      reportLines.push(`❌ ${account.id}: 发帖失败`);
    }

    // 关键防并发：除了最后一个账户，其他账户执行完都要随机休息 5 ~ 15 分钟
    if (i < ACCOUNTS.length - 1) {
      await randomSleep(5, 15);
    }
  }

  // 任务全部结束，保存战报
  console.log('\n✅ 任务全部完成，正在生成本地战报文件...');
  saveReportToFile(reportLines.join('\n'));
}

// 启动执行
main();
