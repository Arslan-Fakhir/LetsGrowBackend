// routes/investmentRoutes.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Investment = require('../models/investmentModel');
const Startup = require('../models/startupModel');
const User = require('../models/userModel');
const { authenticateUser } = require('../middlewares/checkAuthToken');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, startupId, startupName, image, currency, investorId } = req.body;

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
            name: `${startupId}`,
            images: image ? [image] : [],
            description: `Startup: ${startupName}`   
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      client_reference_id: investorId,
      metadata: {
        startupId,
        amount: amount.toString(),
        startupName,
      },
    });
    console.log("session id: ",session.id)
    // Return only the session ID - payment will be handled by webhook
    res.json({ 
      success: true,
      data: { id: session.id }
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create payment session'
    });
  }
});

// Webhook handler for Stripe events
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
    case 'checkout.session.async_payment_succeeded':
      const asyncSession = event.data.object;
      await handleCheckoutSessionCompleted(asyncSession);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

async function handleCheckoutSessionCompleted(session) {
  try {
    // Only proceed if payment was successful
    if (session.payment_status === 'paid') {
      // Check if investment already exists
      const existingInvestment = await Investment.findOne({ 
        stripeSessionId: session.id 
      });

      if (existingInvestment) {
        console.log(`Investment already exists for session: ${session.id}`);
        return;
      }

      // Create new investment
      const investment = new Investment({
        investorId: session.client_reference_id,
        startupId: session.metadata.startupId,
        amount: parseFloat(session.metadata.amount),
        stripeSessionId: session.id,
        paymentStatus: 'completed'
      });

      await investment.save();

      // Update startup's funding
      await Startup.findByIdAndUpdate(
        session.metadata.startupId,
        { $inc: { fundingReceived: parseFloat(session.metadata.amount) } },
        { new: true }
      );

      console.log(`💰 Payment succeeded! Investment recorded for session: ${session.id}`);
    } else {
      console.warn(`Payment status is ${session.payment_status}. Skipping investment save.`);
    }
  } catch (error) {
    console.error('Error handling checkout.session.completed:', error);
  }
}

router.get('/verify-payment', async (req, res) => {
  try {
    const { session_id } = req.query;
    console.log("Verify session id: ",session_id)
    console.log('Verifying payment for session:', session_id);
    
    if (!session_id) {
      console.log('No session ID provided');
      return res.status(400).json({ 
        success: false,
        message: 'Session ID is required'
      });
    }

    // Check Stripe for payment status
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log('Stripe session status:', session.payment_status);
    
    if (session.payment_status !== 'paid') {
      console.log('Payment not completed');
      return res.status(400).json({ 
        success: false,
        message: 'Payment not completed'
      });
    }

    // Check if investment exists
    const investment = await Investment.findOne({ stripeSessionId: session_id });
    console.log('Investment record found:', !!investment);
    
    if (!investment) {
      console.log('No investment record found\n\n');
      
      //////////////////          Testing         /////////////////
      //console.log('req data',req.body)
      //console.log('Check investment session id: ',session_id)
      /////////////////////////////////////////////////////////////

        const investment = new Investment({
            investorId: session.client_reference_id,
            startupId: session.metadata.startupId,
            amount: parseFloat(session.metadata.amount),
            stripeSessionId: session.id,
            paymentStatus: 'completed'
        });

        await investment.save();

        await Startup.findByIdAndUpdate(
            session.metadata.startupId,
            { $inc: { fundingReceived: parseFloat(session.metadata.amount) } },
            { new: true }
        );
    
    }

    console.log('Payment verified successfully');
    res.json({ 
      success: true,
      message: 'Payment verified',
      data: investment
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify payment'
    });
  }
});

