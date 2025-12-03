# Design Document: Multi-Level World System

## Overview

This design document outlines the architecture and implementation strategy for transforming Super Kiro World from a single-level platformer into a multi-level game with a Super Mario World-style world map navigation system. The enhancements include:

- **World Map System**: An overworld screen for level selection and progress visualization
- **Level Progression**: Unlocking system where completing levels unlocks subsequent levels
- **Multiple Levels**: 6-8 distinct levels with increasing difficulty
- **Difficulty Scaling**: Progressive increases in platform gaps, enemy count, and challenge
- **New Enemy Types**: Three distinct enemy behaviors (ground patrol, plasma shooters, jumping)
- **Procedural Backgrounds**: Unique parallax backgrounds generated per level
- **Progress Persistence**: Save/load system for level completion status
- **Smooth Transitions**: Polished transitions between world map and gameplay

The system will be built as a modular extension to the existing game architecture, maintaining compatibility with current features like the leaderboard, particle effects, and double jump mechanics.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│           Game State Manager                    │
│  - Current screen (world map / gameplay)        │
│  - Level progression data                       │
│  - Transition state                             │
└─────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌─────────▼──────────┐
│  World Map     │    │   Level Gameplay   │
│  - Node render │    │   - Player         │
│  - Selection   │    │   - Enemies        │
│  - Progress    │    │   - Platforms      │
└────────────────┘    │   - Background     │
                      └────────────────────┘

### Module Organization

The implementation will add the following new modules to game.js:

**Core Systems:**
1. **GameStateManager**: Manages screen state (world map vs gameplay) and transitions
2. **WorldMap**: Renders and handles world map interactions
3. **LevelProgressionManager**: Tracks level completion and unlock status
4. **ProgressStorage**: Persists level completion data to local storage

**Level Generation:**
5. **LevelGenerator**: Creates level configurations with difficulty scaling
6. **BackgroundGenerator**: Procedurally generates parallax backgrounds

**Enemy Systems:**
7. **GroundEnemy**: Patrol-based enemy behavior
8. **PlasmaShooter**: Ranged enemy with projectile attacks
9. **JumpingEnemy**: Unpredictable jumping enemy behavior
10. **Projectile**: Plasma projectile entity

**Visual Systems:**
11. **TransitionManager**: Handles fade transitions between screens
12. **ParallaxBackground**: Renders multi-layer scrolling backgrounds

## Components and Interfaces

### GameStateManager

Central controller for game screens and state transitions.

```javascript
const GameStateManager = {
    currentScreen: 'worldMap',  // 'worldMap' or 'gameplay'
    selectedLevel: null,
    transitionState: null,      // null, 'fadeOut', 'fadeIn'
    transitionAlpha: 0,
    
    // Initialize game state
    init() {
        // Load progress from storage
        // Set initial screen to world map
        // Initialize world map
    },
    
    // Update current screen
    update() {
        // Handle transitions
        // Update active screen (world map or gameplay)
    },
    
    // Render current screen
    render(ctx) {
        // Render active screen
        // Apply transition overlay if transitioning
    },
    
    // Transition to level gameplay
    transitionToLevel(levelNumber) {
        // Start fade out
        // Load level
        // Switch to gameplay
        // Fade in
    },
    
    // Transition to world map
    transitionToWorldMap() {
        // Start fade out
        // Switch to world map
        // Fade in
    }
};
```

### WorldMap

Manages world map rendering and player interaction.

```javascript
const WorldMap = {
    nodes: [],              // Array of level nodes
    selectedNode: 0,        // Currently selected node index
    cameraX: 0,            // Camera position for map scrolling
    cameraY: 0,
    
    // Initialize world map
    init() {
        // Create level nodes with positions
        // Load completion status from ProgressStorage
        // Position camera on first incomplete level
    },
    
    // Update world map
    update(keys) {
        // Handle node selection (arrow keys)
        // Handle level start (Enter/Space)
        // Update camera position
    },
    
    // Render world map
    render(ctx) {
        // Draw background
        // Draw paths between nodes
        // Draw level nodes with status indicators
        // Draw player position marker
        // Draw UI (instructions, level info)
    },
    
    // Get node at index
    getNode(index) {
        // Returns node data
    },
    
    // Check if node is unlocked
    isNodeUnlocked(index) {
        // Returns true if level is playable
    }
};
```

