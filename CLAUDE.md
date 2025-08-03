# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an Anonymous Chat web application built entirely with frontend technologies: HTML5, CSS3, and vanilla JavaScript. It allows creating anonymous dialogue spaces where users can ask questions and receive anonymous responses.

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
- Everything stored in localStorage (no backend)
- Room data key format: `room_${roomId}`
- User votes stored separately to track across sessions
- Automatic cleanup of expired rooms on load

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
- `app.js` - Single class containing all application logic
- No external dependencies or frameworks