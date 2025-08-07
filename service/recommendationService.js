// Recommendation logic (content-based filtering)
const UserReadHistory = require('../models/UserReadHistory');
const Article = require('../models/Article');

async function getRecommendedArticles(userId, limit = 10, skip = 0) {
  // Get articles user has read
  const readHistory = await UserReadHistory.find({ userId }).select('articleId');
  const readArticleIds = readHistory.map(r => r.articleId);

  // Get topics from read articles
  const readArticles = await Article.find({ _id: { $in: readArticleIds } });
  const topics = [...new Set(readArticles.flatMap(a => a.topics))];

  // Recommend articles with similar topics, not already read
  const recommendations = await Article.find({
    topics: { $in: topics },
    _id: { $nin: readArticleIds }
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);

  return recommendations;
}

module.exports = { getRecommendedArticles };
