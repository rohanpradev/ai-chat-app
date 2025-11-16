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
- **Traefik v3.6** - Modern reverse proxy and load balancer with Gateway API support
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
- **Bun** >= 1.2 ([Install here](https://bun.sh))
- **Docker** & **Docker Compose** ([Install here](https://docker.com))
- **Azure AI Account** ([Get free trial](https://azure.microsoft.com/free))

### Setup in 3 Steps

#### 1. Clone and Setup
```bash
git clone https://github.com/rohanpradev/ai-chat-app.git
cd ai-chat-app
make setup
```

#### 2. Configure (Edit `.env` file)
```bash
# Required: Update these 3 values
AZURE_API_KEY=your_azure_api_key_here          # From Azure Portal
AZURE_RESOURCE_NAME=your_azure_resource_name   # e.g., myresource (without .openai.azure.com)
JWT_SECRET=your_secure_jwt_secret              # Run: openssl rand -base64 32
```

#### 3. Start
```bash
make start
```

That's it! 🎉 Open https://localhost in your browser.

### Optional: Enable AI Observability (Langfuse)

After first start:
1. Visit https://langfuse.localhost
2. Create account and project
3. Copy API keys to `.env`:
   ```bash
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   ```
4. Restart: `make restart`

## 🔧 Available Commands

### Quick Start
```bash
make setup           # Initial setup (creates .env)
make validate        # Check configuration
make start           # Start all services
make stop            # Stop all services
make restart         # Restart services
make status          # Show service status
make logs            # View logs
```

### Development
```bash
make local           # Local dev (fastest, with hot reload)
make dev             # Alternative dev command
make build           # Build Docker images
make clean           # Clean up containers and volumes
```
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
make k8s-traefik     # Install Traefik v3.6 using Helm
make k8s-build       # Build and load images for Kubernetes
make k8s-deploy      # Deploy to Kubernetes with Gateway API
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
