# Design Document: Game Enhancements

## Overview

This design document outlines the architecture and implementation strategy for enhancing Super Kiro World with persistent score tracking, advanced movement mechanics, and visual effects. The enhancements will be implemented as modular systems that integrate with the existing game architecture without requiring major refactoring.

The core enhancements include:
- **Persistence Layer**: Backend API integration for leaderboard data, local storage for high score
- **Double Jump System**: Extended jump mechanics with state tracking
- **Particle System**: Unified particle engine supporting multiple effect types
- **Animation System**: Enhanced character animations for flying/jumping states

## Architecture

### High-Level Architecture

The game follows a client-side architecture with the following layers:

```
┌─────────────────────────────────────────┐
│         Game Loop (game.js)             │
│  - Update cycle                         │
│  - Render cycle                         │
│  - Input handling                       │
└─────────────────────────────────────────┘
           │
           ├──────────────────────────────┐
           │                              │
┌──────────▼──────────┐      ┌───────────▼──────────┐
│  Game State Manager │      │   Particle System    │
│  - Score tracking   │      │   - Trail particles  │
│  - Lives management │      │   - Explosions       │
│  - High score       │      │   - Sparkles         │
│  - Leaderboard UI   │      │   - Confetti         │
└─────────────────────┘      └──────────────────────┘
           │                              │
┌──────────▼──────────┐      ┌───────────▼──────────┐
│  Player Controller  │      │   Render Engine      │
│  - Movement         │      │   - Canvas drawing   │
│  - Double jump      │      │   - Particle effects │
│  - Flying animation │      │   - Animations       │
└─────────────────────┘      └──────────────────────┘
           │
           ├──────────────────────────────┐
           │                              │
┌──────────▼──────────┐      ┌───────────▼──────────┐
│  Local Storage API  │      │   Backend API (Go)   │
│  - High score only  │      │   - POST /api/       │
│                     │      │     leaderboard      │
│                     │      │   - GET /api/        │
│                     │      │     leaderboard      │
└─────────────────────┘      └──────────────────────┘
│  - Score data       │
│  - Leaderboard data │
└─────────────────────┘
```

### Module Organization

The implementation will add the following new modules:

**Frontend (game.js):**
1. **StorageManager**: Handles local storage for high score only
2. **LeaderboardAPI**: Handles HTTP requests to backend for leaderboard data
3. **ParticleSystem**: Manages particle lifecycle and rendering
4. **LeaderboardUI**: Displays and manages leaderboard interface
5. **JumpController**: Extends player jump mechanics with double jump
6. **AnimationController**: Manages flying/jumping animations

**Backend (server.go):**
1. **LeaderboardHandler**: HTTP handlers for leaderboard endpoints
2. **ScoreStore**: In-memory or file-based storage for leaderboard entries

## Components and Interfaces

### StorageManager

Responsible for persisting and retrieving high score from browser local storage.

```javascript
const StorageManager = {
    // Get high score
    getHighScore() {
        // Returns highest score from local storage
        // Returns 0 if no score exists
    },
    
    // Update high score if needed
    updateHighScore(newScore) {
        // Compares with current high score
        // Updates if newScore is higher
        // Returns true if new high score achieved
    },
    
    // Clear high score (for testing)
    clearHighScore() {
        // Removes stored high score
    }
};
```

### LeaderboardAPI

Handles communication with the backend API for leaderboard operations.

```javascript
const LeaderboardAPI = {
    // Submit score to backend
    async submitScore(score, playerName) {
        // POST request to /api/leaderboard
        // Sends { score, playerName, timestamp }
        // Returns submitted entry with ID
    },
    
    // Get top leaderboard entries
    async getLeaderboard(limit = 10) {
        // GET request to /api/leaderboard?limit=10
        // Returns array of top scores sorted descending
        // Each entry: { id, score, playerName, timestamp }
    },
    
    // Handle API errors
    handleError(error) {
        // Logs error
        // Returns user-friendly error message
        // Allows graceful degradation
    }
};
```

### ParticleSystem

Unified system for managing all particle effects in the game.

