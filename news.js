import Parser from 'rss-parser';
const parser = new Parser();

export async function getCryptoNews() {
  try {
    // 抓取 CoinTelegraph 的免费 RSS
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    // 只取前 5 条最新新闻
    return feed.items.slice(0, 5).map(item => `- ${item.title} (${item.link})`).join('\n');
  } catch (error) {
    console.error('获取 Crypto 新闻失败:', error.message);
    return "";
  }
}

export async function getAINews() {
  try {
    // 抓取 Hacker News 的免费前台 RSS
    const feed = await parser.parseURL('https://hnrss.org/frontpage');
    // 只取前 5 条
    return feed.items.slice(0, 5).map(item => `- ${item.title} (${item.link})`).join('\n');
  } catch (error) {
    console.error('获取 AI 新闻失败:', error.message);
    return "";
  }
}
