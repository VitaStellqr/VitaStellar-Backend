// Article model for health articles with topic tags
const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  topics: [{ type: String, index: true }],
  url: { type: String },
  publishedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Article', ArticleSchema);