### Level Node Data Structure

```javascript
const LevelNode = {
    levelNumber: 1,         // Level identifier
    x: 100,                 // X position on map
    y: 300,                 // Y position on map
    unlocked: true,         // Can be played
    completed: false,       // Has been beaten
    bestScore: 0           // Highest score achieved
};
```

### LevelProgressionManager

Tracks and manages level completion and unlocking.

```javascript
const LevelProgressionManager = {
    totalLevels: 8,
    completedLevels: new Set(),
    levelScores: {},
    
    // Initialize from storage
    init() {
        // Load from ProgressStorage
        // Validate data integrity
    },
    
    // Mark level as completed
    completeLevel(levelNumber, score) {
        // Add to completed set
        // Update best score if higher
        // Unlock next level
        // Save to storage
    },
    
    // Check if level is unlocked
    isLevelUnlocked(levelNumber) {
        // Level 1 always unlocked
        // Others unlocked if previous completed
    },
    
    // Check if level is completed
    isLevelCompleted(levelNumber) {
        // Returns completion status
    },
    
    // Get best score for level
    getBestScore(levelNumber) {
        // Returns highest score or 0
    },
    
    // Reset all progress
    resetProgress() {
        // Clear all completion data
        // Save to storage
    }
};
```

### ProgressStorage

Handles persistence of level progression data.

```javascript
const ProgressStorage = {
    STORAGE_KEY: 'superKiroWorld_levelProgress',
    
    // Save progress data
    saveProgress(data) {
        // Serialize progression data
        // Write to local storage
        // Handle errors gracefully
    },
    
    // Load progress data
    loadProgress() {
        // Read from local storage
        // Parse and validate
        // Return data or default state
        // Handle corrupted data
    },
    
    // Clear progress data
    clearProgress() {
        // Remove from local storage
    }
};
```

### LevelGenerator

Creates level configurations with difficulty scaling.

```javascript
const LevelGenerator = {
    // Generate level configuration
    generateLevel(levelNumber) {
        // Use level number as seed for deterministic generation
        // Calculate difficulty parameters
        // Generate platforms with increasing gaps
        // Place enemies with increasing density
        // Add collectibles
        // Set end flag position
        // Return level config object
    },
    
    // Calculate difficulty multiplier
    getDifficultyMultiplier(levelNumber) {
        // Returns scaling factor (1.0 to 2.0)
    },
    
    // Generate platform layout
    generatePlatforms(levelNumber, difficulty) {
        // Create platform array
        // Increase gap distances with difficulty
        // Reduce safe platform count with difficulty
        // Return platforms
    },
    
    // Generate enemy placements
    generateEnemies(levelNumber, difficulty) {
        // Calculate enemy count (increases with level)
        // Mix enemy types (ground, plasma, jumping)
        // Place enemies strategically
        // Return enemy array
    },
    
    // Generate collectibles
    generateCollectibles(levelNumber) {
        // Place coins throughout level
        // Add extra life collectibles
        // Return collectible array
    }
};
```

### Level Configuration Data Structure

```javascript
const LevelConfig = {
    levelNumber: 1,
    platforms: [
        { x: 0, y: 500, width: 200, height: 20 },
        // ... more platforms
    ],
    enemies: [
        { type: 'ground', x: 300, y: 480, patrolStart: 250, patrolEnd: 450 },
        { type: 'plasma', x: 600, y: 400, range: 300, fireRate: 120 },
        { type: 'jumping', x: 900, y: 480, jumpInterval: [60, 180] },
        // ... more enemies
    ],
    collectibles: [
        { type: 'coin', x: 150, y: 450 },
        { type: 'extraLife', x: 800, y: 300 },
        // ... more collectibles
    ],
    endFlag: { x: 2000, y: 450 },
    backgroundSeed: 1
};
```

### Enemy Classes

#### GroundEnemy

Patrols horizontally along platforms.

```javascript
class GroundEnemy {
    constructor(x, y, patrolStart, patrolEnd) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.patrolStart = patrolStart;
        this.patrolEnd = patrolEnd;
        this.velocityX = 1.5;
        this.type = 'ground';
    }
    
    update() {
        // Move horizontally
        // Reverse at patrol boundaries
        // Apply gravity
    }
    
    render(ctx, camera) {
        // Draw enemy sprite/rectangle
    }
    
    checkCollision(player) {
        // Detect collision with player
        // Return collision type (top, side, none)
    }
}
```

