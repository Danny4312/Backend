const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { User } = require('../models');

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({
      $or: [
        { google_id: profile.id },
        { email: profile.emails[0].value.toLowerCase() }
      ]
    });

    if (user) {
      // User exists, update Google ID if not set
      if (!user.google_id) {
        user.google_id = profile.id;
        await user.save();
      }
      return done(null, user);
    }

    // Create new user - but we need user_type, so redirect to registration
    const userData = {
      googleId: profile.id,
      email: profile.emails[0].value,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      avatarUrl: profile.photos[0]?.value,
      needsRegistration: true
    };

    return done(null, userData);
  } catch (error) {
    console.error('❌ Google OAuth Error:', error);
    return done(error, null);
  }
}));

// JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await User.findById(payload.id).lean();
    if (user) {
      // Convert MongoDB _id to id for consistency
      user.id = user._id.toString();
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    console.error('❌ JWT Strategy Error:', error);
    return done(error, false);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id || user.id || user.googleId);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    let user = await User.findById(id).lean();
    if (!user) {
      user = await User.findOne({ google_id: id }).lean();
    }
    if (user) {
      user.id = user._id.toString();
      done(null, user);
    } else {
      done(null, false);
    }
  } catch (error) {
    console.error('❌ Deserialize Error:', error);
    done(error, null);
  }
});

module.exports = passport;
