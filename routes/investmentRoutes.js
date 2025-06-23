// routes/investmentRoutes.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Investment = require('../models/investmentModel');
const Startup = require('../models/startupModel');
const User = require('../models/userModel');
const { authenticateUser } = require('../middlewares/checkAuthToken');
const { sendInvestmentConfirmationEmail } = require('../utils/emailService');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe checkout session
router.post('/create-checkout-session',  async (req, res) => {
  try {
    const { amount, startupId, startupName, image, currency } = req.body;
    const userId = req.userId; // From auth middleware

    // Validate input
    if (!amount || amount <= 0 || !startupId || !currency) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request data'
      });
    }

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Investment in ${startupName}`,
            images: image ? [image] : [],
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      client_reference_id: userId,
      metadata: {
        startupId,
        amount: amount.toString(),
        startupName,
      },
    });
    ////
    console.log('Backend send session id: ',session.id)
    ////
    res.json({ 
      success: true,
      data: { id: session.id } // Ensure this matches frontend expectation
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Payment failed'
    });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            await handleCheckoutSessionCompleted(session);
            break;
        // Add other event types as needed
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
});

async function handleCheckoutSessionCompleted(session) {
    try {
        // Create investment record
        const investment = new Investment({
            investor: session.client_reference_id,
            startup: session.metadata.startupId,
            amount: parseFloat(session.metadata.amount),
            stripeSessionId: session.id,
            paymentStatus: 'completed',
            transactionDetails: {
                paymentIntent: session.payment_intent,
                customerEmail: session.customer_details?.email
            }
        });

        await investment.save();

        // Update startup funding
        await Startup.findByIdAndUpdate(
            session.metadata.startupId,
            { $inc: { fundingReceived: parseFloat(session.metadata.amount) } },
            { new: true }
        );

        // Send confirmation email
        const user = await User.findById(session.client_reference_id);
        const startup = await Startup.findById(session.metadata.startupId);
        
        if (user && startup) {
            await sendInvestmentConfirmationEmail(
                user.email,
                user.name,
                startup.startupName,
                session.metadata.amount
            );
        }
    } catch (err) {
        console.error('Error handling checkout.session.completed:', err);
    }
}

// Get investments for a startup
router.get('/startup/:startupId', async (req, res) => {
    try {
        const investments = await Investment.find({ startup: req.params.startupId })
            .populate('investor', 'name email')
            .sort({ createdAt: -1 });

        res.json({ 
            success: true,
            message: 'Investments retrieved successfully',
            data: investments
        });

    } catch (error) {
        console.error('Error fetching investments:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch investments',
            error: error.message
        });
    }
});

// Get user's investments
router.get('/user',  async (req, res) => {
    try {
        const investments = await Investment.find({ investor: req.userId })
            .populate('startup', 'startupName industry')
            .sort({ createdAt: -1 });

        res.json({ 
            success: true,
            message: 'User investments retrieved successfully',
            data: investments
        });

    } catch (error) {
        console.error('Error fetching user investments:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch user investments',
            error: error.message
        });
    }
});

// Updated verify-payment endpoint with authentication and better error handling
router.get('/verify-payment', async (req, res) => {
    try {
        const { session_id } = req.query;
        
        if (!session_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Session ID is required'
            });
        }

        // 1. Check database first
        const existingInvestment = await Investment.findOne({ 
            stripeSessionId: session_id
        }).populate('startup', 'startupName');

        if (existingInvestment) {
            return res.json({ 
                success: true,
                message: 'Payment already recorded',
                data: existingInvestment
            });
        }

        // 2. Verify with Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ['payment_intent']
        });

        // 3. Validate payment status
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ 
                success: false,
                message: 'Payment not completed',
                payment_status: session.payment_status
            });
        }

        // 4. Validate startup exists
        const startup = await Startup.findById(session.metadata.startupId);
        if (!startup) {
            return res.status(400).json({
                success: false,
                message: 'Startup not found'
            });
        }

        // 5. Create investment record - FIX: Use both client_reference_id and req.userId
        const investorId = session.client_reference_id || req.userId;
        if (!investorId) {
            return res.status(400).json({
                success: false,
                message: 'Could not determine investor'
            });
        }

        const investment = new Investment({
            investor: investorId,
            startup: session.metadata.startupId,
            amount: parseFloat(session.metadata.amount),
            stripeSessionId: session.id,
            paymentStatus: 'completed',
            transactionDetails: {
                paymentIntent: session.payment_intent,
                customerEmail: session.customer_details?.email
            }
        });

        await investment.save();

        // 6. Update startup funding
        await Startup.findByIdAndUpdate(
            session.metadata.startupId,
            { $inc: { fundingReceived: parseFloat(session.metadata.amount) } }
        );

        // 7. Send confirmation email
        const user = await User.findById(investorId);
        if (user && startup) {
            await sendInvestmentConfirmationEmail(
                user.email,
                user.name,
                startup.startupName,
                session.metadata.amount
            );
        }

        return res.json({ 
            success: true,
            message: 'Payment verified and recorded',
            data: investment
        });

    } catch (error) {
        console.error('Payment verification error:', {
            message: error.message,
            stack: error.stack,
            stripeError: error.type || 'N/A'
        });
        
        return res.status(500).json({ 
            success: false,
            message: 'Failed to verify payment',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;