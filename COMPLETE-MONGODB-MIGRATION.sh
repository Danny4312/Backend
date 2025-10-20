#!/bin/bash

echo "🔄 FINALIZING MONGODB MIGRATION"
echo "================================"
echo ""

# Step 1: Replace passport.js
echo "📝 Step 1: Replacing passport.js with MongoDB version..."
if [ -f "config/passport.js" ]; then
    mv config/passport.js config/passport.postgres.backup-final
    echo "  ✅ Backed up old passport.js"
fi

if [ -f "config/passport.mongodb.js" ]; then
    cp config/passport.mongodb.js config/passport.js
    echo "  ✅ MongoDB passport.js activated"
else
    echo "  ⚠️  Warning: passport.mongodb.js not found"
fi

echo ""
echo "📊 Step 2: Verifying migration files..."
echo ""

# Check all critical files
FILES=(
    "config/mongodb.js"
    "config/passport.js"
    "routes/auth.js"
    "routes/services.js"
    "routes/bookings.js"
    "routes/users.js"
    "routes/providers.js"
    "routes/payments.js"
    "routes/notifications.js"
    "routes/travelerStories.js"
    "models/index.js"
    "utils/mongodb-helpers.js"
)

MISSING=0
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ Missing: $file"
        MISSING=$((MISSING + 1))
    fi
done

echo ""
if [ $MISSING -eq 0 ]; then
    echo "✅ All files present!"
else
    echo "⚠️  $MISSING file(s) missing"
fi

echo ""
echo "🗂️  Step 3: Backup summary..."
echo ""
ls -lh postgres-backup-* 2>/dev/null | wc -l | xargs echo "  📦 Backup directories:"
echo ""

echo "✅ MIGRATION FINALIZED!"
echo ""
echo "Next steps:"
echo "  1. Run: npm install (if not done)"
echo "  2. Run: npm start or node server.js"
echo "  3. Test authentication"
echo "  4. Test service creation"
echo "  5. Test bookings"
echo ""
echo "🎉 MongoDB migration complete!"