#### PlasmaShooter

Stationary enemy that fires projectiles.

```javascript
class PlasmaShooter {
    constructor(x, y, range, fireRate) {
        this.x = x;
        this.y = y;
        this.width = 35;
        this.height = 35;
        this.range = range;
        this.fireRate = fireRate;
        this.fireTimer = 0;
        this.type = 'plasma';
    }
    
    update(player, projectiles) {
        // Check if player in range
        // Update fire timer
        // Fire projectile when timer expires
    }
    
    fireProjectile(targetX, targetY) {
        // Calculate direction to target
        // Create and return new Projectile
    }
    
    render(ctx, camera) {
        // Draw enemy sprite/rectangle
        // Draw range indicator (optional)
    }
}
```

#### JumpingEnemy

Jumps randomly with unpredictable movement.

```javascript
class JumpingEnemy {
    constructor(x, y, jumpInterval) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 28;
        this.velocityX = 0;
        this.velocityY = 0;
        this.jumpInterval = jumpInterval; // [min, max] frames
        this.jumpTimer = this.getRandomJumpTime();
        this.onGround = false;
        this.type = 'jumping';
    }
    
    update(platforms) {
        // Update jump timer
        // Jump when timer expires
        // Apply gravity
        // Check platform collisions
        // Reset timer on landing
    }
    
    jump() {
        // Apply random horizontal velocity
        // Apply upward velocity
    }
    
    getRandomJumpTime() {
        // Return random value in jumpInterval range
    }
    
    render(ctx, camera) {
        // Draw enemy sprite/rectangle
    }
    
    checkCollision(player) {
        // Detect collision with player
        // Return collision type (top, side, none)
    }
}
```

#### Projectile

Plasma projectile fired by PlasmaShooter.

```javascript
class Projectile {
    constructor(x, y, velocityX, velocityY) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.active = true;
    }
    
    update() {
        // Move in straight line
        // Check if off-screen
        // Deactivate if off-screen
    }
    
    render(ctx, camera) {
        // Draw projectile (glowing ball)
    }
    
    checkCollision(player) {
        // Detect collision with player
        // Return true if hit
    }
}
```

### BackgroundGenerator

Procedurally generates parallax backgrounds.

```javascript
const BackgroundGenerator = {
    // Generate background for level
    generateBackground(levelNumber) {
        // Use level number as seed
        // Create 3-4 parallax layers
        // Generate elements for each layer
        // Return background configuration
    },
    
    // Seeded random number generator
    seededRandom(seed) {
        // Returns deterministic random function
        // Same seed = same sequence
    },
    
    // Generate layer elements
    generateLayer(layerIndex, seed, levelNumber) {
        // Choose element type (clouds, mountains, stars, etc.)
        // Generate positions and properties
        // Return layer data
    }
};
```

### ParallaxBackground

Renders multi-layer scrolling backgrounds.

```javascript
const ParallaxBackground = {
    layers: [],
    
    // Initialize with background config
    init(backgroundConfig) {
        // Store layer data
    },
    
    // Render all layers
    render(ctx, cameraX) {
        // Render each layer with parallax offset
        // Layers further back scroll slower
    },
    
    // Render single layer
    renderLayer(ctx, layer, cameraX) {
        // Calculate parallax offset
        // Draw layer elements
        // Tile/repeat as needed
    }
};
```

### Background Configuration Data Structure

```javascript
const BackgroundConfig = {
    layers: [
        {
            depth: 0.1,        // Parallax multiplier (0-1)
            color: '#1a1a2e',  // Base color
            elements: [
                { type: 'star', x: 100, y: 50, size: 2 },
                { type: 'cloud', x: 300, y: 100, width: 80, height: 40 },
                // ... more elements
            ]
        },
        // ... more layers
    ]
};
```

### TransitionManager

Handles smooth fade transitions between screens.

