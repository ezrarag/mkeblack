#!/bin/bash
# MKE Black — Full Setup & Deploy Script
# Run this from the mkeblack project directory:
#   cd "/Users/ehauga/Desktop/local dev/mkeblack"
#   bash scripts/setup-and-deploy.sh

set -e
PROJ="mkeblack-c6dfe"
DIR="/Users/ehauga/Desktop/local dev/mkeblack"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  MKE Black — Firebase Setup & Deploy"
echo "═══════════════════════════════════════════════════"
echo ""

cd "$DIR"

# 1. Install firebase-admin for seed scripts
echo "📦 Installing firebase-admin..."
npm install --save-dev firebase-admin 2>/dev/null | tail -3

# 2. Login check
echo ""
echo "🔐 Checking Firebase login..."
firebase login --no-localhost 2>/dev/null || true

# 3. Set active project
echo ""
echo "🎯 Setting Firebase project: $PROJ"
firebase use $PROJ

# 4. Deploy Firestore rules
echo ""
echo "📋 Deploying Firestore rules..."
firebase deploy --only firestore:rules --project $PROJ

# 5. Deploy Firestore indexes
echo ""
echo "📇 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes --project $PROJ

# 6. Deploy Storage rules
echo ""
echo "🗂  Deploying Storage rules..."
firebase deploy --only storage --project $PROJ

# 7. Seed Firestore
echo ""
echo "🌱 Seeding Firestore data..."
node scripts/seed-firestore.js

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ All done!"
echo ""
echo "  Next steps:"
echo "  1. Start the dev server:  npm run dev"
echo "  2. Go to http://localhost:3000 and sign up"
echo "  3. Copy your UID from Firebase Console →"
echo "     Authentication → Users"
echo "  4. Run:  node scripts/set-admin.js <your-uid>"
echo "  5. Sign out + back in → you'll have admin access"
echo "═══════════════════════════════════════════════════"
echo ""
