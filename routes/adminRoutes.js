// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Startup = require('../models/startupModel');
const Investment = require('../models/investmentModel');

router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalEntrepreneurs,
      totalInvestors,
      totalStartups,
      approvedStartups,
      rejectedStartups,
      totalInvestment
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'entrepreneur' }),
      User.countDocuments({ role: 'investor' }),
      Startup.countDocuments(),
      Startup.countDocuments({ status: 'approved' }),
      Startup.countDocuments({ status: 'rejected' }),
      Investment.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    res.json({
      totalUsers,
      totalEntrepreneurs,
      totalInvestors,
      totalStartups,
      approvedStartups,
      rejectedStartups,
      totalInvestment: totalInvestment[0]?.total || 0
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;