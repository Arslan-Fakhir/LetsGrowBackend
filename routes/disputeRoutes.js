// disputeRoutes.js
const express = require('express');
const router = express.Router();
const Dispute = require('../models/Dispute');
const { authenticateToken } = require('../middlewares/checkAuthToken');

// Create a new dispute
router.post('/disputes', authenticateToken, async (req, res) => {
  try {
    const { description, entrepreneur_id } = req.body;
    
    if (!description || !entrepreneur_id) {
      return res.status(400).json({ message: 'Description and entrepreneur_id are required' });
    }
    
    const dispute = new Dispute({
      description,
      investor_id: req.user.userId,
      entrepreneur_id,
      status: 'pending'
    });
    
    await dispute.save();
    res.status(201).json({ message: 'Dispute created successfully', dispute });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all disputes (admin/moderator access)
router.get('/disputes', authenticateToken, async (req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate('investor_id', 'name email')
      .populate('entrepreneur_id', 'name email')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get disputes for current user (investor or entrepreneur)
router.get('/disputes/my', authenticateToken, async (req, res) => {
  try {
    const disputes = await Dispute.find({
      $or: [
        { investor_id: req.user.userId },
        { entrepreneur_id: req.user.userId }
      ]
    })
      .populate('investor_id', 'name email')
      .populate('entrepreneur_id', 'name email')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get specific dispute by ID
router.get('/disputes/:id', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('investor_id', 'name email')
      .populate('entrepreneur_id', 'name email');
    
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }
    
    // Check if user is involved in the dispute or is admin
    if (dispute.investor_id._id.toString() !== req.user.userId && 
        dispute.entrepreneur_id._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(dispute);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update dispute status
router.put('/disputes/:id', authenticateToken, async (req, res) => {
  try {
    const { status, resolution } = req.body;
    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (resolution) updateData.resolution = resolution;
    if (status === 'resolved') updateData.resolved_at = new Date();
    
    const dispute = await Dispute.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('investor_id', 'name email')
      .populate('entrepreneur_id', 'name email');
    
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }
    
    res.json({ message: 'Dispute updated successfully', dispute });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete dispute
router.delete('/disputes/:id', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }
    
    // Only allow deletion by the dispute creator
    if (dispute.investor_id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await Dispute.findByIdAndDelete(req.params.id);
    res.json({ message: 'Dispute deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

