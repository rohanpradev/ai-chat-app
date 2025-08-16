# 💬 AI Chat Application - Frontend

A modern, responsive chat application built with React, TypeScript, and AI integration. Features real-time messaging, beautiful UI components, and seamless user experience.

## 🚀 Features

- **AI-Powered Conversations** - Integrated with OpenAI for intelligent responses
- **Real-time Streaming** - Stream AI responses in real-time for better UX
- **Modern UI** - Built with Tailwind CSS and custom components
- **Responsive Design** - Works perfectly on desktop and mobile
- **Authentication** - Secure user authentication system
- **Type Safety** - Full TypeScript implementation
- **Fast Development** - Powered by Vite and Bun for lightning-fast builds

## 🛠 Tech Stack

- **Framework**: React 19 with TypeScript
- **Routing**: TanStack Router (File-based routing)
- **Styling**: Tailwind CSS v4 with custom animations
- **State Management**: TanStack Query for server state
- **Build Tool**: Vite 7
- **Package Manager**: Bun
- **AI Integration**: AI SDK for streaming responses
- **UI Components**: Custom components with Radix UI primitives
- **Icons**: Lucide React
- **Linting**: Biome for formatting and linting

## 📦 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- A running backend server (see `../server/README.md`)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun dev
```

The app will be available at `http://localhost:5000`

## 🏗 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── chat/           # Chat-specific components
│   │   ├── ChatHeader.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessages.tsx
│   │   └── LoadingScreen.tsx
│   └── ui/             # Base UI components
│       ├── button.tsx
│       ├── input.tsx
│       └── kibo-ui/    # AI-specific UI components
├── composables/        # Custom hooks and utilities
│   ├── useApi.ts
│   ├── useAuth.ts
│   └── useChat.ts
├── routes/             # File-based routing
│   ├── __root.tsx      # Root layout
│   ├── index.tsx       # Chat interface
│   └── (auth)/         # Authentication routes
├── lib/                # Utility functions
└── styles.css          # Global styles
```

## 🎨 Key Components

### Chat Interface
- **ChatMessages**: Displays conversation history with AI responses
- **ChatInput**: Input field with send functionality
- **ChatHeader**: App header with user info and actions
- **LoadingScreen**: Beautiful loading states

### AI Integration
- **AIMessage**: Component for AI message display
- **AIResponse**: Formatted AI response with markdown support
- **AISuggestions**: Quick suggestion buttons

## 🔧 Available Scripts

```bash
# Development
bun dev              # Start development server
bun start            # Alternative start command

# Building
bun build            # Build for production
bun serve            # Preview production build

# Code Quality
bun lint             # Run Biome linter
bun format           # Format code with Biome
bun check            # Run both linting and formatting

# Testing
bun test             # Run tests with Vitest
```

## 🌐 Environment Variables

Create a `.env` file in the client directory:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Optional: Enable development features
VITE_DEV_MODE=true
```

## 🎯 Key Features Explained

### AI Streaming
The app uses the AI SDK to stream responses in real-time, providing a smooth chat experience:

```typescript
const { messages, sendMessage, isLoading } = useChat({
  transport: new DefaultChatTransport({
    api: `${import.meta.env.VITE_API_URL}/ai/text-stream`,
    credentials: "include",
  }),
});
```

### File-based Routing
Routes are automatically generated from the file structure:
- `/` → `routes/index.tsx` (Chat interface)
- `/login` → `routes/(auth)/_auth/login.tsx`
- `/register` → `routes/(auth)/_auth/register.tsx`

### Responsive Design
Built with mobile-first approach using Tailwind CSS:
- Responsive layouts that work on all screen sizes
- Touch-friendly interface for mobile devices
- Optimized performance for different devices

## 🐳 Docker Support

### Development
```bash
docker build -f Dockerfile.dev -t chat-app-client:dev .
docker run -p 5000:5000 chat-app-client:dev
```

### Production
```bash
docker build -f Dockerfile -t chat-app-client:prod .
docker run -p 80:80 chat-app-client:prod
```

## 🔄 Integration with Backend

This frontend is designed to work with the Hono-based backend in `../server`. Key integration points:

- **Authentication**: Cookie-based authentication
- **API Communication**: RESTful API with streaming support
- **Real-time Features**: WebSocket connections for live updates
- **File Uploads**: Multi-part form data support

## 🚀 Deployment

### Production Build
```bash
bun build
```

### Docker Deployment
```bash
docker-compose up -d frontend
```

### Environment-specific Builds
The app supports different API URLs for different environments through build-time variables.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and test them
4. Run linting: `bun check`
5. Commit your changes: `git commit -m 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## 📝 Code Style

This project uses Biome for consistent code formatting and linting:

```bash
# Check code style
bun check

# Auto-fix issues
bun format
```

## 🐛 Troubleshooting

### Common Issues

**Build fails with TailwindCSS errors**
```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install
```

**Development server not starting**
```bash
# Check if port 5000 is available
lsof -i :5000
# Kill any process using the port
kill -9 <PID>
```

**API connection issues**
- Verify backend server is running on correct port
- Check CORS configuration in backend
- Ensure `VITE_API_URL` environment variable is set correctly

## 📚 Learn More

- [React Documentation](https://react.dev/)
- [TanStack Router](https://tanstack.com/router)
- [Tailwind CSS](https://tailwindcss.com/)
- [AI SDK Documentation](https://sdk.vercel.ai/)
- [Bun Documentation](https://bun.sh/docs)

## 📄 License

This project is part of a larger chat application. See the root `../LICENSE` file for details.

---

**Built with ❤️ using modern web technologies**
