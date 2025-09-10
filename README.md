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
├── k8s/             # Kubernetes manifests
├── docs/            # Documentation
├── compose.yml      # Docker Compose configuration
├── Dockerfile       # Multi-stage Docker build
└── Makefile         # Development and deployment commands
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

#### Additional for Azure Kubernetes Service (AKS)
- **Azure CLI** (`az`) - for AKS deployment
- **kubectl** CLI tool
- **Azure subscription** with contributor access

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
- Database/Redis in Docker (started automatically)

#### Option B: Docker Compose (Production-like)
```bash
# Full Docker environment
make start
```
- Application: http://localhost
- All services containerized

#### Option C: Kubernetes (Production)
```bash
# Complete Kubernetes deployment
make kubernetes
```
- Uses Minikube for local Kubernetes
- Production-ready configuration

#### Option D: Azure Kubernetes Service (Cloud Production)
```bash
# Setup AKS infrastructure (one-time)
make aks-setup

# Deploy application to AKS
make aks-deploy
```
- Production Azure cloud deployment
- Auto-scaling and load balancing

## 🔧 Available Commands

### Quick Start Commands
```bash
make help            # Show all available commands
make start           # Start all services (Docker Compose)
make local           # Local development (fastest - uses Bun dev servers)
make kubernetes      # Complete Kubernetes deployment
```

### Development Commands
```bash
make local           # Start local development (client + server with hot reload)
make local-stop      # Stop local development services
make dev             # Start development environment
make health          # Test application health
```

### Docker Compose Commands
```bash
make start           # Start all services and show application URLs
make stop            # Stop all services
make restart         # Restart all services
make status          # Show service status and URLs
make logs            # Show logs from all services
make build           # Build all Docker images
make clean           # Stop services and remove containers, networks, and volumes
make docker          # Alias for 'make start'
make docker-stop     # Alias for 'make stop'
```

### Kubernetes Commands
```bash
# Complete workflow
make kubernetes      # Complete Kubernetes setup and deployment
make kubernetes-stop # Stop and clean up Kubernetes

# Individual steps
make k8s-setup       # Create Kubernetes secrets from .env file
make k8s-build       # Build and load images for Kubernetes
make k8s-deploy      # Deploy to Kubernetes
make k8s-status      # Show deployment status and URLs
make k8s-logs        # Show Kubernetes logs
make k8s-cleanup     # Clean up Kubernetes resources
make k8s-stop        # Stop Minikube

# Scaling operations
make k8s-scale-status    # Show horizontal scaling status
make k8s-scale-enable    # Enable horizontal scaling
make k8s-scale-disable   # Disable horizontal scaling (set to 1 replica)
```

### Azure Kubernetes Service (AKS) Commands
```bash
# Infrastructure setup (one-time)
make aks-setup       # Setup AKS cluster and ACR (infrastructure)

# Application deployment (repeatable)
make aks-deploy      # Deploy application to AKS

# Monitoring and management
make aks-status      # Check AKS deployment status
make aks-logs        # Show AKS application logs
make aks-cleanup     # Clean up AKS resources
```

### Package.json Scripts
```bash
bun run dev          # Start development servers (same as 'make local')
bun run start        # Start development servers  
bun run build        # Build all packages
bun run test         # Run tests
bun run lint         # Run Biome linting
bun run check        # Run Biome format check and fix
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

## 📊 AI Observability with Langfuse

This application includes integrated support for [Langfuse](https://langfuse.com/), an open-source LLM engineering platform that provides:

- **Application traces** - Track AI requests end-to-end
- **Usage patterns** - Monitor model usage and costs
- **Cost tracking** - By user and model
- **Performance monitoring** - Response times and token usage
- **Session replay** - Debug issues in AI conversations
- **Evaluations** - Assess AI response quality

### Features Tracked
- All AI streaming chat requests
- Model performance metrics
- User conversation patterns
- Token consumption per user/session
- Request/response times
- Error tracking and debugging

### Setup Langfuse Observability

1. **Get Langfuse Credentials**:
   - Sign up at [Langfuse Cloud](https://cloud.langfuse.com) (recommended)
   - Or [self-host Langfuse](https://langfuse.com/docs/deployment/self-host)
   - Create a new project and get your API keys

2. **Configure Environment Variables**:
   ```env
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_URL=https://cloud.langfuse.com
   ```

3. **Restart the Server**:
   ```bash
   make restart
   # or for local development
   make local-stop && make local
   ```

4. **View Traces**: Visit your Langfuse dashboard to see:
   - Real-time AI request traces
   - User conversation sessions
   - Model performance metrics
   - Cost breakdowns

### Self-hosted Langfuse
If using the included Langfuse service in Docker Compose:
- Langfuse UI: http://langfuse.localhost
- Set `LANGFUSE_URL=http://langfuse-server:3000` in your `.env`
- Use the pre-configured credentials from your Docker Compose environment

> **Note**: Langfuse integration is optional. If credentials are not provided, the application will run normally without tracing.

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

### Optional Observability (Langfuse)
For AI observability and tracing with Langfuse:
```env
# Langfuse Observability (Optional)
LANGFUSE_SECRET_KEY=sk-lf-...                    # Get from Langfuse dashboard
LANGFUSE_PUBLIC_KEY=pk-lf-...                    # Get from Langfuse dashboard
LANGFUSE_URL=https://cloud.langfuse.com      # EU region (default)
# LANGFUSE_URL=https://us.cloud.langfuse.com # For US region
# LANGFUSE_URL=http://localhost:3000         # For self-hosted
```