```javascript
const TransitionManager = {
    active: false,
    phase: null,           // 'fadeOut' or 'fadeIn'
    alpha: 0,              // 0 (transparent) to 1 (opaque)
    duration: 30,          // Frames for transition
    frameCount: 0,
    callback: null,        // Function to call between fade out/in
    
    // Start transition
    startTransition(callback) {
        // Set active state
        // Start fade out
        // Store callback for mid-transition
    },
    
    // Update transition
    update() {
        // Update alpha based on phase
        // Switch phase when fade out completes
        // Call callback at midpoint
        // End transition when fade in completes
    },
    
    // Render transition overlay
    render(ctx) {
        // Draw semi-transparent black overlay
        // Use current alpha value
    },
    
    // Check if input should be blocked
    isBlocking() {
        // Returns true if transition active
    }
};
```

## Data Models

### Game State Extensions

```javascript
gameState = {
    // Existing properties
    score: 0,
    lives: 3,
    gameOver: false,
    levelComplete: false,
    highScore: 0,
    
    // New properties
    currentScreen: 'worldMap',     // 'worldMap' or 'gameplay'
    currentLevel: null,            // Current level number
    levelConfig: null,             // Current level configuration
    worldMapData: null             // World map state
}
```

### Progress Data Structure

```javascript
const ProgressData = {
    version: 1,                    // Data format version
    completedLevels: [1, 2, 3],   // Array of completed level numbers
    levelScores: {
        1: 1500,
        2: 2300,
        3: 1800
    },
    totalScore: 5600,
    lastPlayedLevel: 3,
    timestamp: '2024-12-02T10:30:00Z'
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### World Map Properties

Property 1: All level nodes displayed with status
*For any* world map state, all level nodes should be rendered with their current unlock status visible
**Validates: Requirements 1.2**

Property 2: Level completion marks node
*For any* level completion event, the corresponding level node on the world map should be marked as completed
**Validates: Requirements 1.3**

Property 3: Level completion unlocks next level
*For any* level completion (except the final level), the next sequential level should become unlocked
**Validates: Requirements 1.4**

Property 4: Unlocked level selection transitions to gameplay
*For any* unlocked level node selected by the player, the game should transition to that level's gameplay
**Validates: Requirements 1.5**

### Level Replay Properties

Property 5: Completed levels are replayable
*For any* level marked as completed, the player should be able to select and replay that level
**Validates: Requirements 2.1**

Property 6: Level replay determinism
*For any* level number, loading that level multiple times should produce the same level configuration
**Validates: Requirements 2.2**

Property 7: Replay score update
*For any* replayed level completion, if the new score exceeds the previous best score, the stored best score should be updated
**Validates: Requirements 2.3**

Property 8: Completed level visual distinction
*For any* world map display, completed levels should have visually different indicators than uncompleted levels
**Validates: Requirements 2.4**

Property 9: Completion status persistence across transitions
*For any* transition from level to world map, all level completion statuses should remain unchanged
**Validates: Requirements 2.5**

### Difficulty Scaling Properties

Property 10: Platform gap scaling
*For any* two levels where level A has a higher number than level B, level A should have larger average platform gaps than level B
**Validates: Requirements 3.1**

Property 11: Enemy count scaling
*For any* two levels where level A has a higher number than level B, level A should have more enemies than level B
**Validates: Requirements 3.2**

Property 12: Safe platform reduction
*For any* two levels where level A has a higher number than level B, level A should have fewer safe platforms (platforms with no enemies) than level B
**Validates: Requirements 3.4**

### Ground Enemy Properties

Property 13: Ground enemy patrol path assignment
*For any* ground enemy spawned, it should have a defined patrol path with start and end boundaries
**Validates: Requirements 4.1**

Property 14: Ground enemy direction reversal
*For any* ground enemy reaching its patrol boundary, its movement direction should reverse
**Validates: Requirements 4.2**

Property 15: Ground enemy defeat from above
*For any* collision between player and ground enemy from above, the enemy should be defeated and the player should receive upward bounce velocity
**Validates: Requirements 4.3**

Property 16: Ground enemy damage from sides
*For any* collision between player and ground enemy from non-top directions, the player should take damage
**Validates: Requirements 4.4**

Property 17: Ground enemy defeat cleanup
*For any* defeated ground enemy, it should be removed from the level and points should be awarded to the player
**Validates: Requirements 4.5**

### Plasma Shooter Properties

Property 18: Plasma shooter firing behavior
*For any* plasma shooter with player in range, it should fire projectiles toward the player's position at regular intervals
**Validates: Requirements 5.2**

Property 19: Projectile linear movement
*For any* projectile fired, it should move in a straight line from its spawn position
**Validates: Requirements 5.3**

Property 20: Projectile collision damage
*For any* collision between player and projectile, the player should take damage and the projectile should be removed
**Validates: Requirements 5.4**

Property 21: Projectile off-screen cleanup
*For any* projectile that travels beyond screen boundaries, it should be removed from the level
**Validates: Requirements 5.5**

### Jumping Enemy Properties

Property 22: Jumping enemy random timing
*For any* jumping enemy spawned, it should have random jump timing parameters assigned
**Validates: Requirements 6.1**

Property 23: Jumping enemy jump on timer
*For any* jumping enemy whose jump timer expires, it should perform a jump with random horizontal velocity
**Validates: Requirements 6.2**

Property 24: Jumping enemy timer reset on landing
*For any* jumping enemy landing on a platform, its jump timer should be reset with a new random duration
**Validates: Requirements 6.3**

Property 25: Jumping enemy defeat from above
*For any* collision between player and jumping enemy from above, the enemy should be defeated and the player should receive upward bounce velocity
**Validates: Requirements 6.4**

Property 26: Jumping enemy damage from sides
*For any* collision between player and jumping enemy from non-top directions, the player should take damage
**Validates: Requirements 6.5**

### Procedural Background Properties

Property 27: Background determinism
*For any* level number, generating the background multiple times should produce identical results
**Validates: Requirements 7.1, 7.3**

Property 28: Multiple parallax layers
*For any* generated background, it should contain multiple layers with different scroll speeds
**Validates: Requirements 7.2**

Property 29: Parallax scrolling behavior
*For any* camera movement, background layers should scroll at different speeds proportional to their depth
**Validates: Requirements 7.4**

Property 30: Background element presence
*For any* generated background, it should contain procedurally generated visual elements
**Validates: Requirements 7.5**

### World Map Visual Properties

Property 31: Current position highlighting
*For any* world map display, the player's current position should be visually highlighted
**Validates: Requirements 8.1**

Property 32: Path connections visible
*For any* world map display, visual paths should connect sequential level nodes
**Validates: Requirements 8.2**

Property 33: Locked level indicator
*For any* locked level on the world map, it should display a locked visual indicator
**Validates: Requirements 8.3**

Property 34: Available level indicator
*For any* unlocked but uncompleted level on the world map, it should display an available visual indicator
**Validates: Requirements 8.4**

Property 35: Completed level indicator
*For any* completed level on the world map, it should display a completed visual indicator with checkmark
**Validates: Requirements 8.5**

### Progress Persistence Properties

Property 36: Completion status persistence
*For any* level completion, the completion status should be saved to local storage
**Validates: Requirements 9.1**

Property 37: Progress loading on startup
*For any* game startup, level completion data should be loaded from local storage
**Validates: Requirements 9.2**

### Transition Properties

Property 38: World map to level transition effect
*For any* transition from world map to level, a fade transition effect should be displayed
**Validates: Requirements 10.1**

Property 39: Level to world map transition effect
*For any* transition from level to world map, a fade transition effect should be displayed
**Validates: Requirements 10.2**

Property 40: Input blocking during transition
*For any* active transition, player input should be blocked until the transition completes
**Validates: Requirements 10.3**

Property 41: Level initialization before display
*For any* level load, all level elements should be initialized before gameplay is displayed
**Validates: Requirements 10.4**

Property 42: Camera positioning on world map return
*For any* return to world map, the camera should be positioned on the most recently played level node
**Validates: Requirements 10.5**

## Error Handling

### Local Storage Errors

**Storage Quota Exceeded**
- Catch `QuotaExceededError` when saving progress
- Display warning message to user
- Progress tracking continues in memory for current session
- Attempt to save again on next level completion

**Storage Access Denied**
- Catch `SecurityError` when accessing local storage (private browsing)
- Gracefully degrade: maintain progress in memory only
- Display info message about limited functionality
- Game remains fully playable

**Corrupted Progress Data**
- Wrap `JSON.parse()` calls in try-catch blocks
- If parsing fails, reset to default state (only level 1 unlocked)
- Notify player that progress was reset
- Log error to console for debugging

**Version Mismatch**
- Check version field in loaded progress data
- If version incompatible, migrate or reset data
- Notify player of data format update

### Level Generation Errors

**Invalid Level Number**
- Validate level number is within valid range (1 to totalLevels)
- Default to level 1 if invalid
- Log warning for debugging

**Generation Failure**
- Wrap generation logic in try-catch
- If generation fails, use fallback level configuration
- Log error details
- Ensure game remains playable

### Enemy Behavior Errors

**Invalid Patrol Boundaries**
- Validate patrol start < patrol end for ground enemies
- Clamp to platform boundaries if invalid
- Prevent enemies from getting stuck

**Projectile Overflow**
- Limit maximum active projectiles per level (e.g., 50)
- Remove oldest projectiles when limit reached
- Prevents memory issues from excessive shooting

**Enemy Off-Platform**
- Check if enemy falls off platforms
- Remove enemies that fall below screen
- Prevents accumulation of dead enemies

### Transition Errors

**Transition Interruption**
- Prevent starting new transition while one is active
- Queue transition requests if needed
- Ensure transitions complete properly

**Missing Level Data**
- Check if level configuration exists before transition
- Fall back to level 1 if data missing
- Display error message to player

### Background Generation Errors

**Seed Validation**
- Ensure seed is valid number
- Use default seed if invalid
- Prevents generation failures

**Layer Rendering Errors**
- Wrap layer rendering in try-catch
- Skip problematic layers
- Continue rendering other layers
- Log errors for debugging

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases using Vitest (already configured in the project).

**GameStateManager Tests:**
- Test initialization with no saved progress
- Test initialization with saved progress
- Test screen transitions (world map ↔ gameplay)
- Test transition state management

**WorldMap Tests:**
- Test node selection with keyboard input
- Test node unlock status display
- Test camera positioning on selected node
- Test level start trigger

**LevelProgressionManager Tests:**
- Test level completion marking
- Test next level unlocking
- Test level 1 always unlocked
- Test final level completion (no next level)
- Test score tracking and best score updates

**ProgressStorage Tests:**
- Test saving progress data
- Test loading progress data
- Test handling empty storage (first run)
- Test handling corrupted data
- Test data migration between versions

**LevelGenerator Tests:**
- Test deterministic generation (same level number = same config)
- Test difficulty scaling (higher level = harder)
- Test platform gap increases with level
- Test enemy count increases with level
- Test valid level configurations (no impossible jumps)

**Enemy Tests:**
- Test GroundEnemy patrol behavior and direction reversal
- Test PlasmaShooter firing at correct intervals
- Test JumpingEnemy random jump timing
- Test Projectile movement and cleanup
- Test collision detection for all enemy types

**BackgroundGenerator Tests:**
- Test deterministic generation (same seed = same background)
- Test multiple layers created
- Test layer depth values are valid (0-1)
- Test element generation

**TransitionManager Tests:**
- Test fade out → callback → fade in sequence
- Test input blocking during transition
- Test transition completion
- Test alpha value progression

### Property-Based Testing

Property-based tests will verify universal properties across many randomly generated inputs using fast-check. Each property test should run a minimum of 100 iterations.

**Configuration:**
```javascript
import fc from 'fast-check';

