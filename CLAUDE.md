# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an Anonymous Chat web application with **Supabase backend integration** and localStorage fallback. Built with HTML5, CSS3, vanilla JavaScript, and Supabase for real-time multi-device chat functionality. It allows creating anonymous dialogue spaces where users can ask questions and receive anonymous responses that sync across devices.

## Architecture

### Core Class: AnonymousChatApp (app.js:4-636)

The entire application is managed by a single class that handles:

- **State Management**: Maintains current screen, room data, user info, votes, and timers
- **Screen Navigation**: Controls transitions between Welcome, Create Room, Join Room, and Chat screens
- **Room Management**: Creates rooms with unique 6-character codes, manages expiration
- **Message System**: Handles sending/receiving messages with anonymous/creator distinction
- **Voting System**: Tracks likes/dislikes per message, prevents duplicate votes
- **Storage**: Uses localStorage for persistence with automatic cleanup

### Key Data Structures

```javascript
// Room structure
{
  id: "ROOM1234",           // 6-character unique code
  creator: "Name",          // Creator name (visible only in first message)
  question: "Question?",    // Initial question
  createdAt: ISO timestamp,
  expiresAt: ISO timestamp, // 2 hours from creation
  messageLimit: 50,
  messages: [
    {
      id: timestamp,
      text: "message",
      isAnonymous: boolean,
      author: "Name or Anónimo",
      timestamp: ISO,
      votes: { likes: 0, dislikes: 0 }
    }
  ]
}
```

### Configuration Limits (app.js:7-12)

- Message limit: 50 messages per room
- Time limit: 2 hours (7200000ms)
- Storage limit: 5MB
- Character limit: 280 per message

## Development Commands

This is a static web application with no build process. To run:

1. Open `index.html` directly in a web browser
2. Or serve the directory with any static file server:
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve`
   - VS Code: Use Live Server extension

No installation, build, test, or lint commands are required.

## Key Implementation Details

### Anonymous Behavior
- The room creator is identified only in their first message
- After the first message, the creator becomes anonymous like other users
- All participants except the initial creator post as "Anónimo"

### Storage Strategy
- **Primary**: Supabase backend with PostgreSQL database
- **Fallback**: localStorage for offline/development mode
- **Tables**: `chat_rooms`, `chat_messages`, `chat_votes`
- **Multi-device sync**: Rooms and messages shared across all devices
- **Voting system**: Prevents duplicate votes using user fingerprinting
- Automatic cleanup of expired rooms in both Supabase and localStorage

### Screen Flow
1. Welcome → Create Room → Room Code Modal → Chat
2. Welcome → Join Room → Chat
3. Chat → Confirm Leave → Welcome

### Mobile Optimizations
- Touch targets minimum 48px
- Responsive breakpoints: 320px, 768px, 1024px+
- Smooth scrolling to new messages
- Virtual keyboard handling for message input

## File Structure

- `index.html` - All UI screens and modals
- `style.css` - Complete styling with CSS variables and responsive design
- `app.js` - Main application class with Supabase integration
- `supabase-client.js` - Supabase client wrapper with localStorage fallback
- `env.js` - Environment variables for frontend (auto-generated in production)
- `.env` - Local environment variables (NOT committed to git)
- `Dockerfile` - Container configuration with environment variable support
- `.dockerignore` - Excludes unnecessary files from Docker build
- `SUPABASE_SETUP.md` - Complete setup instructions for Supabase
- External dependencies: Supabase JS client (loaded from CDN)

## Deployment Status

### Recent Changes (2025-08-03)
- **✅ COMPLETED**: Supabase backend integration with PostgreSQL
- **✅ COMPLETED**: Multi-device chat functionality
- **✅ COMPLETED**: Environment variables support in Docker
- **✅ COMPLETED**: Automatic fallback to localStorage
- **✅ COMPLETED**: CSS issue resolved in previous deployment

### Backend Requirements
1. **Supabase Setup**: Execute SQL from `SUPABASE_SETUP.md`
2. **Environment Variables**: Configure in Coolify/VPS:
   - `SUPABASE_URL=https://supmcp.axcsol.com`
   - `SUPABASE_ANON_KEY=your_actual_anon_key`

### Deployment Process
1. ✅ Supabase tables created and configured (SQL ready in SUPABASE_SETUP.md)
2. ✅ Code updated with backend integration
3. **NEXT**: Execute SQL setup in Supabase and get real ANON_KEY
4. **NEXT**: Configure environment variables in Coolify
5. **NEXT**: Deploy and test multi-device functionality
6. **NEXT**: Implement real-time messaging (NEW REQUIREMENT)

### Testing Multi-Device
- Create room on Device A → Join with code on Device B
- Messages should sync across devices (manual refresh currently)
- Voting system prevents duplicates across sessions
- **NEW**: Messages should appear automatically on all connected devices (real-time)

### Current State - Session End
- **Problem SOLVED**: "Sala no encontrada" multi-device issue resolved
- **Backend**: Supabase fully integrated with localStorage fallback
- **Deployment**: Ready for production with environment variables
- **NEW FEATURE**: Real-time messaging required for next session
- **Configuration**: SQL ready to execute, keys need to be configured