Get your Langfuse API keys by:
1. Signing up at [Langfuse Cloud](https://cloud.langfuse.com) or [self-hosting](https://langfuse.com/docs/deployment/self-host)
2. Creating a new project in the Langfuse dashboard
3. Copying the `secretKey` and `publicKey` from project settings

### Azure AKS Deployment Variables
For AKS deployment, you also need these environment variables or GitHub secrets:
```env
# Azure Authentication (for AKS deployment)
AZURE_CLIENT_ID=your-azure-client-id
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_SUBSCRIPTION_ID=your-azure-subscription-id

# Azure Resources
AZURE_CONTAINER_REGISTRY=your-acr-name.azurecr.io
RESOURCE_GROUP=ai-chat-rg
CLUSTER_NAME=ai-chat-aks
KEY_VAULT_NAME=your-key-vault-name
```

## 🏗️ Architecture

### System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Client[React 19 Client<br/>TanStack Router<br/>AI Elements UI]
        PWA[Progressive Web App<br/>Service Worker]
    end
    
    subgraph "Load Balancer & Proxy"
        Traefik[Traefik Proxy<br/>SSL Termination<br/>Rate Limiting]
    end
    
    subgraph "Application Layer"
        Server[Hono API Server<br/>Bun Runtime<br/>JWT Authentication]
        Static[Nginx<br/>Static Assets]
    end
    
    subgraph "Data Layer"
        Postgres[(PostgreSQL<br/>User Data<br/>Chat History)]
        Redis[(Redis<br/>Sessions<br/>Cache)]
    end
    
    subgraph "External Services"
        Azure[Azure AI Foundry<br/>GPT Models<br/>Streaming]
        Search[Serper API<br/>Web Search]
    end
    
    subgraph "Infrastructure"
        Docker[Docker Containers<br/>Multi-stage Builds]
        K8s[Kubernetes<br/>Auto-scaling<br/>Health Checks]
    end
    
    Client --> Traefik
    PWA --> Traefik
    Traefik --> Server
    Traefik --> Static
    Server --> Postgres
    Server --> Redis
    Server --> Azure
    Server --> Search
    
    Docker -.-> Server
    Docker -.-> Static
    K8s -.-> Docker
    
    classDef frontend fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef data fill:#e8f5e8
    classDef external fill:#fff3e0
    classDef infra fill:#fce4ec
    
    class Client,PWA frontend
    class Traefik,Server,Static backend
    class Postgres,Redis data
    class Azure,Search external
    class Docker,K8s infra
```

### Data Flow Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant C as React Client
    participant T as Traefik
    participant S as Hono Server
    participant R as Redis
    participant DB as PostgreSQL
    participant AI as Azure AI
    
    U->>C: Type message
    C->>T: POST /api/ai/text-stream
    T->>S: Forward request
    S->>R: Check auth session
    R-->>S: Session valid
    S->>DB: Save user message
    S->>AI: Stream AI request
    AI-->>S: Stream response chunks
    S-->>C: Server-sent events
    C-->>U: Display streaming response
    S->>DB: Save AI response
```

### Component Architecture

```mermaid
graph TD
    subgraph "Frontend Components"
        App[App Router]
        Auth[Auth Provider]
        Chat[Chat Interface]
        AI[AI Elements]
        UI[UI Components]
        
        App --> Auth
        App --> Chat
        Chat --> AI
        Chat --> UI
    end
    
    subgraph "Backend Services"
        API[API Routes]
        Middleware[Auth Middleware]
        Services[AI Services]
        ORM[Drizzle ORM]
        
        API --> Middleware
        API --> Services
        Services --> ORM
    end
    
    subgraph "Shared Layer"
        Types[TypeScript Types]
        Schemas[Zod Schemas]
        Utils[Utilities]
        
        Types --> Schemas
        Schemas --> Utils
    end
    
    Frontend --> Shared
    Backend --> Shared
```

### Deployment Architecture

```mermaid
graph LR
    subgraph "Development"
        Dev[Local Dev<br/>bun dev<br/>Hot Reload]
    end
    
    subgraph "Docker Compose"
        DC[Production Build<br/>Multi-container<br/>Traefik + Apps]
    end
    
    subgraph "Kubernetes"
        K8s[K8s Cluster<br/>Auto-scaling<br/>Load Balancing<br/>Health Checks]
    end
    
    subgraph "Monitoring"
        Logs[Structured Logging<br/>Pino Logger]
        Health[Health Checks<br/>Readiness Probes]
        Metrics[Application Metrics<br/>Performance Monitoring]
    end
    
    Dev --> DC
    DC --> K8s
    K8s --> Monitoring
```

### Frontend Architecture
- **Component-based**: Modular React components with AI Elements
- **Type-safe routing**: TanStack Router with file-based routing
- **State management**: React Query for server state management
- **Authentication**: Context-based auth with automatic token refresh
- **UI Components**: AI Elements + shadcn/ui components
- **Real-time**: Server-sent events for AI streaming

### Backend Architecture
- **API-first**: RESTful API with OpenAPI documentation
- **Middleware stack**: Authentication, caching, logging, CORS
- **Database layer**: Drizzle ORM with PostgreSQL
- **Caching**: Redis for sessions and API responses
- **AI Integration**: Azure AI Foundry with streaming support
- **Performance**: Bun runtime for fast execution

> 📖 **For detailed architecture documentation, diagrams, and deployment strategies, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md)**

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
