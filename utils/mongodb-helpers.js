// MongoDB Helper Functions for converting PostgreSQL patterns

const mongoose = require('mongoose');

/**
 * Convert PostgreSQL LIMIT/OFFSET to MongoDB skip/limit
 */
const getPagination = (page = 1, limit = 10) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return { skip, limit: parseInt(limit) };
};

/**
 * Build MongoDB filter from query parameters
 */
const buildServiceFilter = (query) => {
  const filter = { is_active: true };

  if (query.category) {
    filter.category = query.category;
  }

  if (query.location) {
    filter.location = new RegExp(query.location, 'i');
  }

  if (query.country) {
    filter.country = query.country;
  }

  if (query.region) {
    filter.region = query.region;
  }

  if (query.district) {
    filter.district = query.district;
  }

  if (query.min_price) {
    filter.price = { $gte: parseFloat(query.min_price) };
  }

  if (query.max_price) {
    filter.price = { ...filter.price, $lte: parseFloat(query.max_price) };
  }

  if (query.search) {
    filter.$or = [
      { title: new RegExp(query.search, 'i') },
      { description: new RegExp(query.search, 'i') },
      { category: new RegExp(query.search, 'i') }
    ];
  }

  return filter;
};

/**
 * Build MongoDB sort from query parameters
 */
const buildSort = (sortBy, sortOrder = 'desc') => {
  const sort = {};
  
  switch(sortBy) {
    case 'price':
      sort.price = sortOrder === 'asc' ? 1 : -1;
      break;
    case 'rating':
      sort.average_rating = -1;
      break;
    case 'popular':
      sort.bookings_count = -1;
      break;
    case 'newest':
      sort.created_at = -1;
      break;
    default:
      sort.created_at = -1;
  }

  return sort;
};

/**
 * Convert ObjectId to string for JSON response
 */
const serializeDocument = (doc) => {
  if (!doc) return null;
  
  const obj = doc.toObject ? doc.toObject() : doc;
  
  // Convert _id to id
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }

  // Convert other ObjectId fields
  ['provider_id', 'user_id', 'service_id', 'traveler_id', 'booking_id'].forEach(field => {
    if (obj[field] && obj[field].toString) {
      obj[field] = obj[field].toString();
    }
  });

  // Remove __v
  delete obj.__v;

  return obj;
};

/**
 * Serialize array of documents
 */
const serializeDocuments = (docs) => {
  return docs.map(serializeDocument);
};

/**
 * Check if string is valid MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Convert string to ObjectId
 */
const toObjectId = (id) => {
  if (!isValidObjectId(id)) {
    throw new Error('Invalid ObjectId');
  }
  return new mongoose.Types.ObjectId(id);
};

/**
 * Get total count with filter
 */
const getCount = async (Model, filter = {}) => {
  return await Model.countDocuments(filter);
};

/**
 * Pagination response helper
 */
const paginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data: serializeDocuments(data),
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

module.exports = {
  getPagination,
  buildServiceFilter,
  buildSort,
  serializeDocument,
  serializeDocuments,
  isValidObjectId,
  toObjectId,
  getCount,
  paginationResponse
};
