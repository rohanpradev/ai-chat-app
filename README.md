# ChatFlow - Modern AI Chat Application

A full-stack AI-powered chat application built with modern technologies for optimal performance and developer experience.

## 🚀 Features

- **Real-time AI Chat**: Powered by Azure AI Foundry with streaming responses
- **Modern UI**: Built with AI Elements for beautiful chat interfaces
- **Authentication**: Secure cookie-based JWT authentication
- **Model Selection**: Choose between different AI models (GPT-5-mini, GPT-3.5)
- **Web Search**: Optional web search integration for enhanced responses
- **Auto-scroll**: Smooth conversation scrolling with scroll-to-bottom button
- **Suggestions**: Smart conversation starters
- **Profile Management**: User profiles with avatar support
- **Type Safety**: End-to-end TypeScript with shared schemas
- **Performance**: Redis caching and optimized database queries

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern React with latest features
- **TanStack Router** - Type-safe routing
- **AI Elements** - Pre-built AI chat components
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool
- **TypeScript** - Type safety

### Backend
- **Hono** - Fast web framework
- **Bun** - High-performance JavaScript runtime
- **PostgreSQL** - Reliable database
- **Drizzle ORM** - Type-safe database operations
- **Redis** - Caching and session storage
- **Azure AI Foundry** - AI model integration
- **TypeScript** - Full type safety

### Infrastructure
- **Docker** - Containerization
- **Traefik** - Reverse proxy and load balancer
- **Nginx** - Static file serving

## 📦 Project Structure

```
├── client/          # React frontend application
├── server/          # Hono backend API
├── shared/          # Shared types and schemas
├── compose.yml      # Docker Compose configuration
├── Dockerfile       # Multi-stage Docker build
└── Makefile         # Development commands
```

## 🚀 Quick Start

### Prerequisites
- **Bun** >= 1.0
- **Docker** & **Docker Compose**
- **Make** (for cross-platform commands)
- **PostgreSQL** (or use Docker)
- **Redis** (or use Docker)

#### Additional for Kubernetes
- **Minikube** or **Kubernetes cluster**
- **kubectl** CLI tool

### 1. Clone the Repository
```bash
git clone https://github.com/rohanpradev/ai-chat-app.git
cd chat-app
```

### 2. Environment Setup
```bash
# Copy environment files
cp .env.example .env
cp client/.env.example client/.env
cp server/.env.example server/.env.local

# Edit .env files with your configuration
```

### 3. Install Dependencies
```bash
# Install all dependencies
bun install
```

### 4. Database Setup
```bash
# Start database services
docker compose up -d db redis

# Run migrations
cd server && bun run db:migrate
```

### 5. Choose Your Development Method

#### Option A: Local Development (Recommended for development)
```bash
# Fast local development with hot reload
make local
```
- Client: http://localhost:5173
- Server: http://localhost:3000
- Database/Redis in Docker

#### Option B: Docker Compose (Production-like)
```bash
# Full Docker environment
make docker
# or
make start
```
- Application: http://localhost

#### Option C: Kubernetes (Production)
```bash
# Complete Kubernetes deployment
make kubernetes
```
- Uses Minikube for local Kubernetes
- Production-ready configuration

## 🔧 Available Commands

### Quick Start Commands
```bash
make help            # Show all available commands
make local           # Local development (fastest)
make docker          # Docker Compose deployment
make kubernetes      # Kubernetes deployment
```

### Development
```bash
bun run dev          # Start development servers
bun run build        # Build all packages
bun run test         # Run tests
```

### Makefile Commands
```bash
# Development
make local           # Start local development (client + server with bun dev)
make dev             # Start development environment

# Docker Deployment
make docker          # Start Docker Compose services
make start           # Start all services
make stop            # Stop all services
make restart         # Restart all services
make status          # Show service status
make logs            # Show logs
make clean           # Clean up containers and volumes
make build           # Build all images
make health          # Test application health

# Kubernetes Deployment
make kubernetes      # Complete Kubernetes setup and deployment
make k8s-setup       # Create Kubernetes secrets from .env file
make k8s-build       # Build and load images for Kubernetes
make k8s-deploy      # Deploy to Kubernetes
make k8s-status      # Show Kubernetes deployment status and URLs
make k8s-logs        # Show Kubernetes logs
make k8s-cleanup     # Clean up Kubernetes resources
make k8s-stop        # Stop Minikube

# Help
make help            # Show all available commands
```

### Database Commands
```bash
cd server
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### AI Chat
- `POST /api/ai/text-stream` - Stream AI responses
- `POST /api/ai/text` - Get AI responses (non-streaming)

### Profile
- `GET /api/profile` - Get user profile

### Health
- `GET /health` - Service health check

## 🔐 Environment Variables

### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/chatapp
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatapp
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key

# AI Configuration
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_RESOURCE_NAME=your-deployment-resource


# AI TOOL KEYS
SERPER_API_KEY=your-api-key

# Application
PORT=3000
CLIENT_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000/api
```

## 🏗️ Architecture

### Frontend Architecture
- **Component-based**: Modular React components
- **Type-safe routing**: TanStack Router with file-based routing
- **State management**: React Query for server state
- **Authentication**: Context-based auth with automatic token refresh
- **UI Components**: AI Elements + shadcn/ui components

### Backend Architecture
- **API-first**: RESTful API with OpenAPI documentation
- **Middleware stack**: Authentication, caching, logging
- **Database layer**: Drizzle ORM with PostgreSQL
- **Caching**: Redis for sessions and API responses
- **AI Integration**: Azure AI Foundry with streaming support

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **HTTP-only Cookies**: Secure token storage
- **CORS Protection**: Configured for production
- **Rate Limiting**: API rate limiting via Traefik
- **Input Validation**: Zod schema validation
- **SQL Injection Protection**: Parameterized queries via Drizzle

## 📊 Performance Optimizations

- **Bun Runtime**: Fast JavaScript execution
- **Redis Caching**: API response and session caching
- **Database Indexing**: Optimized database queries
- **Code Splitting**: Lazy-loaded routes and components
- **Asset Optimization**: Compressed static assets
- **Docker Multi-stage**: Optimized container images

## 🧪 Testing

```bash
# Run all tests
bun test

# Run client tests
cd client && bun test

# Run server tests
cd server && bun test
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

For support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ using modern web technologies**
