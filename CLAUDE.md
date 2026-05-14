# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Run to Midnight Kiss" — a 2D side-scrolling endless runner game built with vanilla HTML5 Canvas and JavaScript. No build tools, no frameworks, no dependencies.

- **Genre:** Cute chibi-style romantic comedy runner with story progression
- **Story:** Prasad (playable character) races through 4 environments to reach his girlfriend Arya before midnight on her birthday
- **Art style:** Chibi/kawaii characters drawn programmatically on Canvas — big eyes, soft shading, bold outlines

## Running the Game

Open `index.html` directly in a browser. No server or build step required.

For local development with live reload, any static file server works:
```
npx serve .
# or
python3 -m http.server 8000
```

## Architecture

- `index.html` — Entry point, canvas element (900×506), embedded CSS, mobile touch controls, loads `game.js`
- `game.js` — All game logic (not yet written): game loop, player, obstacles, collectibles, backgrounds, UI, audio

The game is a single-canvas application. All rendering is done via Canvas 2D API with no external sprite assets — characters and environments are drawn programmatically.

## Game Design

- **4 levels:** Bus Stand → City Road → Highway → Park (parallax scrolling backgrounds)
- **Controls:** Space/Up to jump, Down to slide; touch buttons on mobile
- **Mechanics:** Auto-runner, countdown timer (8 min), love meter, 3-heart health, collectibles (hearts, coins, chai boost, shield rose, time bonus)
- **Canvas:** 900×506 logical pixels, CSS-scaled to viewport
