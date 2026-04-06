import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const KIMI_API_KEY = process.env.KIMI_API_KEY;

const ACCOUNTS = [
  { id: 'Account_A', role: 'Crypto Degen', targetFids: '3,2,602,1214', neynarKey: process.env.NEYNAR_API_KEY_1, signerUuid: process.env.SIGNER_UUID_A }, // Dan Romero, v, Jesse Pollak
  { id: 'Account_B', role: 'Web3 Philosopher', targetFids: '5650,4129,472', neynarKey: process.env.NEYNAR_API_KEY_1, signerUuid: process.env.SIGNER_UUID_B }, // vitalik.eth, dcposch
  { id: 'Account_C', role: 'Vibe Coder', targetFids: '1214,13505,3', neynarKey: process.env.NEYNAR_API_KEY_2, signerUuid: process.env.SIGNER_UUID_C },
  { id: 'Account_D', role: 'AI Researcher', targetFids: '4129,2,5650', neynarKey: process.env.NEYNAR_API_KEY_2, signerUuid: process.env.SIGNER_UUID_D }
];

// 从指定的大 V (FIDs) 拉取最新热帖 (使用绝对免费的用户 Feed 接口)
async function getTargetUserFeed(neynarKey, fids) {
  try {
    const res = await axios.get(`https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fids}&with_recasts=false&limit=10`, {
      headers: { api_key: neynarKey }
    });
    return res.data.casts || [];
  } catch (e) {
    console.error(`拉取大V动态 (FIDs: ${fids}) 失败:`, e?.response?.data || e.message);
    return [];
  }
}

// 核心决策层：使用 Kimi 根据人设分析哪条值得 Quote Cast (引用转发)
async function analyzeWithKimi(role, casts) {
  const castsText = casts.map((c, i) => `[${i}] Author: ${c.author.username}\nText: ${c.text}`).join('\n\n');
  const prompt = `You are a ${role} on Farcaster. Here are some recent casts from top influencers:\n\n${castsText}\n\nChoose exactly ONE cast to QUOTE (Quote Tweet). Your commentary should be a sharp, independent perspective, adding value or polite counter-arguments. In English, under 200 chars, no hashtags, no AI vibes.\n\nOutput ONLY a valid JSON object in this format:\n{"quote_index": 0, "quote_text": "your insightful commentary..."}`;
  
  try {
    const response = await axios.post(
      'https://api.moonshot.ai/v1/chat/completions',
      { model: "kimi-k2-turbo-preview", messages: [{ role: "user", content: prompt }], temperature: 0.8 },
      { headers: { 'Authorization': `Bearer ${KIMI_API_KEY}` } }
    );
    let content = response.data.choices[0].message.content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/```json\n?/, '').replace(/```/,'');
    }
    return JSON.parse(content);
  } catch (e) {
    console.error('Kimi 分析失败:', e?.response?.data || e.message);
    return null;
  }
}

// 执行 Quote Cast (引用转发)
async function quoteCast(neynarKey, signerUuid, text, targetHash, targetUsername) {
  try {
    // Farcaster 官方支持用这个短链接来 Quote 任意 cast，即便 username unknown 也生效
    const quoteUrl = targetUsername !== "unknown" 
      ? `https://warpcast.com/${targetUsername}/${targetHash.substring(0,10)}`
      : `https://warpcast.com/~/conversations/${targetHash}`;

    const res = await axios.post('https://api.neynar.com/v2/farcaster/cast', 
      { signer_uuid: signerUuid, text: text, embeds: [{ url: quoteUrl }] },
      { headers: { api_key: neynarKey } }
    );
    return res.data?.cast?.hash;
  } catch (e) { 
    console.error('Quote Cast 失败:', e?.response?.data || e.message);
    return null; 
  }
}

const randomSleep = async (minMinutes, maxMinutes) => {
  const ms = Math.floor(Math.random() * (maxMinutes - minMinutes + 1) + minMinutes) * 60 * 1000;
  console.log(`[系统] 等待 ${ms / 1000 / 60} 分钟...`);
  return new Promise(resolve => setTimeout(resolve, ms));
};

async function main() {
  console.log('🚀 开始执行巡检与互动任务 (Feed Poller & Synergy)...');
  let reportLines = [`\n🔄 互动巡检报告 (${new Date().toLocaleTimeString()})\n`];

  let state = {};
  if (fs.existsSync('state.json')) {
    try { state = JSON.parse(fs.readFileSync('state.json', 'utf8')); } catch(e){}
  }

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    console.log(`\n--- 账号: ${account.id} 正在巡检大 V 动态 (FIDs: ${account.targetFids}) ---`);
    
    // Synergy (协同): 50% 的概率去给兄弟账号 Quote 捧哏
    let didSynergy = false;
    if (account.id === 'Account_B' && state['Account_A']) {
       if (Math.random() > 0.5) {
         console.log('🤖 触发矩阵协同：账号 B Quote 账号 A');
         await quoteCast(account.neynarKey, account.signerUuid, "Based take tbh. Worth deep thinking.", state['Account_A'].hash, state['Account_A'].username);
         reportLines.push(`✅ ${account.id}: Quote 协同了 Account_A`);
         didSynergy = true;
       }
    }
    if (account.id === 'Account_D' && state['Account_C'] && !didSynergy) {
       if (Math.random() > 0.5) {
         console.log('🤖 触发矩阵协同：账号 D Quote 账号 C');
         await quoteCast(account.neynarKey, account.signerUuid, "Great stuff. Shipping speed is everything.", state['Account_C'].hash, state['Account_C'].username);
         reportLines.push(`✅ ${account.id}: Quote 协同了 Account_C`);
         didSynergy = true;
       }
    }

    // Feed Polling (自动巡检拉取并用 Kimi 分析决策)
    const casts = await getTargetUserFeed(account.neynarKey, account.targetFids);
    if (casts.length > 0) {
      const decision = await analyzeWithKimi(account.role, casts);
      if (decision) {
         if (decision.quote_index !== undefined && casts[decision.quote_index] && decision.quote_text) {
           const targetCast = casts[decision.quote_index];
           await quoteCast(account.neynarKey, account.signerUuid, decision.quote_text, targetCast.hash, targetCast.author.username);
           console.log(`💬 引用转发了: ${decision.quote_text}`);
         }
         reportLines.push(`✅ ${account.id}: 完成 1 次大V动态的 Quote Cast`);
      } else {
         reportLines.push(`❌ ${account.id}: 巡检分析失败`);
      }
    }

    if (i < ACCOUNTS.length - 1) {
      await randomSleep(2, 5); // 巡检互动可以频率高一点，休眠 2-5 分钟
    }
  }

  // 追加写入战报
  fs.appendFileSync('report.md', reportLines.join('\n') + '\n', 'utf8');
  console.log('✅ 互动任务完成，报告已追加到 report.md');
}

main();
