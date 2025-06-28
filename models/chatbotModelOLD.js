const mongoose = require('mongoose');
const natural = require('natural');
const stopword = require('stopword');

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: { type: String, enum: ['user', 'bot'], required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: {
    source: String,
    confidence: Number,
    entities: [{
      entity: String,
      value: String,
      confidence: Number
    }]
  }
});

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, text: true },
  answer: { type: String, required: true },
  category: String,
  keywords: [String],
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  messages: [messageSchema],
  context: { type: Object, default: {} },
  status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
  title: { type: String, index: true }
}, { timestamps: true });

// Create indexes
faqSchema.index({ question: 'text', keywords: 'text' });
conversationSchema.index({ userId: 1, updatedAt: -1 });

// Pre-save hook for conversation title
conversationSchema.pre('save', function(next) {
  if (!this.title && this.messages.length > 0) {
    const firstMessage = this.messages[0].text;
    this.title = firstMessage.length > 50 
      ? `${firstMessage.substring(0, 47)}...` 
      : firstMessage;
  }
  next();
});

// FAQ similarity search method
faqSchema.statics.findSimilarQuestion = async function(message) {
  try {
    const allFaqs = await this.find({});
    if (allFaqs.length === 0) return null;

    const processedMessage = stopword.removeStopwords(
      new natural.WordTokenizer().tokenize(message.toLowerCase())
    ).join(' ');

    const tfidf = new natural.TfIdf();
    tfidf.addDocument(processedMessage);
    
    const similarities = allFaqs.map(faq => {
      const processedQuestion = stopword.removeStopwords(
        new natural.WordTokenizer().tokenize(faq.question.toLowerCase())
      ).join(' ');
      
      tfidf.addDocument(processedQuestion);
      const similarity = tfidf.similarity(0, 1);
      tfidf.removeDocument(processedQuestion);
      
      return { faq, similarity };
    });

    return similarities.reduce((prev, current) => 
      (current.similarity > prev.similarity) ? current : prev
    );
  } catch (err) {
    console.error('findSimilarQuestion error:', err);
    throw err;
  }
};

// Add text search helper
faqSchema.statics.textSearch = async function(query) {
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });
};

const FAQ = mongoose.model('FAQ', faqSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = { FAQ, Conversation };