const express = require('express');
const router = express.Router();
const { FAQ, Conversation } = require('../models/chatbotModelOLD');
const natural = require('natural');
const stopword = require('stopword');
const responseFunction = require('../utils/responseFunction');
const authTokenHandler = require('../middlewares/checkAuthToken');

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

router.post('/chat', async (req, res) => {
  const { message, conversationId } = req.body;
  const userId = req.userId;
  
  if (!message) {
    return responseFunction(res, 400, 'Message is required', null, false);
  }

  try {
    console.log(`Processing message for user ${userId}: "${message}"`);
    
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        console.log(`Conversation not found: ${conversationId}`);
        return responseFunction(res, 404, 'Conversation not found', null, false);
      }
    } else {
      conversation = new Conversation({
        userId: userId || null,
        messages: []
      });
      console.log('Created new conversation');
    }

    conversation.messages.push({
      text: message,
      sender: 'user',
      timestamp: new Date()
    });

    const faqCount = await FAQ.countDocuments();
    console.log(`Found ${faqCount} FAQs in database`);
    
    let response;
    if (faqCount > 0) {
      response = await checkFaq(message);
      console.log('FAQ check result:', response ? 'Match found' : 'No match');
    } else {
      console.log('No FAQs in database, skipping FAQ check');
    }

    if (!response) {
      console.log('Using mock response');
      response = {
        answer: getMockResponse(message),
        confidence: 0.8,
        source: 'mock_response'
      };
    }

    conversation.messages.push({
      text: response.answer,
      sender: 'bot',
      timestamp: new Date(),
      metadata: {
        source: response.source,
        confidence: response.confidence
      }
    });

    await conversation.save();
    console.log('Conversation saved:', conversation._id);

    return responseFunction(res, 200, 'Message processed', {
      tReply: response.answer,
      reply: response.answer,
      conversationId: conversation._id,
      metadata: {
        source: response.source,
        confidence: response.confidence
      }
    }, true);

  } catch (err) {
    console.error('Chatbot processing error:', err);
    return responseFunction(res, 500, 'Failed to process message', err.message, false);
  }
});

async function checkFaq(message) {
  try {
    console.log(`Checking FAQ for: "${message}"`);
    
    // 1. First try text search with lower threshold
    const textResults = await FAQ.find(
      { $text: { $search: message } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } }).limit(3);

    if (textResults.length > 0) {
      console.log(`Text search results:`, textResults.map(r => ({
        question: r.question,
        score: r.score
      })));
      
      if (textResults[0].score > 0.8) { // Lowered threshold from 1.5 to 0.8
        console.log(`Found FAQ match via text search (score: ${textResults[0].score})`);
        return {
          answer: textResults[0].answer,
          confidence: Math.min(textResults[0].score / 3, 1), // More generous confidence calculation
          source: 'text_search'
        };
      }
    }

    // 2. Fallback to similarity comparison with improved processing
    const allFaqs = await FAQ.find({});
    console.log(`Comparing against ${allFaqs.length} FAQs for similarity`);

    if (allFaqs.length === 0) {
      console.log('No FAQs found in database');
      return null;
    }

    // Improved text processing
    const processedMessage = stopword.removeStopwords(
      tokenizer.tokenize(message.toLowerCase())
    )
    .filter(token => token.length > 2) // Remove very short tokens
    .join(' ');

    const tfidf = new TfIdf();
    tfidf.addDocument(processedMessage);
    
    const similarities = allFaqs.map(faq => {
      const processedQuestion = stopword.removeStopwords(
        tokenizer.tokenize(faq.question.toLowerCase())
      )
      .filter(token => token.length > 2)
      .join(' ');
      
      tfidf.addDocument(processedQuestion);
      const similarity = tfidf.similarity(0, 1);
      tfidf.removeDocument(processedQuestion);
      
      return { faq, similarity };
    });

    // Sort by similarity and get top 3
    const topMatches = similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
    console.log('Top 3 matches:', topMatches.map(m => ({
      question: m.faq.question,
      similarity: m.similarity
    })));

    const bestMatch = topMatches[0];
    if (bestMatch.similarity >= 0.3) { // Lowered threshold from 0.4 to 0.3
      console.log(`Found FAQ match via similarity (score: ${bestMatch.similarity})`);
      return {
        answer: bestMatch.faq.answer,
        confidence: bestMatch.similarity,
        source: 'similarity_match'
      };
    }

    console.log('No suitable FAQ match found (best similarity:', bestMatch.similarity, ')');
    return null;

  } catch (err) {
    console.error('FAQ check error:', {
      error: err,
      message: err.message,
      stack: err.stack
    });
    return null;
  }
}
router.get('/conversations/:userId',  async (req, res) => {
  try {
    if (req.params.userId !== req.userId) {
      return responseFunction(res, 403, 'Unauthorized', null, false);
    }

    const conversations = await Conversation.find({ userId: req.params.userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('_id title createdAt updatedAt messages');

    console.log(`Retrieved ${conversations.length} conversations for user ${req.params.userId}`);
    return responseFunction(res, 200, 'Conversations retrieved', conversations, true);
  } catch (err) {
    console.error('Get conversations error:', {
      error: err,
      message: err.message,
      stack: err.stack
    });
    return responseFunction(res, 500, 'Failed to get conversations', err.message, false);
  }
});

router.get('/conversation/:id',  async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return responseFunction(res, 404, 'Conversation not found', null, false);
    }

    if (conversation.userId.toString() !== req.userId) {
      return responseFunction(res, 403, 'Unauthorized', null, false);
    }

    console.log(`Retrieved conversation ${req.params.id}`);
    return responseFunction(res, 200, 'Conversation retrieved', conversation, true);
  } catch (err) {
    console.error('Get conversation error:', {
      error: err,
      message: err.message,
      stack: err.stack
    });
    return responseFunction(res, 500, 'Failed to get conversation', err.message, false);
  }
});


function getMockResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("let's grow") || lowerMessage.includes("lets grow")) {
    return "Let's Grow is an innovative platform connecting entrepreneurs with investors, mentors, and resources to help grow your business ideas into successful ventures.";
  } else if (lowerMessage.includes("business")) {
    return "Here are some innovative business ideas for 2024:\n1. Sustainable product subscription service\n2. AI-powered personal shopping assistant\n3. Virtual reality fitness platform\n4. Smart home automation services\n5. Niche online education platforms";
  } else if (lowerMessage.includes("science")) {
    return "Science is the systematic study of the natural world through observation and experimentation. Key concepts include the scientific method, hypothesis testing, and peer review. Would you like me to explain a specific scientific concept in more detail?";
  } else if (lowerMessage.includes("photosynthesis")) {
    return "Photosynthesis is the process by which plants, algae, and some bacteria convert sunlight, carbon dioxide, and water into glucose and oxygen. The chemical equation is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. This process occurs in the chloroplasts of plant cells.";
  }
  
  return `I understand you're asking about "${message}". While I don't have a specific answer for this, I can help you find resources or information about this topic. Could you please provide more details about what you're looking for?`;
}

module.exports = router;