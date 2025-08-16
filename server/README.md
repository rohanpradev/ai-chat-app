# Hono Chat Application

Welcome to the **Hono Chat Application**! This is a full-stack chat application built using **Bun.js** as the runtime, **Drizzle ORM** for ## Project Structure

Here's an overview of the monorepo structure:

```
/Hono
  ├── /client               # React frontend application
  │   ├── /src             
  │   │   ├── /components   # Reusable UI components
  │   │   ├── /routes       # Application pages/routes
  │   │   ├── /lib         # Utilities and configuration
  │   │   └── /composables # Custom hooks and logic
  │   └── package.json
  ├── /server              # Hono backend API
  │   ├── /src             
  │   │   ├── /routes      # API route definitions
  │   │   ├── /db          # Database schema and migrations
  │   │   ├── /middlewares # Authentication, logging, etc.
  │   │   ├── /lib         # Server utilities
  │   │   └── /utils       # Helper functions
  │   └── package.json
  ├── /shared              # Shared types and schemas
  │   ├── /schemas         # Zod validation schemas
  │   └── /types           # TypeScript type definitions
  ├── /docker-compose.yml  # Production container orchestration
  ├── /compose.dev.yml     # Development container setup
  └── /README.md          # Project documentation
```ns, **Hono** for the web framework, and **Azure OpenAI** for AI integration. The project uses **TypeScript** for strong typing and **Biome** for code formatting and linting.

## Table of Contents

## Table of Contents

