#!/bin/bash

echo "🔄 MIGRATING iSafari Global from PostgreSQL to MongoDB"
echo "======================================================"
echo ""

# Create backup directory
BACKUP_DIR="postgres-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Step 1: Backing up PostgreSQL files..."
echo ""

# Backup all route files
cp routes/bookings.js "$BACKUP_DIR/bookings.postgres.js" 2>/dev/null && echo "  ✅ Backed up bookings.js"
cp routes/users.js "$BACKUP_DIR/users.postgres.js" 2>/dev/null && echo "  ✅ Backed up users.js"
cp routes/providers.js "$BACKUP_DIR/providers.postgres.js" 2>/dev/null && echo "  ✅ Backed up providers.js"
cp routes/payments.js "$BACKUP_DIR/payments.postgres.js" 2>/dev/null && echo "  ✅ Backed up payments.js"
cp routes/notifications.js "$BACKUP_DIR/notifications.postgres.js" 2>/dev/null && echo "  ✅ Backed up notifications.js"
cp routes/travelerStories.js "$BACKUP_DIR/travelerStories.postgres.js" 2>/dev/null && echo "  ✅ Backed up travelerStories.js"

# Backup config files
cp config/database.js "$BACKUP_DIR/database.postgres.js" 2>/dev/null && echo "  ✅ Backed up database.js"
cp config/passport.js "$BACKUP_DIR/passport.postgres.js" 2>/dev/null && echo "  ✅ Backed up passport.js"

# Backup middleware
cp middleware/validation.js "$BACKUP_DIR/validation.postgres.js" 2>/dev/null && echo "  ✅ Backed up validation.js"

echo ""
echo "✅ Backup completed in: $BACKUP_DIR"
echo ""
echo "📝 Step 2: Migration will create new MongoDB versions"
echo "   All PostgreSQL files are safely backed up"
echo ""
echo "⚠️  IMPORTANT: After migration, test thoroughly before deleting backups"
echo ""
echo "Ready to proceed? The script will now exit."
echo "Run the migration commands manually to ensure safety."