```javascript
const ParticleSystem = {
    particles: [],
    
    // Create trail particle
    createTrail(x, y) {
        // Spawns particle at position
        // Sets fade-out animation properties
    },
    
    // Create explosion effect
    createExplosion(x, y) {
        // Spawns 8-12 particles radiating outward
        // Sets velocity and fade properties
    },
    
    // Create sparkle effect
    createSparkle(x, y) {
        // Spawns 5-10 particles with upward motion
        // Sets rotation and fade properties
    },
    
    // Create confetti effect
    createConfetti() {
        // Spawns 20-30 particles across screen
        // Sets falling motion with gravity
        // Assigns random colors
    },
    
    // Update all particles
    update() {
        // Updates position, opacity, rotation
        // Removes dead particles
    },
    
    // Render all particles
    render(ctx, camera) {
        // Draws all active particles
        // Applies camera offset
    }
};
```

### Particle Data Structure

```javascript
const Particle = {
    x: 0,              // X position
    y: 0,              // Y position
    velocityX: 0,      // Horizontal velocity
    velocityY: 0,      // Vertical velocity
    size: 5,           // Particle size
    color: '#FFF',     // Particle color
    opacity: 1.0,      // Current opacity (0-1)
    fadeRate: 0.02,    // Opacity decrease per frame
    rotation: 0,       // Current rotation angle
    rotationSpeed: 0,  // Rotation speed per frame
    type: 'trail',     // Particle type
    lifetime: 0        // Frames alive
};
```

### JumpController

Extends player object with double jump capability.

```javascript
const JumpController = {
    jumpsRemaining: 2,     // Jumps available (1 = grounded, 2 = can double jump)
    jumpBufferFrames: 0,   // Input buffer for responsive jumping
    
    // Handle jump input
    handleJump(player, keys) {
        // Checks if jump button pressed
        // Applies jump if jumps remaining > 0
        // Decrements jumpsRemaining
        // Triggers flying animation
    },
    
    // Reset on landing
    resetJumps() {
        // Sets jumpsRemaining to 2
    },
    
    // Check if can jump
    canJump() {
        // Returns true if jumpsRemaining > 0
    }
};
```

### AnimationController

Manages character animation states for flying effect.

```javascript
const AnimationController = {
    currentState: 'idle',  // idle, running, flying, falling
    floatTimer: 0,         // Timer for apex float effect
    
    // Update animation state
    updateState(player) {
        // Determines state based on velocity
        // Manages transitions
    },
    
    // Apply flying physics
    applyFlyingPhysics(player) {
        // Reduces gravity when ascending
        // Adds float at jump apex
        // Applies sprite rotation
    },
    
    // Render with animation
    render(ctx, player, camera) {
        // Draws player with current animation state
        // Applies rotation/tilt for flying
    }
};
```

### LeaderboardUI

Manages the leaderboard display interface.

```javascript
const LeaderboardUI = {
    // Show leaderboard
    async show(currentScore, playerName) {
        // Fetches leaderboard data from backend via LeaderboardAPI
        // Renders leaderboard HTML
        // Highlights current score if in top 10
        // Displays in overlay
        // Shows loading state while fetching
    },
    
    // Hide leaderboard
    hide() {
        // Removes leaderboard overlay
    },
    
    // Format leaderboard entry
    formatEntry(entry, rank, isCurrent) {
        // Returns HTML string for entry
        // Applies highlighting if current
        // Shows rank, player name, score, and date
    },
    
    // Show error message
    showError(message) {
        // Displays error in leaderboard UI
        // Provides retry option
    }
};
```

### Backend Components (Go)

#### LeaderboardHandler

HTTP handlers for leaderboard API endpoints.

```go
type LeaderboardHandler struct {
    store *ScoreStore
}

// POST /api/leaderboard - Submit new score
func (h *LeaderboardHandler) SubmitScore(w http.ResponseWriter, r *http.Request)

// GET /api/leaderboard?limit=10 - Get top scores
func (h *LeaderboardHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request)
```

#### ScoreStore

Manages leaderboard data persistence.

