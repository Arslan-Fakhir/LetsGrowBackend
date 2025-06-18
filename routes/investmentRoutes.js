// investmentRoutes.js
const express = require('express');
const router = express.Router();
const Investment = require('../models/investmentModel');
const Startup = require('../models/Startup');
const { authenticateToken } = require('../middlewares/checkAuthToken');

// Create investment
router.post('/investments', authenticateToken, async (req, res) => {
  try {
    const { amount, startup_id, investment_type, equity_percentage } = req.body;
    
    if (!amount || !startup_id) {
      return res.status(400).json({ message: 'Amount and startup_id are required' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ message: 'Investment amount must be positive' });
    }
    
    // Check if startup exists
    const startup = await Startup.findById(startup_id);
    if (!startup) {
      return res.status(404).json({ message: 'Startup not found' });
    }
    
    const investment = new Investment({
      amount,
      startup_id,
      investor_id: req.user.userId,
      investment_type: investment_type || 'equity',
      equity_percentage,
      status: 'pending'
    });
    
    await investment.save();
    
    // Update startup funding received
    await Startup.findByIdAndUpdate(startup_id, {
      $inc: { funding_received: amount }
    });
    
    res.status(201).json({ message: 'Investment created successfully', investment });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all investments
router.get('/investments', authenticateToken, async (req, res) => {
  try {
    const { status, startup_id } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (startup_id) filter.startup_id = startup_id;
    
    const investments = await Investment.find(filter)
      .populate('startup_id', 'name industry')
      .populate('investor_id', 'name email')
      .sort({ createdAt: -1 });
    res.json(investments);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get investments by current user (investor)
router.get('/investments/my', authenticateToken, async (req, res) => {
  try {
    const investments = await Investment.find({ investor_id: req.user.userId })
      .populate('startup_id', 'name industry')
      .sort({ createdAt: -1 });
    res.json(investments);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get investments received by entrepreneur's startups
router.get('/investments/received', authenticateToken, async (req, res) => {
  try {
    const startups = await Startup.find({ entrepreneur_id: req.user.userId }).select('_id');
    const startupIds = startups.map(startup => startup._id);
    
    const investments = await Investment.find({ startup_id: { $in: startupIds } })
      .populate('startup_id', 'name industry')
      .populate('investor_id', 'name email')
      .sort({ createdAt: -1 });
    res.json(investments);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get specific investment
router.get('/investments/:id', authenticateToken, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id)
      .populate('startup_id', 'name industry')
      .populate('investor_id', 'name email');
    
    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }
    
    res.json(investment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update investment status
router.put('/investments/:id', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const investment = await Investment.findById(req.params.id);
    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    
    const updatedInvestment = await Investment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('startup_id', 'name industry')
      .populate('investor_id', 'name email');
    
    res.json({ message: 'Investment updated successfully', investment: updatedInvestment });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete investment (only if pending)
router.delete('/investments/:id', authenticateToken, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id);
    
    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }
    
    // Only allow deletion by the investor and only if pending
    if (investment.investor_id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (investment.status !== 'pending') {
      return res.status(400).json({ message: 'Can only delete pending investments' });
    }
    
    // Revert funding received
    await Startup.findByIdAndUpdate(investment.startup_id, {
      $inc: { funding_received: -investment.amount }
    });
    
    await Investment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
