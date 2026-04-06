import Parser from 'rss-parser';

// 自定义解析 RSS 中的图片标签
const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
});

// 辅助函数：从 RSS 节点提取首张图片 URL
function extractImage(item) {
  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
    return item['media:content']['$'].url;
  }
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  const imgMatch = item.content?.match(/<img[^>]+src="([^">]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

export async function getCryptoNews() {
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    return feed.items.slice(0, 5).map(item => ({
      title: item.title,
      link: item.link,
      image: extractImage(item)
    }));
  } catch (error) {
    console.error('获取 Crypto 新闻失败:', error.message);
    return [];
  }
}

export async function getAINews() {
  try {
    // 换成 TechCrunch AI 频道，因为包含高清配图，HackerNews纯文本
    const feed = await parser.parseURL('https://techcrunch.com/category/artificial-intelligence/feed/');
    return feed.items.slice(0, 5).map(item => ({
      title: item.title,
      link: item.link,
      image: extractImage(item)
    }));
  } catch (error) {
    console.error('获取 AI 新闻失败:', error.message);
    return [];
  }
}
