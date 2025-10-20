const { body, validationResult } = require('express-validator');

// Common validation rules
const validationRules = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  password: body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
    
  firstName: body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
    
  lastName: body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
    
  phone: body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 0 })
    .withMessage('Please provide a valid phone number'),
    
  userType: body('userType')
    .isIn(['traveler', 'service_provider'])
    .withMessage('User type must be either traveler or service_provider'),
    
  serviceTitle: body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Service title is required and must be less than 255 characters'),
    
  serviceDescription: body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Service description must be at least 10 characters long'),
    
  serviceCategory: body('category')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Service category is required'),
    
  servicePrice: body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
    
  serviceDuration: body('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer (hours)'),
    
  maxParticipants: body('maxParticipants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum participants must be a positive integer'),
    
  serviceLocation: body('location')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Service location is required'),
    
  bookingDate: body('bookingDate')
    .isISO8601()
    .withMessage('Please provide a valid booking date'),
    
  participants: body('participants')
    .isInt({ min: 1 })
    .withMessage('Number of participants must be at least 1'),
    
  rating: body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
    
  bookingStatus: body('status')
    .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
    .withMessage('Invalid booking status'),
    
  paymentStatus: body('paymentStatus')
    .isIn(['pending', 'paid', 'refunded'])
    .withMessage('Invalid payment status')
};

// Validation rule sets for different endpoints
const validationSets = {
  register: [
    validationRules.email,
    validationRules.password,
    validationRules.firstName,
    validationRules.lastName,
    validationRules.phone,
    validationRules.userType
  ],
  
  login: [
    validationRules.email,
    validationRules.password
  ],
  
  updateProfile: [
    body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
    body('phone').optional().isMobilePhone()
  ],
  
  createService: [
    validationRules.serviceTitle,
    validationRules.serviceDescription,
    validationRules.serviceCategory,
    validationRules.servicePrice,
    validationRules.serviceDuration,
    validationRules.maxParticipants,
    validationRules.serviceLocation
  ],
  
  updateService: [
    body('title').optional().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim().isLength({ min: 10 }),
    body('category').optional().trim().isLength({ min: 1 }),
    body('price').optional().isFloat({ min: 0 }),
    body('duration').optional().isInt({ min: 1 }),
    body('maxParticipants').optional().isInt({ min: 1 }),
    body('location').optional().trim().isLength({ min: 1 })
  ],
  
  createBooking: [
    body('serviceId').isInt({ min: 1 }),
    validationRules.bookingDate,
    validationRules.participants,
    body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('specialRequests').optional().trim().isLength({ max: 1000 })
  ],
  
  updateBookingStatus: [
    validationRules.bookingStatus
  ],
  
  updatePaymentStatus: [
    validationRules.paymentStatus
  ],
  
  addReview: [
    validationRules.rating,
    body('comment').optional().trim().isLength({ max: 1000 })
  ],
  
  completeGoogleRegistration: [
    validationRules.userType,
    validationRules.phone
  ]
};

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Helper function to get validation middleware for a specific set
const getValidationMiddleware = (setName) => {
  const rules = validationSets[setName];
  if (!rules) {
    throw new Error(`Validation set '${setName}' not found`);
  }
  return [...rules, handleValidationErrors];
};

module.exports = {
  validationRules,
  validationSets,
  handleValidationErrors,
  getValidationMiddleware
};