router.get('/:investorId', async (req, res) => {
  try {
    // 1. Find all completed investments for the current investor
    const investments = await Investment.find({ 
      investorId: req.params.investorId,
      paymentStatus: 'completed'
    });

    // 2. Group investments by startupId and calculate total investment per startup
    const investmentsByStartup = investments.reduce((acc, investment) => {
      const startupId = investment.startupId.toString();
      if (!acc[startupId]) {
        acc[startupId] = {
          totalAmount: 0,
          investments: [],
          firstInvestmentDate: investment.createdAt
        };
      }
      acc[startupId].totalAmount += investment.amount;
      acc[startupId].investments.push(investment);
      // Keep track of the earliest investment date
      if (investment.createdAt < acc[startupId].firstInvestmentDate) {
        acc[startupId].firstInvestmentDate = investment.createdAt;
      }
      return acc;
    }, {});

    const startupIds = Object.keys(investmentsByStartup);

    if (startupIds.length === 0) {
      return res.json({
        success: true,
        message: 'You have not invested in any startups yet',
        data: [],
        count: 0,
        totalInvested: 0
      });
    }

    // 3. Get detailed information about these startups
    const startups = await Startup.find({
      _id: { $in: startupIds }
    }).select('startupName description industry startupImage fundingRequired fundingReceived stage status entrepreneurId');

    // 4. Get entrepreneur user details for all startups
    const entrepreneurIds = startups.map(startup => startup.entrepreneurId);
    const entrepreneurs = await User.find({
      _id: { $in: entrepreneurIds }
    }).select('name email contactNumber location');

    // Create a map of entrepreneurId to entrepreneur details for quick lookup
    const entrepreneurMap = {};
    entrepreneurs.forEach(entrepreneur => {
      entrepreneurMap[entrepreneur._id] = {
        name: entrepreneur.name,
        email: entrepreneur.email,
        phone: entrepreneur.contactNumber,
        location: entrepreneur.location
      };
    });

    // 5. Format the response with summed investment amount and entrepreneur info
    const investedStartups = startups.map(startup => {
      const startupInvestments = investmentsByStartup[startup._id.toString()];
      const entrepreneurInfo = entrepreneurMap[startup.entrepreneurId] || {};
      
      return {
        id: startup._id,
        name: startup.startupName,
        description: startup.description,
        industry: startup.industry,
        image: startup.startupImage?.url,
        investment: `$${startupInvestments.totalAmount.toLocaleString()}`,
        investmentAmount: startupInvestments.totalAmount, // Summed amount for this startup
        fundingRequired: startup.fundingRequired,
        fundingReceived: startup.fundingReceived,
        stage: startup.stage,
        status: startup.status,
        investedAt: startupInvestments.firstInvestmentDate, // Date of first investment
        entrepreneur: {
          id: startup.entrepreneurId,
          name: entrepreneurInfo.name,
          email: entrepreneurInfo.email,
          phone: entrepreneurInfo.phone,
          location: entrepreneurInfo.location
        },
        investmentCount: startupInvestments.investments.length // Number of investments in this startup
      };
    });

    // Calculate total invested across all startups
    const totalInvested = Object.values(investmentsByStartup).reduce(
      (sum, { totalAmount }) => sum + totalAmount, 0
    );

    res.json({
      success: true,
      data: investedStartups,
      count: investedStartups.length, // Number of unique startups invested in
      totalInvested: totalInvested,   // Sum of all investment amounts across all startups
      stats: {
        averageInvestmentPerStartup: totalInvested / startupIds.length,
        averageInvestmentPerTransaction: totalInvested / investments.length,
        uniqueStartups: startupIds.length,
        totalTransactions: investments.length
      }
    });

  } catch (error) {
    console.error('Error fetching invested startups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invested startups',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update the /all endpoint in investmentRoutes.js
router.get('/all/:id', async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    //console.log("\n\n\n\n\nhello : ",user)
    const investments = await Investment.find()
      .populate({
        path: 'investorId',
        select: 'name email contactNumber profileImage paymentStatus'
      })
      .populate({
        path: 'startupId',
        select: 'startupName entrepreneurId',
        populate: {
          path: 'entrepreneurId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 });
      console.log("\n\n Investment : ",investments)
    // Format the response to match frontend expectations
    const formattedInvestments = investments.map(investment => ({
      _id: investment._id,
      investorName: investment.investorId?.name || 'Unknown',
      investorImage: investment.investorId?.profileImage?.url || '',
      amount: investment.amount,
      program: investment.startupId?.startupName || 'General Donation',
      startupId: investment.startupId?._id || null,
      startupTitle: investment.startupId?.startupName || 'General Donation',
      entrepreneur: investment.startupId?.entrepreneurId?.name || 'Platform',
      investorEmail: investment.investorId?.email || '',
      investorPhone: investment.investorId?.contactNumber || '',
      date: investment.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      description: `Investment in ${investment.startupId?.startupName || 'the platform'}`,
      attachments: investment.attachments || [],
      status: investment.paymentStatus,
      feedback: investment.feedback || ''
    }));

    res.json({
      success: true,
      data: formattedInvestments
    });

  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investments'
    });
  }
});

// Update investment status
router.patch('/status/:id',  async (req, res) => {
  try {
    const { status, feedback } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status value' 
      });
    }

    // Check if user is admin
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const updatedInvestment = await Investment.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        feedback: feedback || undefined 
      },
      { new: true }
    );

    if (!updatedInvestment) {
      return res.status(404).json({ 
        success: false,
        message: 'Investment not found' 
      });
    }

    res.json({
      success: true,
      message: 'Investment status updated successfully',
      data: updatedInvestment
    });

  } catch (error) {
    console.error('Error updating investment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update investment status'
    });
  }
});

module.exports = router;






















////////////////////////////////////////////////////////////////////////////////////////////
/*                      Was Working
// Get all startups that the current investor has invested in
router.get('/:investorId', async (req, res) => {
  try {
    
    
    // 1. Find all investments for the current investor
    const investments = await Investment.find({ 
      investorId: req.params.investorId,  // From authenticated user
      paymentStatus: 'completed' // Only completed investments
    });

    // 2. Extract unique startup IDs from investments
    const startupIds = [...new Set(investments.map(inv => inv.startupId))];

    if (startupIds.length === 0) {
      return res.json({
        success: true,
        message: 'You have not invested in any startups yet',
        data: []
      });
    }

    // 3. Get detailed information about these startups
    const startups = await Startup.find({
      _id: { $in: startupIds }
    }).select('startupName description industry startupImage fundingRequired fundingReceived stage status entrepreneurId');

    // 4. Format the response with investment amount for each startup
    const investedStartups = startups.map(startup => {
      const investment = investments.find(inv => inv.startupId.equals(startup._id));
      return {
        id: startup._id,
        name: startup.startupName,
        entrepreneurId: startup.entrepreneurId,
        description: startup.description,
        industry: startup.industry,
        image: startup.startupImage.url,
        investment: `$${investment.amount.toLocaleString()}`,
        fundingRequired: startup.fundingRequired,
        fundingReceived: startup.fundingReceived,
        stage: startup.stage,
        status: startup.status,
        investedAt: investment.createdAt
        // Add any other fields you need
      };
    });

    res.json({
      success: true,
      data: investedStartups
    });

  } catch (error) {
    console.error('Error fetching invested startups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invested startups'
    });
  }
});    .........................................*/


/*
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
});*/