```go
type ScoreEntry struct {
    ID          string    `json:"id"`
    Score       int       `json:"score"`
    PlayerName  string    `json:"playerName"`
    Timestamp   time.Time `json:"timestamp"`
}

type ScoreStore struct {
    entries []ScoreEntry
    mu      sync.RWMutex
}

// AddScore adds a new score entry
func (s *ScoreStore) AddScore(score int, playerName string) ScoreEntry

// GetTopScores returns top N scores sorted by score descending
func (s *ScoreStore) GetTopScores(limit int) []ScoreEntry

// SaveToFile persists leaderboard to JSON file
func (s *ScoreStore) SaveToFile(filename string) error

// LoadFromFile loads leaderboard from JSON file
func (s *ScoreStore) LoadFromFile(filename string) error
```

## Data Models

### Score Entry (Backend)

```go
{
    ID:         "uuid-string",              // Unique identifier
    Score:      1250,                       // Final score value
    PlayerName: "Player1",                  // Player identifier
    Timestamp:  time.Time                   // Submission time
}
```

### Score Entry (Frontend)

```javascript
{
    id: "uuid-string",                  // Unique identifier from backend
    score: 1250,                        // Final score value
    playerName: "Player1",              // Player identifier
    timestamp: "2024-12-02T10:30:00Z", // ISO date string
    isCurrentSession: false             // Flag for current game
}
```

### Game State Extensions

```javascript
gameState = {
    score: 0,
    lives: 3,
    gameOver: false,
    levelComplete: false,
    highScore: 0,              // NEW: Current high score
    newHighScore: false,       // NEW: Flag for confetti trigger
    confettiTriggered: false   // NEW: Prevent multiple confetti spawns
}
```

### Player Extensions