// Configure to run 100+ iterations per property
const testConfig = { numRuns: 100 };
```

**Level Generation Properties:**
- Property 6: Level replay determinism - generating same level number multiple times produces identical configurations
- Property 10: Platform gap scaling - higher level numbers have larger gaps
- Property 11: Enemy count scaling - higher level numbers have more enemies
- Property 12: Safe platform reduction - higher level numbers have fewer safe platforms

**Enemy Behavior Properties:**
- Property 14: Ground enemy direction reversal at boundaries
- Property 22: Jumping enemy random timing assignment
- Property 27: Background determinism - same seed produces same background

**Progression Properties:**
- Property 3: Level completion unlocks next level
- Property 7: Replay score update only when new score is higher
- Property 36: Completion status round-trip (save then load returns same data)

**Transition Properties:**
- Property 40: Input blocked during any active transition

### Integration Testing

Integration tests will verify that components work together correctly:

- Test complete game flow: start → world map → select level → play → complete → return to map
- Test level progression: complete level 1 → level 2 unlocks → play level 2
- Test replay flow: complete level → return to map → replay same level
- Test progress persistence: complete levels → refresh page → progress retained
- Test all enemy types in same level
- Test background rendering with camera scrolling
- Test transitions between multiple levels
- Test score tracking across multiple level completions
- Test world map navigation with keyboard controls
- Test level completion with different outcomes (win, game over)

### Manual Testing Checklist

After implementation, manually verify:
- [ ] World map displays on game start
- [ ] Only level 1 is unlocked initially
- [ ] Level nodes show correct status (locked/unlocked/completed)
- [ ] Selecting unlocked level starts that level
- [ ] Locked levels cannot be selected
- [ ] Completing level unlocks next level
- [ ] Completed levels show checkmark on map
- [ ] Replaying level loads same configuration
- [ ] Best score updates when beaten
- [ ] All three enemy types behave correctly
- [ ] Ground enemies patrol and reverse at boundaries
- [ ] Plasma shooters fire projectiles at player
- [ ] Jumping enemies jump randomly
- [ ] Defeating enemies from above works
- [ ] Taking damage from enemy sides works
- [ ] Projectiles damage player and disappear
- [ ] Backgrounds are unique per level
- [ ] Backgrounds scroll at different speeds (parallax)
- [ ] Same level always has same background
- [ ] Difficulty increases in later levels (harder jumps, more enemies)
- [ ] Transitions are smooth with fade effects
- [ ] Input blocked during transitions
- [ ] Progress persists after browser refresh
- [ ] Corrupted save data resets gracefully
- [ ] Game performs well with multiple enemies and projectiles
- [ ] All features work in different browsers

## Implementation Notes

### Performance Considerations

**Enemy Management:**
- Limit total enemies per level (e.g., 20 maximum)
- Cull enemies outside camera view before updating
- Use object pooling for projectiles to reduce garbage collection
- Remove defeated enemies immediately

**Background Rendering:**
- Cache generated background layers
- Only render layers visible in camera view
- Use efficient drawing methods (avoid complex paths)
- Consider using offscreen canvas for static layers

**Level Generation:**
- Generate levels once and cache configuration
- Use efficient data structures for level data
- Avoid regenerating on replay

**Transition Performance:**
- Use requestAnimationFrame for smooth transitions
- Minimize rendering during transitions
- Preload next screen before transition completes

### Browser Compatibility

**Local Storage:**
- Supported in all modern browsers
- Test in Safari (stricter storage policies)
- Handle private browsing gracefully

**Canvas Rendering:**
- Use standard 2D context features
- Test parallax scrolling performance across browsers
- Ensure 60 FPS on target devices

### Level Design Guidelines

**Level 1 (Tutorial):**
- Short and simple
- Few enemies (1-2 ground enemies)
- Wide platform gaps
- Clear path to end

**Levels 2-3 (Easy):**
- Introduce all enemy types
- Moderate platform gaps
- Some optional collectibles on harder paths

**Levels 4-5 (Medium):**
- Mix of all enemy types
- Narrower platform gaps
- More enemies
- Some precision jumps required

**Levels 6-8 (Hard):**
- Dense enemy placement
- Narrow platform gaps
- Multiple plasma shooters
- Jumping enemies in challenging positions
- Requires mastery of double jump

### World Map Layout

**Visual Design:**
- Nodes arranged in path from left to right
- Some vertical variation for visual interest
- Clear paths connecting nodes
- Distinct visual states (locked/unlocked/completed)

**Navigation:**
- Arrow keys to move between nodes
- Enter/Space to select level
- ESC to return to menu (future enhancement)
- Visual feedback on selection

### Future Enhancements

**Potential additions not in current scope:**
- Boss levels at certain milestones
- Secret levels with special unlock conditions
- Power-ups and special abilities
- Time trial mode
- Level editor
- Multiple save slots
- Achievement system
- World map animations (moving between nodes)
- Cutscenes between worlds
- Multiple worlds with different themes
- Co-op multiplayer
- Level sharing system

## Dependencies

**External Libraries:**
- **fast-check**: Property-based testing library for JavaScript
  - Version: ^3.0.0
  - Already installed in project
  - Used for: Generating random test inputs and verifying properties

**Browser APIs:**
- **Local Storage API**: For progress persistence
- **Canvas 2D Context**: For rendering world map, levels, and backgrounds
- **requestAnimationFrame**: For smooth animations and transitions

**No additional runtime dependencies required** - all features use vanilla JavaScript and existing game infrastructure.
