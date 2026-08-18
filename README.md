# 🏟️ eFootball Arena

eFootball Arena is a comprehensive web platform built for organizing, managing, and participating in eFootball tournaments. It provides a seamless experience for players to compete, organizers to host tournaments, and admins to oversee the platform's operations.

## ✨ Features

- **Role-Based Access Control**: Secure experiences tailored for Players, Organizers, and Admins.
- **Player Dashboard & Profiles**: Track personal statistics, match history, global ratings, and leaderboard rankings.
- **Tournament Management**: 
  - **For Players**: Browse active tournaments, register, handle entry payments securely, and view real-time brackets and standings.
  - **For Organizers**: Create and manage tournaments, verify match results, and oversee bracket progression.
- **Automated Match Submission**: Integrated OCR and AI (Google GenAI) to automatically parse match results from screenshots.
- **Admin Controls**: Comprehensive dashboard for managing users, overseeing platform finances, and regulating tournaments.
- **Responsive & Modern UI**: Built with a sleek, dark-mode first design using Tailwind CSS and Radix UI primitives.

## 🛠️ Tech Stack

- **Frontend Framework**: [React 18](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/) and [Vite](https://vitejs.dev/)
- **Routing**: [React Router v6](https://reactrouter.com/)
- **Data Fetching & State**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) (Radix UI), and [Framer Motion](https://www.framer.com/motion/) for animations
- **Backend & Auth**: [Supabase](https://supabase.com/) (Authentication, Database)
- **AI & OCR**: Google GenAI integration for automated match result extraction and verification

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm or pnpm
- A [Supabase](https://supabase.com/) project and database
- Google Gemini API key (for OCR capabilities)

### Installation

1. **Clone the repository** (if applicable) and navigate to the project directory:
   ```sh
   cd Football_Arena
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   # Add other required API keys such as Gemini
   ```

4. **Run the development server**:
   ```sh
   npm run dev
   ```
   The application will be available at `http://localhost:5173` (or the port specified by Vite).

## 📁 Project Structure

```text
src/
├── app/          # App-wide configurations, layouts, and global pages (Landing, 404)
├── components/   # Reusable UI components (including shadcn/ui components)
├── features/     # Feature-based modules (auth, admin, organizer, tournaments, etc.)
├── hooks/        # Custom React hooks
├── lib/          # Utility functions and library configurations
├── services/     # API handlers and external service integrations
└── ...
```

## 📜 Available Scripts

- `npm run dev`: Starts the Vite development server with hot-module replacement.
- `npm run build`: Compiles TypeScript and builds the app for production.
- `npm run lint`: Runs ESLint to check for code style and potential issues.
- `npm run preview`: Previews the production build locally.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to open a pull request or an issue to discuss proposed changes.