```javascript
player = {
    // ... existing properties ...
    jumpsRemaining: 2,         // NEW: Available jumps
    animationState: 'idle',    // NEW: Current animation
    rotation: 0,               // NEW: Sprite rotation for flying
    trailTimer: 0              // NEW: Timer for trail spawning
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Score Persistence Properties

Property 1: Score storage on game end
*For any* game session that ends, storing the final score should result in that score being retrievable from local storage
**Validates: Requirements 1.1**

Property 2: High score update on new record
*For any* new score that exceeds the current high score, the stored high score should be updated to the new value
**Validates: Requirements 1.2**

Property 3: Score display consistency
*For any* score change during gameplay, both the current score and high score should be visible in the UI
**Validates: Requirements 1.5**

### Leaderboard Properties

Property 4: Leaderboard entry completeness
*For any* leaderboard entry displayed, it should contain both a score value and a timestamp
**Validates: Requirements 2.2**

Property 5: Leaderboard persistence
*For any* new score submitted to the backend, it should appear in subsequent leaderboard retrievals from the backend
**Validates: Requirements 2.3**

Property 6: Leaderboard size and ordering
*For any* leaderboard with more than ten entries, only the top ten scores should be displayed in descending order
**Validates: Requirements 2.4**

Property 7: Current session highlighting
*For any* leaderboard display where the current session's score appears in the top ten, that entry should be visually highlighted
**Validates: Requirements 2.5**

### Double Jump Properties

Property 8: Double jump activation
*For any* player state where the character is airborne and has not used the second jump, pressing the jump button should apply upward velocity
**Validates: Requirements 3.1**

Property 9: Jump reset on landing
*For any* landing event, the double jump availability should be restored to allow two jumps
**Validates: Requirements 3.2**

Property 10: Jump exhaustion
*For any* player state where both jumps have been used, additional jump button presses should not affect velocity until landing
**Validates: Requirements 3.3**

Property 11: Jump power consistency
*For any* double jump performed, the applied velocity should equal the velocity applied by the initial jump
**Validates: Requirements 3.4**

Property 12: Double jump while falling
*For any* player state where the character is falling and has not used the double jump, pressing the jump button should apply upward velocity
**Validates: Requirements 3.5**

### Trail Particle Properties

Property 13: Trail spawning on movement
*For any* frame where the character has non-zero horizontal velocity, trail particles should be spawned
**Validates: Requirements 4.1**

Property 14: Trail particle fade
*For any* trail particle, its opacity should decrease over time until reaching zero
**Validates: Requirements 4.2**

Property 15: Dead particle removal
*For any* trail particle with zero opacity, it should be removed from the particle array
**Validates: Requirements 4.3**

Property 16: No trails when stationary
*For any* frame where the character has zero horizontal velocity, no new trail particles should be spawned
**Validates: Requirements 4.4**

Property 17: Trail positioning
*For any* trail particle rendered, it should be positioned behind the character with opacity decreasing based on age
**Validates: Requirements 4.5**

### Explosion Effect Properties

Property 18: Explosion on enemy collision
*For any* collision with an enemy from a non-top direction, an explosion effect should be spawned at the collision point
**Validates: Requirements 5.1**

Property 19: Explosion particle radiation
*For any* explosion effect spawned, its particles should have velocities pointing outward from the spawn point
**Validates: Requirements 5.2**

Property 20: Explosion particle cleanup
*For any* explosion particle that completes its animation, it should be removed from the particle array
**Validates: Requirements 5.3**

Property 21: Explosion fade and spread
*For any* active explosion particle, its opacity should decrease and its distance from spawn point should increase over time
**Validates: Requirements 5.5**

### Sparkle Effect Properties

Property 22: Sparkle spawning on collection
*For any* collectible collection event, sparkle particles should be spawned at the collectible's position
**Validates: Requirements 6.1**

Property 23: Sparkle upward movement
*For any* sparkle particle, it should have positive upward velocity and non-zero rotation speed
**Validates: Requirements 6.2**

Property 24: Sparkle particle cleanup
*For any* sparkle particle that completes its animation, it should be removed from the particle array
**Validates: Requirements 6.3**

Property 25: Sparkle count constraint
*For any* collection event, the number of sparkle particles spawned should be between five and ten inclusive
**Validates: Requirements 6.4**

Property 26: Sparkle visual variety
*For any* set of sparkle particles spawned together, they should have varying sizes and all should fade over time
**Validates: Requirements 6.5**

### Confetti Effect Properties

Property 27: Confetti on new high score
*For any* score update that exceeds the previous high score, confetti particles should be spawned
**Validates: Requirements 7.1**

Property 28: Confetti falling behavior
*For any* confetti particle, it should have downward velocity (affected by gravity) and non-zero rotation speed
**Validates: Requirements 7.2**

Property 29: Confetti off-screen cleanup
*For any* confetti particle whose y-position exceeds the canvas height, it should be removed from the particle array
**Validates: Requirements 7.3**

Property 30: Confetti count constraint
*For any* new high score event, the number of confetti particles spawned should be between twenty and thirty inclusive
**Validates: Requirements 7.4**

Property 31: Confetti visual variety
*For any* set of confetti particles spawned together, they should have multiple different colors and varying rotation speeds
**Validates: Requirements 7.5**

### Flying Animation Properties

Property 32: Flying animation on ascent
*For any* player state where vertical velocity is negative (ascending), the animation state should be set to flying
**Validates: Requirements 8.1**

Property 33: Apex float effect
*For any* player state where vertical velocity is near zero (at jump peak), the applied gravity should be temporarily reduced
**Validates: Requirements 8.2**

Property 34: Reduced gravity on descent
*For any* player state where vertical velocity is positive (descending) and not on ground, the applied gravity should be less than the base gravity value
**Validates: Requirements 8.3**

Property 35: Sprite rotation based on velocity
*For any* player state in flying mode, the sprite rotation should correspond to the direction of vertical velocity
**Validates: Requirements 8.4**

Property 36: Enhanced double jump visual
*For any* double jump activation, a distinct visual effect or animation should be triggered
**Validates: Requirements 8.5**

## Error Handling

### Local Storage Errors

**Storage Quota Exceeded**
- Catch `QuotaExceededError` when writing high score
- Display warning message to user
- High score tracking disabled but game continues

**Storage Access Denied**
- Catch `SecurityError` when accessing local storage (private browsing)
- Gracefully degrade: maintain high score in memory only for current session
- Display info message about limited functionality

**Corrupted Data**
- Wrap `JSON.parse()` calls in try-catch blocks
- If parsing fails, clear corrupted data and reinitialize
- Log error to console for debugging
- Reset high score to 0

### Backend API Errors

**Network Errors**
- Catch fetch errors (network unavailable, timeout)
- Display user-friendly error message: "Unable to connect to leaderboard server"
- Provide retry button in leaderboard UI
- Game continues to function, leaderboard just unavailable

**Server Errors (5xx)**
- Handle 500, 503 status codes
- Display message: "Leaderboard service temporarily unavailable"
- Log error details for debugging
- Allow user to retry submission

**Client Errors (4xx)**
- Handle 400 (bad request) - validate input before sending
- Handle 429 (rate limit) - display "Too many requests, please wait"
- Log error for debugging
- Prevent repeated failed submissions

**Timeout Errors**
- Set reasonable timeout (5 seconds) for API requests
- Cancel request if timeout exceeded
- Display timeout message with retry option
- Don't block game flow waiting for API

**Partial Failures**
- If score submission fails, still show leaderboard (read-only)
- If leaderboard fetch fails, still allow score submission
- Cache last successful leaderboard fetch as fallback
- Display warning about stale data if using cache

### Particle System Errors

**Memory Management**
- Implement hard limit of 500 active particles
- When limit reached, remove oldest particles first
- Prevents memory issues from particle accumulation
- Ensures smooth performance on lower-end devices

**Invalid Particle Data**
- Validate particle properties before adding to array
- Skip rendering particles with invalid positions or properties
- Remove invalid particles during update cycle
- Prevents rendering errors and crashes

### Animation Errors

**Missing Sprite Resources**
- Check if player image is loaded before applying transformations
- Fall back to rectangle rendering if image unavailable
- Continue game functionality without visual enhancements
- Log warning for debugging

**Canvas Context Loss**
- Detect context loss events
- Attempt to restore canvas context
- Reinitialize particle system if needed
- Display error message if restoration fails

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases using a JavaScript testing framework (Jest or Vitest).

**Storage Manager Tests:**
- Test retrieving high score from empty storage (should return 0)
- Test updating high score when new score is higher
- Test updating high score when new score is lower (should not update)
- Test handling corrupted JSON data

**Leaderboard API Tests:**
- Test successful score submission
- Test successful leaderboard retrieval
- Test handling network errors
- Test handling server errors (5xx)
- Test handling timeout errors
- Test request payload formatting

**Backend Handler Tests (Go):**
- Test POST /api/leaderboard with valid data
- Test POST /api/leaderboard with invalid data (400 response)
- Test GET /api/leaderboard returns sorted scores
- Test GET /api/leaderboard respects limit parameter
- Test concurrent score submissions (thread safety)
- Test leaderboard persistence to file
- Test leaderboard loading from file

**Jump Controller Tests:**
- Test jump availability after landing
- Test jump depletion after two jumps
- Test jump power consistency between first and second jump
- Test jump input buffering for responsive controls

**Particle System Tests:**
- Test particle creation with valid parameters
- Test particle removal when opacity reaches zero
- Test particle removal when off-screen
- Test particle limit enforcement (max 500)
- Test different particle types spawn correctly

**Animation Controller Tests:**
- Test state transitions (idle → running → flying → falling)
- Test gravity reduction during flying state
- Test sprite rotation calculation based on velocity
- Test apex float timing

### Property-Based Testing

Property-based tests will verify universal properties across many randomly generated inputs using fast-check (JavaScript property testing library). Each property test should run a minimum of 100 iterations.

**Configuration:**
```javascript
import fc from 'fast-check';

