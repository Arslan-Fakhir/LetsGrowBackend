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