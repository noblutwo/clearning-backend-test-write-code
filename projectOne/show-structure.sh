#!/bin/bash

# 📋 Project Structure Visualization
# Run: bash show-structure.sh

echo "╔═════════════════════════════════════════════════════════════════╗"
echo "║  🚀 Elysia Backend - Bun + PostgreSQL + TypeORM               ║"
echo "║     Professional Architecture for Enterprise Applications     ║"
echo "╚═════════════════════════════════════════════════════════════════╝"
echo ""

echo "📂 PROJECT STRUCTURE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

tree -L 3 -I 'node_modules|dist' --dirsfirst <<'EOF' 2>/dev/null || find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type d -o -type f | head -50

projectOne/
├── 📄 Configuration & Setup
│   ├── package.json                # 📦 Dependencies & npm scripts
│   ├── tsconfig.json              # 🔷 TypeScript configuration
│   ├── biome.json                 # 🎨 Code linting & formatting
│   ├── bunfig.toml                # ⚡ Bun configuration
│   └── docker-compose.yml         # 🐳 PostgreSQL container setup
│
├── 🐳 Containerization
│   ├── Dockerfile                 # 📦 Production image
│   └── .dockerignore              # 🚫 Docker ignore rules
│
├── 🌍 Environment & Git
│   ├── .env                       # 🔐 Development variables
│   ├── .env.production           # 🔐 Production variables
│   ├── .env.example              # 📋 Template
│   └── .gitignore                # 🚫 Git ignore rules
│
├── 📚 Documentation
│   ├── README.md                 # 📖 English documentation
│   ├── GUIDE.md                  # 📖 Vietnamese guide
│   ├── SETUP.md                  # 📖 Setup summary
│   ├── SUMMARY.md                # 📖 Project summary
│   └── show-structure.sh         # 📋 This file
│
└── 💻 src/ (Source Code)
    │
    ├── index.ts                   # 🎯 Application entry point
    │
    ├── 🔧 config/
    │   ├── env.ts                # ⚙️ Environment variables loader
    │   └── constants.ts          # 📌 Application constants
    │
    ├── 🗄️ database/
    │   ├── connection.ts         # 🔌 TypeORM database connection
    │   ├── entities/
    │   │   └── user.entity.ts    # 👤 User entity (model)
    │   └── migrations/
    │       └── 1702400000000-CreateUserTable.ts  # 📝 Schema migration
    │
    ├── 🎮 controllers/
    │   └── health.controller.ts  # 🎯 User request handlers
    │
    ├── 🏢 services/
    │   └── user.service.ts       # 💼 Business logic
    │
    ├── 📊 repositories/
    │   └── user.repository.ts    # 💾 Data access layer
    │
    ├── 📤 dtos/
    │   └── user.dto.ts           # 📨 Data transfer objects
    │
    ├── 🛣️ routes/
    │   ├── index.ts              # 🗺️ Route aggregator
    │   └── v1/
    │       ├── health.routes.ts  # ❤️ Health check endpoint
    │       └── users.routes.ts   # 👥 User API endpoints
    │
    ├── 🛡️ middleware/
    │   ├── cors.middleware.ts    # 🌐 CORS handling
    │   ├── error.middleware.ts   # ⚠️ Error handling
    │   └── logger.middleware.ts  # 📝 Request logging
    │
    ├── 🔧 utils/
    │   ├── helpers.ts            # 🛠️ Utility functions
    │   └── logger.ts             # 📝 Logging system
    │
    ├── 🏷️ types/
    │   ├── api.types.ts          # 📋 API type definitions
    │   └── response.types.ts     # 📋 Response type definitions
    │
    └── 📋 models/
        └── user.model.ts         # 📊 User data model

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📊 STATISTICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd '/home/fcs/Bản tải về/code-backend-test/projectOne' 2>/dev/null || cd '.'

# Count files
ts_files=$(find src -name "*.ts" 2>/dev/null | wc -l)
config_files=$(find . -maxdepth 1 -name "*.json" -o -name "*.toml" -o -name "*.yml" 2>/dev/null | wc -l)
doc_files=$(find . -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)

echo "  TypeScript Files:    $ts_files files"
echo "  Configuration:       $config_files files"
echo "  Documentation:       $doc_files files"
echo ""

echo "🏗️  ARCHITECTURE LAYERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<'EOF'
┌─────────────────────────────────────────┐
│  HTTP Requests (Routes)                 │
├─────────────────────────────────────────┤
│  Controllers (HTTP Logic & Validation)  │
├─────────────────────────────────────────┤
│  Services (Business Logic)              │
├─────────────────────────────────────────┤
│  Repositories (Data Access)             │
├─────────────────────────────────────────┤
│  Entities (Database Models)             │
├─────────────────────────────────────────┤
│  Database (PostgreSQL)                  │
└─────────────────────────────────────────┘

Middleware (CORS, Logging, Error Handling)
    ↓ Applied to all requests
EOF

echo ""
echo "🚀 QUICK COMMANDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<'EOF'
Development:
  $ bun install              # Install dependencies
  $ docker-compose up -d     # Start PostgreSQL
  $ bun run dev              # Run dev server (http://localhost:3000)

Build & Deploy:
  $ bun run build            # Build for production
  $ bun run start            # Start production server

Code Quality:
  $ bun run lint             # Lint code
  $ bun run format           # Format code
  $ bun run type-check       # Type checking

Database:
  $ bun typeorm migration:run -d src/database/connection.ts

Testing:
  $ bun test
EOF

echo ""
echo "📚 DOCUMENTATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📖 README.md       - English documentation"
echo "  📖 GUIDE.md        - Vietnamese guide (推奨)"
echo "  📖 SETUP.md        - Setup summary"
echo "  📖 SUMMARY.md      - Project overview"
echo ""

echo "🔌 API ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<'EOF'
Health:
  GET  /health

Users:
  GET    /api/v1/users
  POST   /api/v1/users
  GET    /api/v1/users/:id
  PUT    /api/v1/users/:id
  DELETE /api/v1/users/:id
EOF

echo ""
echo "✨ FEATURES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<'EOF'
✅ Bun Runtime          ⚡ Ultra-fast JavaScript
✅ Elysia Framework     🎯 Modern web framework
✅ PostgreSQL           🐘 Robust database
✅ TypeORM             🗄️ Powerful ORM
✅ TypeScript          🔷 Full type safety
✅ Modular Architecture 🏗️ Scalable & maintainable
✅ Soft Delete         🗑️ Data preservation
✅ Migrations          📝 Schema versioning
✅ Docker Support      🐳 Easy deployment
✅ Error Handling      🛡️ Centralized errors
✅ Logging System      📝 Structured logging
✅ CORS Support        🌐 Cross-origin ready
EOF

echo ""
echo "╔═════════════════════════════════════════════════════════════════╗"
echo "║  🎉 Ready to develop! Start with: bun run dev                  ║"
echo "║  📖 Read GUIDE.md for detailed documentation                   ║"
echo "╚═════════════════════════════════════════════════════════════════╝"
echo ""
