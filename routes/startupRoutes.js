// ============================================================================
// STARTUP ROUTES - /routes/startupRoutes.js
// ============================================================================
// This file handles all HTTP routes for startup-related operations
// Place this file in: /routes/startupRoutes.js
// 
// Required dependencies (install with):
// npm install express express-validator
//
// To use this file in your main app.js or server.js, add:
// const startupRoutes = require('./routes/startupRoutes');
// app.use('/api/startups', startupRoutes);
// ============================================================================

const express = require('express');
const router = express.Router();
const Startup = require('../models/startupModel'); // Path to your startup model
const { body, validationResult, param } = require('express-validator');

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================
// These validation rules ensure data integrity before processing requests
const validateStartup = [
    body('name')
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
    body('industry')
        .notEmpty()
        .withMessage('Industry is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Industry must be between 2 and 50 characters'),
    body('current_stage')
        .optional()
        .isIn(['idea', 'prototype', 'mvp', 'early_revenue', 'growth', 'scaling', 'mature'])
        .withMessage('Invalid current stage'),
    body('funding_required')
        .isNumeric()
        .withMessage('Funding required must be a number')
        .isFloat({ min: 0 })
        .withMessage('Funding required must be a positive number'),
    body('funding_received')
        .optional()
        .isNumeric()
        .withMessage('Funding received must be a number')
        .isFloat({ min: 0 })
        .withMessage('Funding received must be a positive number'),
    body('entrepreneur_id')
        .notEmpty()
        .withMessage('Entrepreneur ID is required')
        .isMongoId()
        .withMessage('Invalid entrepreneur ID format'),
    body('investor_id')
        .optional()
        .isMongoId()
        .withMessage('Invalid investor ID format')
];

const validateId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid startup ID format')
];

// Error handling middleware for validation results
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors',
            errors: errors.array()
        });
    }
    next();
};

// ============================================================================
// MAIN CRUD ROUTES
// ============================================================================

// GET /api/startups - Get all startups with optional filtering
// Query parameters: page, limit, industry, current_stage, entrepreneur_id, 
//                  investor_id, search, sort_by, sort_order
// Example: GET /api/startups?industry=tech&current_stage=mvp&page=1&limit=5
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            industry,
            current_stage,
            entrepreneur_id,
            investor_id,
            search,
            sort_by = 'createdAt',
            sort_order = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (industry) filter.industry = new RegExp(industry, 'i');
        if (current_stage) filter.current_stage = current_stage;
        if (entrepreneur_id) filter.entrepreneur_id = entrepreneur_id;
        if (investor_id) filter.investor_id = investor_id;
        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        // Build sort object
        const sortOrder = sort_order === 'asc' ? 1 : -1;
        const sort = { [sort_by]: sortOrder };

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const startups = await Startup.find(filter)
            .populate('entrepreneur_id', 'name email')
            .populate('investor_id', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Startup.countDocuments(filter);

        res.json({
            success: true,
            data: startups,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / parseInt(limit)),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching startups',
            error: error.message
        });
    }
});

// GET /api/startups/:id - Get startup by ID
// Returns single startup with populated entrepreneur and investor details
// Example: GET /api/startups/507f1f77bcf86cd799439011
router.get('/:id', validateId, handleValidationErrors, async (req, res) => {
    try {
        const startup = await Startup.findById(req.params.id)
            .populate('entrepreneur_id', 'name email contact')
            .populate('investor_id', 'name email portfolio');

        if (!startup) {
            return res.status(404).json({
                success: false,
                message: 'Startup not found'
            });
        }

        res.json({
            success: true,
            data: startup
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching startup',
            error: error.message
        });
    }
});

// POST /api/startups - Create new startup
// Required fields: name, description, industry, funding_required, entrepreneur_id
// Optional fields: current_stage, funding_received, investor_id
// Example body: { "name": "TechCorp", "description": "AI startup", "industry": "tech", 
//                "funding_required": 100000, "entrepreneur_id": "507f1f77bcf86cd799439011" }
router.post('/', validateStartup, handleValidationErrors, async (req, res) => {
    try {
        const startup = new Startup(req.body);
        await startup.save();

        const populatedStartup = await Startup.findById(startup._id)
            .populate('entrepreneur_id', 'name email')
            .populate('investor_id', 'name email');

        res.status(201).json({
            success: true,
            message: 'Startup created successfully',
            data: populatedStartup
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating startup',
            error: error.message
        });
    }
});

// PUT /api/startups/:id - Update startup
// Updates entire startup document with new data
// All validation rules apply as in POST request
// Example: PUT /api/startups/507f1f77bcf86cd799439011
router.put('/:id', validateId, validateStartup, handleValidationErrors, async (req, res) => {
    try {
        const startup = await Startup.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
        .populate('entrepreneur_id', 'name email')
        .populate('investor_id', 'name email');

        if (!startup) {
            return res.status(404).json({
                success: false,
                message: 'Startup not found'
            });
        }

        res.json({
            success: true,
            message: 'Startup updated successfully',
            data: startup
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating startup',
            error: error.message
        });
    }
});

// ============================================================================
// SPECIALIZED UPDATE ROUTES
// ============================================================================
// These routes allow updating specific fields without sending entire document