// Configure to run 100+ iterations per property
const testConfig = { numRuns: 100 };
```

**Storage Properties:**
- Property 1: High score round-trip (save then load returns same value)
- Property 2: High score monotonicity (high score never decreases)

**Backend Properties:**
- Property 3: Leaderboard ordering (all entries sorted descending)
- Property 4: Leaderboard limit enforcement (never returns more than requested limit)
- Property 5: Score submission idempotency (submitting same score twice creates two entries)

**Jump Properties:**
- Property 8: Double jump always available when airborne with jumps remaining
- Property 9: Landing always resets jump count to 2
- Property 11: Jump velocity magnitude consistent between jumps

**Particle Properties:**
- Property 14: All trail particles fade over time (opacity decreases)
- Property 15: No particles with zero opacity remain in array
- Property 25: Sparkle count always between 5-10
- Property 30: Confetti count always between 20-30

**Animation Properties:**
- Property 34: Gravity during descent always less than base gravity
- Property 35: Sprite rotation sign matches velocity direction

### Integration Testing

Integration tests will verify that components work together correctly:

- Test complete game session flow: start → play → score → end → submit → leaderboard
- Test particle effects trigger correctly during gameplay
- Test high score persistence across page reloads
- Test leaderboard submission and retrieval end-to-end
- Test double jump interaction with platforms and enemies
- Test multiple particle effects active simultaneously
- Test leaderboard display with current session highlighting
- Test graceful degradation when backend is unavailable

### Manual Testing Checklist

After implementation, manually verify:
- [ ] High score persists after browser refresh
- [ ] Leaderboard fetches from backend correctly
- [ ] Score submission works and appears in leaderboard
- [ ] Leaderboard displays correctly with 10+ entries
- [ ] Error messages display when backend is unavailable
- [ ] Double jump feels responsive and consistent
- [ ] Trail particles follow character smoothly
- [ ] Explosion effects appear on enemy collision
- [ ] Sparkles appear when collecting coins
- [ ] Confetti triggers only on new high score
- [ ] Flying animation looks smooth and graceful
- [ ] Game performs well with many particles active
- [ ] All features work in different browsers (Chrome, Firefox, Safari)

## Implementation Notes

### Performance Considerations

**Particle Optimization:**
- Use object pooling for particles to reduce garbage collection
- Batch particle rendering calls to minimize canvas operations
- Cull particles outside camera view before rendering
- Limit particle spawn rate to maintain 60 FPS

**Storage Optimization:**
- Only store high score locally (minimal storage usage)
- Use efficient JSON serialization for high score

**Backend Optimization:**
- Implement in-memory caching for leaderboard queries
- Debounce file writes to avoid excessive I/O
- Use efficient sorting algorithms for leaderboard
- Consider pagination for very large leaderboards

**Animation Optimization:**
- Cache sprite transformations when possible
- Use requestAnimationFrame for smooth animations
- Avoid redundant calculations in game loop

### Browser Compatibility

**Local Storage:**
- Supported in all modern browsers
- Graceful degradation for private browsing modes
- Test in Safari (stricter storage policies)

**Fetch API:**
- Supported in all modern browsers
- Use polyfill for older browsers if needed
- Handle CORS properly in backend

**Canvas API:**
- Use standard canvas 2D context (widely supported)
- Avoid experimental features
- Test particle rendering performance across browsers

### Future Enhancements

**Potential additions not in current scope:**
- Sound effects for particle events
- Particle effect customization options
- Player authentication and user accounts
- Global leaderboard across all players
- Additional jump mechanics (wall jump, glide)
- More particle effect types (smoke, fire, etc.)
- Particle physics interactions (collision, attraction)
- Achievement system tied to score milestones
- Replay system to review high-score runs
- Leaderboard filtering by time period (daily, weekly, all-time)

## Dependencies

**External Libraries:**
- **fast-check**: Property-based testing library for JavaScript
  - Version: ^3.0.0
  - Used for: Generating random test inputs and verifying properties
  - Installation: `npm install --save-dev fast-check`

**Browser APIs:**
- **Local Storage API**: For high score persistence only
- **Fetch API**: For HTTP requests to backend leaderboard API
- **Canvas 2D Context**: For rendering particles and animations
- **requestAnimationFrame**: For smooth animation timing

**Backend Dependencies (Go):**
- **Standard Library Only**: No external dependencies required
  - `net/http`: HTTP server and routing
  - `encoding/json`: JSON serialization
  - `sync`: Thread-safe data structures
  - `time`: Timestamp handling
  - `io/ioutil`: File I/O for persistence

**No additional runtime dependencies required** - frontend uses vanilla JavaScript and browser APIs, backend uses Go standard library.
