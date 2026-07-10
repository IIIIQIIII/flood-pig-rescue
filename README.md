# Flood Pig Rescue

洪水夹猪队 is a small browser game where you steer an excavator claw, lock onto pigs in fast water, and carry them safely onto a right-bank dock.

The game is built with React, Next, vinext, and Canvas. It is designed as a playful, self-contained web game that can run locally or be deployed to a static/edge hosting target that supports the vinext build output.

## Features

- Canvas-based rescue gameplay with animated rain, floodwater, pigs, excavator arm, dock, scoring, timer, and lives.
- Mouse, keyboard, and touch controls.
- Sticky claw behavior: once a pig is caught, it stays latched until released over the safe dock.
- Clear separation between the downstream miss zone and the safe landing zone.
- Responsive layout for desktop and mobile screens.

## Getting Started

Requirements:

- Node.js 22.13 or newer
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run the basic verification test:

```bash
npm test
```

## Project Structure

```text
app/page.tsx        Main game scene, state, controls, and canvas rendering
app/globals.css     Layout and responsive styling
app/layout.tsx      Metadata and root layout
public/pig.png      Pig sprite used in the game
public/og.png       Social preview image
worker/index.ts     vinext Cloudflare Worker entry point
```

## Controls

- Move mouse or touch the game area to aim the claw.
- Click/tap to clamp; click/tap again over the dock to release safely.
- Use `W A S D` or arrow keys to move the claw.
- Use `Space` to clamp/release with the keyboard.

## License

MIT
