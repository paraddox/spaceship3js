# Spachip3JS

A browser-first reinterpretation of the Godot/C++ `spaceship` project.

## What this version keeps

- hex-grid modular ship editor
- data-driven module catalog derived from the original project
- aggregate power / heat / mass / hull stats
- launch from editor into a flight-test sandbox
- top-down ship combat with simplified enemy AI and projectiles

## What this version simplifies

- no full ECS / Rapier physics / projectile hell
- no full operator progression system yet
- no advanced power-network routing yet
- no full save-game pipeline beyond JSON + localStorage

## Commands

```bash
npm install
npm run dev
npm run build
```

## Notes

This is intentionally scoped as a maintainable Three.js vertical slice rather than a one-to-one engine port.