- [Prerequisites](#prerequisites)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Why This Project](#why-this-project)
- [Contributing](#contributing)
- [License](#license)

## Prerequisites

Before getting started, ensure that you have the following software installed:

- **Bun**: Modern JavaScript runtime and package manager. Install from [bun.sh](https://bun.sh)
- **Docker & Docker Compose**: For containerized development and deployment
- **Git**: Version control system to clone the project repository
- **Azure OpenAI**: Access to Azure OpenAI services for AI functionality

## Features

- 🤖 **Real-time Chat with AI**: Interactive chat interface powered by Azure OpenAI
- � **User Authentication**: Secure JWT-based authentication system
- � **Real-time Updates**: WebSocket connections for instant messaging
- � **PostgreSQL Database**: Robust data persistence with Drizzle ORM
- � **Redis Caching**: Fast session management and caching
- � **Docker Support**: Complete containerization with Docker Compose
- � **TypeScript**: Full type safety across the application
- 🌐 **Modern Frontend**: React with TanStack Router and Tailwind CSS

## Tech Stack

### Backend Technologies

- **Bun.js**: A fast JavaScript runtime used for server-side execution
- **Hono**: A minimal and fast web framework for building web APIs
- **Drizzle ORM**: A lightweight, typesafe ORM for handling database queries
- **PostgreSQL**: Primary database for data persistence
- **Redis**: Caching and session management
- **TypeScript**: For static typing and better development experience
- **Biome**: Code formatting and linting tool

### Frontend Technologies

- **React**: Modern UI library for building interactive interfaces
- **TanStack Router**: Type-safe routing for React applications
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Vite**: Fast build tool and development server

### AI Integration

- **Azure OpenAI**: Cloud-based AI services for chat functionality
- **GPT-4 Mini**: Advanced language model for conversational AI

### Infrastructure

- **Docker**: Containerization for consistent deployment
- **Docker Compose**: Multi-container orchestration
- **Nginx**: Web server for serving the frontend application

## Installation

Follow the steps below to install and run the project:

### Step 1: Clone the Repository

Clone the project repository to your local machine using Git:

```bash
git clone <your-repository-url>
cd Hono
```

### Step 2: Install Dependencies

Install dependencies for all packages in the monorepo:

```bash
bun install
```

### Step 3: Environment Configuration

Copy the environment example files and configure them:

```bash
# Server environment
cp server/.env.example server/.env.docker
# Update server/.env.docker with your Azure OpenAI credentials

# Client environment (if needed)
cp client/.env.example client/.env.docker
```

### Step 4: Start with Docker

The easiest way to run the complete application is using Docker Compose:

```bash
# Start all services (database, redis, server, client)
docker compose up -d

# Or start in development mode
docker compose -f compose.dev.yml up -d
```

This will start:
- PostgreSQL database on port 5432
- Redis cache on port 6379  
- Server API on port 3000
- Client application on port 80

## Running the Project

### Docker Compose (Recommended)

The simplest way to run the entire application:

```bash
# Production mode
docker compose up -d

# Development mode with hot reload
docker compose -f compose.dev.yml up -d
```

### Manual Development Setup

If you prefer to run services individually:

#### Step 1: Start Infrastructure Services

```bash
# Start only database and redis
docker compose up db redis -d
```

#### Step 2: Start Server

```bash
cd server
bun dev
```

#### Step 3: Start Client

```bash
cd client  
bun dev
```

### Accessing the Application

- **Client Application**: [http://localhost](http://localhost) (or [http://localhost:5173](http://localhost:5173) in dev mode)
- **Server API**: [http://localhost:3000](http://localhost:3000)
- **API Documentation**: [http://localhost:3000/reference](http://localhost:3000/reference)

## Project Structure

Here’s a quick overview of the project's folder structure:

```
/bun-application
  ├── /src                # Source code
  │   ├── /routes         # API route definitions (Hono)
  │   ├── /utils          # Constant and common functions
  │   ├── /db             # Database related files (Drizzle ORM models)
  │   ├── /middleware     # Middleware (e.g., authentication, logging)
  │   ├── /app.ts         # The hono routes and middleware file
  │   └── index.ts        # Entry point for the application
  ├── .env                # Environment variables
  ├── .eslintrc.json      # ESLint configuration
  ├── tsconfig.json       # TypeScript configuration
  ├── package.json        # Project metadata and dependencies
  └── README.md           # Project README (this file)
```

## Configuration

### Environment Variables

The application requires several environment variables to be configured:

#### Server Configuration (server/.env.docker)
```env
# Database
DB_URL=postgres://postgres:password@db:5432/chatapp

# Redis  
REDIS_URL=redis://redis:6379

# Azure OpenAI
AZURE_API_KEY=your_azure_api_key
AZURE_OPENAI_API_ENDPOINT=your_azure_endpoint
AZURE_DEPLOYMENT_NAME=your_deployment_name

# JWT
JWT_SECRET=your_jwt_secret

# CORS
CLIENT_URL=http://localhost:3001
```

### Development Tools

**Biome** is used for code formatting and linting across the project. It provides fast, consistent code quality checks.

### Common Commands

- **Install dependencies**: 
  ```bash
  bun install
  ```

- **Run code formatting**: 
  ```bash
  bun run format
  ```

- **Run linting**: 
  ```bash  
  bun run lint
  ```

- **Database migrations**: 
  ```bash
  cd server
  bun run db:generate  # Generate migration files
  bun run db:migrate   # Run migrations  
  ```

- **Database operations**:
  ```bash
  cd server
  bun run db:push      # Push schema changes directly
  bun run db:studio    # Open database browser
  ```

## Why This Project?

### Modern Full-Stack Architecture

This project demonstrates a modern approach to building chat applications with:

🏗️ **Monorepo Structure**: Organized codebase with shared types and utilities

🚀 **Performance**: Bun.js runtime provides exceptional speed for both development and production

🛡️ **Type Safety**: Full TypeScript coverage from database to frontend

🤖 **AI Integration**: Seamless Azure OpenAI integration for intelligent conversations  

� **Containerization**: Complete Docker setup for easy deployment and scaling

💾 **Modern Data Stack**: PostgreSQL + Redis + Drizzle ORM for robust data handling

⚡ **Real-time Features**: WebSocket support for instant messaging

� **Modern UI**: React + Tailwind CSS for beautiful, responsive interfaces

## Contributing

We welcome contributions to this project! If you'd like to contribute:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes, ensuring that the code is well-documented and tested.
4. Create a pull request.

Please make sure to follow the code style guidelines and run the tests before submitting a pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