// PATCH /api/startups/:id/stage - Update startup stage
// Body: { "current_stage": "growth" }
// Valid stages: idea, prototype, mvp, early_revenue, growth, scaling, mature
router.patch('/:id/stage', validateId, handleValidationErrors, async (req, res) => {
    try {
        const { current_stage } = req.body;
        
        if (!current_stage || !['idea', 'prototype', 'mvp', 'early_revenue', 'growth', 'scaling', 'mature'].includes(current_stage)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid current stage'
            });
        }

        const startup = await Startup.findByIdAndUpdate(
            req.params.id,
            { current_stage },
            { new: true, runValidators: true }
        )
        .populate('entrepreneur_id', 'name email')
        .populate('investor_id', 'name email');

        if (!startup) {
            return res.status(404).json({
                success: false,
                message: 'Startup not found'
            });
        }

        res.json({
            success: true,
            message: 'Startup stage updated successfully',
            data: startup
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating startup stage',
            error: error.message
        });
    }
});

// PATCH /api/startups/:id/funding - Update funding received
// Body: { "funding_received": 50000 }
// Must be a positive number
router.patch('/:id/funding', validateId, handleValidationErrors, async (req, res) => {
    try {
        const { funding_received } = req.body;
        
        if (typeof funding_received !== 'number' || funding_received < 0) {
            return res.status(400).json({
                success: false,
                message: 'Funding received must be a positive number'
            });
        }

        const startup = await Startup.findByIdAndUpdate(
            req.params.id,
            { funding_received },
            { new: true, runValidators: true }
        )
        .populate('entrepreneur_id', 'name email')
        .populate('investor_id', 'name email');

        if (!startup) {
            return res.status(404).json({
                success: false,
                message: 'Startup not found'
            });
        }

        res.json({
            success: true,
            message: 'Funding updated successfully',
            data: startup
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating funding',
            error: error.message
        });
    }
});

// PATCH /api/startups/:id/investor - Assign investor to startup
// Body: { "investor_id": "507f1f77bcf86cd799439011" } to assign
// Body: { "investor_id": null } to remove investor
router.patch('/:id/investor', validateId, handleValidationErrors, async (req, res) => {
    try {
        const { investor_id } = req.body;
        
        if (investor_id && !investor_id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid investor ID format'
            });
        }

        const startup = await Startup.findByIdAndUpdate(
            req.params.id,
            { investor_id: investor_id || null },
            { new: true, runValidators: true }
        )
        .populate('entrepreneur_id', 'name email')
        .populate('investor_id', 'name email');

        if (!startup) {
            return res.status(404).json({
                success: false,
                message: 'Startup not found'
            });
        }

        res.json({
            success: true,
            message: investor_id ? 'Investor assigned successfully' : 'Investor removed successfully',
            data: startup
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating investor',
            error: error.message
        });
    }
});

// DELETE /api/startups/:id - Delete startup
// Permanently removes startup from database
// Example: DELETE /api/startups/507f1f77bcf86cd799439011
router.delete('/:id', validateId, handleValidationErrors, async (req, res) => {
    try {
        const startup = await Startup.findByIdAndDelete(req.params.id);

        if (!startup) {
            return res.status(404).json({
                success: false,
                message: 'Startup not found'
            });
        }

        res.json({
            success: true,
            message: 'Startup deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting startup',
            error: error.message
        });
    }
});

// ============================================================================
// ANALYTICS & STATISTICS ROUTES
// ============================================================================

// GET /api/startups/stats/overview - Get startups overview stats
// Returns aggregated data: total startups, funding stats, breakdown by stage and industry
// Useful for dashboard analytics and reporting
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await Startup.aggregate([
            {
                $group: {
                    _id: null,
                    total_startups: { $sum: 1 },
                    total_funding_required: { $sum: '$funding_required' },
                    total_funding_received: { $sum: '$funding_received' },
                    avg_funding_required: { $avg: '$funding_required' },
                    avg_funding_received: { $avg: '$funding_received' }
                }
            }
        ]);

        const stageStats = await Startup.aggregate([
            {
                $group: {
                    _id: '$current_stage',
                    count: { $sum: 1 }
                }
            }
        ]);

        const industryStats = await Startup.aggregate([
            {
                $group: {
                    _id: '$industry',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            data: {
                overview: stats[0] || {},
                by_stage: stageStats,
                by_industry: industryStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching startup stats',
            error: error.message
        });
    }
});

// ============================================================================
// EXPORT ROUTER
// ============================================================================
// Export the router to be used in main application
module.exports = router;

// ============================================================================
// INTEGRATION INSTRUCTIONS:
// ============================================================================
// 1. Place this file in: /routes/startupRoutes.js
// 2. In your main app.js or server.js file, add:
//    const startupRoutes = require('./routes/startupRoutes');
//    app.use('/api/startups', startupRoutes);
// 3. Make sure your Startup model is at: /models/Startup.js
// 4. Install required packages: npm install express express-validator
// 5. Ensure MongoDB connection is established before using routes
// 
// URL Examples after integration:
// - GET http://localhost:3000/api/startups
// - POST http://localhost:3000/api/startups
// - GET http://localhost:3000/api/startups/507f1f77bcf86cd799439011
// - PATCH http://localhost:3000/api/startups/507f1f77bcf86cd799439011/stage
// - GET http://localhost:3000/api/startups/stats/overview
// ============================================================================