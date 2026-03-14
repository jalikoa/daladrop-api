#!/bin/bash

# 🚀 NFC Payment System - DDD Architecture Generator
# This script creates the production-grade folder structure based on the Knowledge Base.

echo "🏗️  Starting NestJS DDD Architecture Setup..."

# 1. Ensure src directory exists
if [ ! -d "src" ]; then
    echo "❌ Error: 'src' directory not found. Please run 'nest new project-name' first."
    exit 1
fi

# 2. Create Core Infrastructure Folders
echo "📂 Creating Core Infrastructure..."
mkdir -p src/common/{decorators,filters,guards,interceptors,pipes,security,value-objects}
mkdir -p src/config
mkdir -p src/database/{migrations,seeds}
mkdir -p src/infrastructure/{adapters,providers}
mkdir -p src/interfaces
mkdir -p src/utils

# 3. Define Modules (Bounded Contexts)
# Based on the 14 modules identified in the architecture plan
MODULES=(
    "auth"
    "users"
    "merchants"
    "nfc"
    "payments"
    "ledger"
    "notifications"
    "qr"
    "pdf"
    "webhooks"
    "queues"
    "audit"
    "health"
    "config"
)

# 4. Function to Create Standard DDD Module Structure
create_module() {
    local module_name=$1
    local module_path="src/modules/$module_name"
    
    echo "   📦 Generating module: $module_name"
    
    # Create Directory Structure
    mkdir -p $module_path/{dto,enums,entities,events,listeners,interfaces,repositories,use-cases,guards,mappers,constants,queues,processors,__tests__}
    
    # Create Core Files (Placeholders)
    touch $module_path/$module_name.module.ts
    touch $module_path/$module_name.controller.ts
    touch $module_path/$module_name.service.ts
    
    # Create Specific DDD Files (Placeholders)
    touch $module_path/interfaces/$module_name.repository.interface.ts
    touch $module_path/use-cases/index.ts
    touch $module_path/entities/index.ts
    touch $module_path/dto/index.ts
    touch $module_path/events/index.ts
}

# 5. Generate All Modules
echo "📂 Creating Bounded Context Modules..."
for module in "${MODULES[@]}"; do
    create_module $module
done

# 6. Special Adjustments for Specific Modules
# (Adding specific files that differ slightly per domain)

# Auth Module Extras
touch src/modules/auth/strategies/jwt.strategy.ts
touch src/modules/auth/guards/jwt-auth.guard.ts
touch src/modules/auth/guards/roles.guard.ts

# Queues Module Extras
touch src/modules/queues/queues.module.ts
touch src/modules/queues/processors/payment.processor.ts
touch src/modules/queues/processors/notification.processor.ts

# Ledger Module Extras
touch src/modules/ledger/services/ledger.service.ts
touch src/modules/ledger/entities/ledger-account.entity.ts
touch src/modules/ledger/entities/ledger-entry.entity.ts

# Database Extras
touch src/database/database.module.ts
touch src/database/typeorm.config.ts

# Common Extras
touch src/common/security/encryption.service.ts
touch src/common/filters/http-exception.filter.ts
touch src/common/decorators/public.decorator.ts
touch src/common/decorators/user.decorator.ts

# 7. Create Root Config Files
echo "⚙️  Creating Root Configuration..."
touch .env
touch .env.example
touch nest-cli.json

# 8. Populate .env.example
cat > .env.example <<EOF
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_NAME=nfc_payment_db

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=super_secret_jwt_key_change_this
JWT_EXPIRATION=1d
NFC_SECRET_KEY=32_character_secret_key_change_this

# Services
DARAJA_CONSUMER_KEY=your_key
DARAJA_CONSUMER_SECRET=your_secret
DARAJA_PASSKEY=your_passkey
AFRICAS_TALKING_USERNAME=your_username
AFRICAS_TALKING_API_KEY=your_key
FIREBASE_PROJECT_ID=your_id
EOF

# 9. Update .gitignore (Append)
echo "🔒 Updating .gitignore..."
cat >> .gitignore <<EOF

# Environment
.env
.env.local
.env.production

# Logs
logs
*.log
npm-debug.log*

# Coverage
coverage

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Builds
dist
EOF

echo ""
echo "✅ Architecture Setup Complete!"
echo ""
echo "📁 Structure Overview:"
echo "   src/"
echo "   ├── common/          (Shared Kernel)"
echo "   ├── config/          (Env Config)"
echo "   ├── database/        (TypeORM)"
echo "   ├── infrastructure/  (External Adapters)"
echo "   ├── interfaces/      (Shared Interfaces)"
echo "   └── modules/         (Bounded Contexts)"
echo "       ├── auth/"
echo "       ├── users/"
echo "       ├── merchants/"
echo "       ├── payments/"
echo "       ├── ledger/      (Source of Truth)"
echo "       ├── queues/      (BullMQ Workers)"
echo "       └── ..."
echo ""
echo "👉 Next Steps:"
echo "   1. Install dependencies: $(echo 'yarn install')"
echo "   2. Setup Docker: $(echo 'docker-compose up -d')"
echo "   3. Start Dev Server: $(echo 'yarn run start:dev')"
echo ""
