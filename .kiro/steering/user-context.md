---
inclusion: always
---

# Super Kiro World - User Preferences

## Tech Stack
- **Backend**: Go server
- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS

## Game Design Decisions

### Character
- Sprite: kiro-logo.png (scaled proportionally)
- Movement speed: 5
- Jump power: 12
- Gravity: 0.5
- Friction applied to horizontal movement

### Lives & Scoring
- Starting lives: 3
- Extra life collectibles: Pacman character sprites
- Collectibles: Gold coins (main collectible)
- Score tracking enabled

### Level Design
- Start with 1 level (expandable later)
- Level completion time: ~1 minute with most collectibles
- End condition: Reach end flag
- Features:
  - Moving platforms
  - Enemies (can be killed by jumping on them)
  - Raised platforms for extra coins
  - Ground platforms for main path

### Physics
- Gravity: 0.5
- Jump Power: 12
- Movement Speed: 5
- Friction on horizontal movement
- Scrolling camera follows player smoothly
- Accurate collision detection

### Future Enhancements (Later)
- Sound effects
- Visual polish/particle effects
- Additional levels
