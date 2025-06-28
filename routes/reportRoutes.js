// reportRoutes.js
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { authenticateToken } = require('../middlewares/checkAuthToken');

// Create a new report
router.post('/reports', authenticateToken, async (req, res) => {
  try {
    const { details, attribute, startup_id } = req.body;
    
    if (!details || !attribute || !startup_id) {
      return res.status(400).json({ message: 'Details, attribute, and startup_id are required' });
    }
    
    const report = new Report({
      details,
      attribute,
      startup_id,
      reported_by: req.user.userId,
      status: 'pending'
    });
    
    await report.save();
    res.status(201).json({ message: 'Report created successfully', report });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all reports (admin access)
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('startup_id', 'name industry')
      .populate('reported_by', 'name email')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get reports by current user
router.get('/reports/my', authenticateToken, async (req, res) => {
  try {
    const reports = await Report.find({ reported_by: req.user.userId })
      .populate('startup_id', 'name industry')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get specific report by ID
router.get('/reports/:id', authenticateToken, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('startup_id', 'name industry')
      .populate('reported_by', 'name email');
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    res.json(report);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update report status
router.put('/reports/:id', authenticateToken, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const validStatuses = ['pending', 'investigating', 'resolved', 'dismissed'];
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (admin_notes) updateData.admin_notes = admin_notes;
    if (status === 'resolved' || status === 'dismissed') {
      updateData.resolved_at = new Date();
    }
    
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('startup_id', 'name industry')
      .populate('reported_by', 'name email');
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete report
router.delete('/reports/:id', authenticateToken, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Only allow deletion by the report creator
    if (report.reported_by.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
