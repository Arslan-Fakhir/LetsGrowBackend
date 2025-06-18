// manpowerRoutes.js
const express = require('express');
const router = express.Router();
const Manpower = require('../models/Manpower');
const { authenticateToken } = require('../middlewares/checkAuthToken');

// Create manpower request
router.post('/manpower', authenticateToken, async (req, res) => {
  try {
    const { position, requirements, count, timeline, employmentType, location, startup_id, salary_range } = req.body;
    
    if (!position || !requirements || !count || !timeline || !employmentType || !startup_id) {
      return res.status(400).json({ 
        message: 'Position, requirements, count, timeline, employmentType, and startup_id are required' 
      });
    }
    
    const manpower = new Manpower({
      position,
      requirements,
      count,
      timeline,
      employmentType,
      location,
      startup_id,
      entrepreneur_id: req.user.userId,
      salary_range,
      status: 'active'
    });
    
    await manpower.save();
    res.status(201).json({ message: 'Manpower request created successfully', manpower });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all manpower requests
router.get('/manpower', authenticateToken, async (req, res) => {
  try {
    const { status, employmentType, location } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (employmentType) filter.employmentType = employmentType;
    if (location) filter.location = new RegExp(location, 'i');
    
    const manpowerRequests = await Manpower.find(filter)
      .populate('startup_id', 'name industry')
      .populate('entrepreneur_id', 'name email')
      .sort({ createdAt: -1 });
    res.json(manpowerRequests);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get manpower requests by current user
router.get('/manpower/my', authenticateToken, async (req, res) => {
  try {
    const manpowerRequests = await Manpower.find({ entrepreneur_id: req.user.userId })
      .populate('startup_id', 'name industry')
      .sort({ createdAt: -1 });
    res.json(manpowerRequests);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get specific manpower request
router.get('/manpower/:id', authenticateToken, async (req, res) => {
  try {
    const manpower = await Manpower.findById(req.params.id)
      .populate('startup_id', 'name industry')
      .populate('entrepreneur_id', 'name email');
    
    if (!manpower) {
      return res.status(404).json({ message: 'Manpower request not found' });
    }
    
    res.json(manpower);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update manpower request
router.put('/manpower/:id', authenticateToken, async (req, res) => {
  try {
    const manpower = await Manpower.findById(req.params.id);
    
    if (!manpower) {
      return res.status(404).json({ message: 'Manpower request not found' });
    }
    
    // Only allow update by the creator
    if (manpower.entrepreneur_id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const allowedUpdates = ['position', 'requirements', 'count', 'timeline', 'employmentType', 'location', 'salary_range', 'status'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    const updatedManpower = await Manpower.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    )
      .populate('startup_id', 'name industry')
      .populate('entrepreneur_id', 'name email');
    
    res.json({ message: 'Manpower request updated successfully', manpower: updatedManpower });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete manpower request
router.delete('/manpower/:id', authenticateToken, async (req, res) => {
  try {
    const manpower = await Manpower.findById(req.params.id);
    
    if (!manpower) {
      return res.status(404).json({ message: 'Manpower request not found' });
    }
    
    // Only allow deletion by the creator
    if (manpower.entrepreneur_id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await Manpower.findByIdAndDelete(req.params.id);
    res.json({ message: 'Manpower request deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
