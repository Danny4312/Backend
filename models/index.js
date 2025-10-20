// Export all models from a single file for easy imports
module.exports = {
  User: require('./User'),
  ServiceProvider: require('./ServiceProvider'),
  Service: require('./Service'),
  Booking: require('./Booking'),
  Review: require('./Review'),
  Payment: require('./Payment'),
  Notification: require('./Notification'),
  TravelerStory: require('./TravelerStory'),
  StoryLike: require('./StoryLike'),
  StoryComment: require('./StoryComment'),
  ServicePromotion: require('./ServicePromotion')
};
