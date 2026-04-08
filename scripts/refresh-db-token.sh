#!/bin/bash

# Configuration
RDS_HOSTNAME="naru-website-cluster.cluster-cspumw4c8drx.us-east-1.rds.amazonaws.com"
RDS_PORT=5432
RDS_REGION="us-east-1"
DB_USER="postgres"
DB_NAME="postgres"

echo "🔐 Generating RDS IAM Authentication Token..."

# Generate the token using AWS CLI
# This requires that the user is logged into AWS CLI (aws configure)
TOKEN=$(aws rds generate-db-auth-token \
  --hostname $RDS_HOSTNAME \
  --port $RDS_PORT \
  --region $RDS_REGION \
  --username $DB_USER)

if [ $? -ne 0 ]; then
  echo "❌ Error: Failed to generate AWS RDS token. Are you logged in to AWS CLI?"
  exit 1
fi

# URL-encode the token (tokens contain special characters like '/', '+', '=')
# Using python for a quick cross-platform encoding
ENCODED_TOKEN=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$TOKEN'''))")

# Construct the temporary DATABASE_URL
DATABASE_URL="postgresql://$DB_USER:$ENCODED_TOKEN@$RDS_HOSTNAME:$RDS_PORT/$DB_NAME?sslmode=verify-full"

echo "✅ Token generated successfully (expires in 15 minutes)."

# Update the .env file in packages/backend
ENV_FILE="packages/backend/.env"

if [ -f "$ENV_FILE" ]; then
  # Use sed to replace the DATABASE_URL line
  # We use | as a delimiter because the URL contains /
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" "$ENV_FILE"
  echo "📝 Updated $ENV_FILE with the new temporary token."
else
  echo "⚠️  Warning: $ENV_FILE not found. Creating a new one..."
  echo "DATABASE_URL=$DATABASE_URL" > "$ENV_FILE"
fi

echo ""
echo "🚀 You can now run:"
echo "   pnpm --filter @naru/backend dev"
echo "   or"
echo "   npx prisma migrate status"
