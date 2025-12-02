# Implementation Plan

- [x] 1. Implement backend leaderboard API
- [x] 1.1 Create ScoreStore with thread-safe operations
  - Implement ScoreEntry struct with ID, Score, PlayerName, Timestamp
  - Create ScoreStore with mutex for concurrent access
  - Implement AddScore method with UUID generation
  - Implement GetTopScores method with sorting and limiting
  - Implement SaveToFile and LoadFromFile for persistence
  - _Requirements: 2.3, 2.4_

- [x] 1.2 Create HTTP handlers for leaderboard endpoints
  - Implement POST /api/leaderboard handler for score submission
  - Implement GET /api/leaderboard handler with limit query parameter
  - Add CORS headers for frontend access
  - Add request validation and error responses
  - Wire handlers into server.go
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 1.3 Write property test for leaderboard ordering
  - **Property 3: Leaderboard ordering**
  - **Validates: Requirements 2.4**

- [x] 1.4 Write property test for leaderboard limit enforcement
  - **Property 4: Leaderboard limit enforcement**
  - **Validates: Requirements 2.4**

- [x] 1.5 Write unit tests for backend handlers
  - Test POST endpoint with valid data
  - Test POST endpoint with invalid data (400 response)
  - Test GET endpoint returns sorted scores
  - Test GET endpoint respects limit parameter
  - Test concurrent score submissions
  - Test file persistence and loading
  - _Requirements: 2.3, 2.4_

- [x] 2. Implement score persistence and high score tracking
- [x] 2.1 Create StorageManager for high score
  - Implement getHighScore method with default to 0
  - Implement updateHighScore method with comparison logic
  - Add error handling for storage access and corrupted data
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 2.2 Integrate high score into game state
  - Add highScore and newHighScore flags to gameState
  - Load high score on game initialization
  - Update high score when score changes
  - Display both current score and high score in HUD
  - _Requirements: 1.3, 1.5_

- [x] 2.3 Write property test for high score monotonicity
  - **Property 2: High score monotonicity**
  - **Validates: Requirements 1.2**

- [x] 2.4 Write unit tests for StorageManager
  - Test retrieving high score from empty storage
  - Test updating high score when new score is higher
  - Test not updating when new score is lower
  - Test handling corrupted JSON data
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 3. Implement frontend leaderboard API client
- [x] 3.1 Create LeaderboardAPI module
  - Implement submitScore method with POST request
  - Implement getLeaderboard method with GET request
  - Add timeout handling (5 second limit)
  - Add error handling for network, server, and client errors
  - Return user-friendly error messages
  - _Requirements: 2.1, 2.3_

- [x] 3.2 Create LeaderboardUI component
  - Implement show method with async leaderboard fetching
  - Add loading state display while fetching
  - Implement formatEntry method with rank, player name, score, date
  - Add highlighting for current session score
  - Implement error display with retry button
  - Add hide method to close leaderboard
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 3.3 Integrate leaderboard with game end flow
  - Prompt for player name on game end
  - Submit score to backend via LeaderboardAPI
  - Display leaderboard after submission
  - Handle submission failures gracefully
  - Update HTML overlay for leaderboard display
  - _Requirements: 2.1, 2.3_

- [x] 3.4 Write unit tests for LeaderboardAPI
  - Test successful score submission
  - Test successful leaderboard retrieval
  - Test handling network errors
  - Test handling server errors
  - Test timeout handling
  - _Requirements: 2.1, 2.3_

- [x] 4. Implement double jump mechanic
- [x] 4.1 Create JumpController module
  - Add jumpsRemaining property to player (default 2)
  - Implement handleJump method checking jumpsRemaining
  - Decrement jumpsRemaining on each jump
  - Reset jumpsRemaining to 2 on landing
  - Apply same jump power for both jumps
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4.2 Integrate JumpController into game loop
  - Replace existing jump logic with JumpController.handleJump
  - Call resetJumps when player lands on platform
  - Update player state to track jump availability
  - _Requirements: 3.1, 3.2_

- [x] 4.3 Write property test for jump reset on landing
  - **Property 9: Jump reset on landing**
  - **Validates: Requirements 3.2**

- [x] 4.4 Write property test for jump power consistency
  - **Property 11: Jump power consistency**
  - **Validates: Requirements 3.4**

- [x] 4.5 Write unit tests for JumpController
  - Test jump availability after landing
  - Test jump depletion after two jumps
  - Test jump ignored when exhausted
  - Test double jump while falling
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 5. Implement particle system foundation
- [x] 5.1 Create ParticleSystem module with base structure
  - Define Particle data structure with position, velocity, size, color, opacity, rotation
  - Create particles array to hold active particles
  - Implement update method to update all particles
  - Implement render method to draw all particles with camera offset
  - Add particle removal logic for dead particles (opacity <= 0)
  - Implement 500 particle limit with oldest-first removal
  - _Requirements: 4.3, 5.3, 6.3, 7.3_

- [x] 5.2 Integrate ParticleSystem into game loop
  - Call ParticleSystem.update in game loop
  - Call ParticleSystem.render in draw cycle
  - Pass camera offset to render method
  - _Requirements: 4.1, 5.1, 6.1, 7.1_

- [x] 5.3 Write property test for dead particle removal
  - **Property 15: Dead particle removal**
  - **Validates: Requirements 4.3**

- [x] 5.4 Write unit tests for ParticleSystem
  - Test particle creation with valid parameters
  - Test particle removal when opacity reaches zero
  - Test particle limit enforcement (max 500)
  - Test update and render methods
  - _Requirements: 4.3, 5.3, 6.3, 7.3_

- [x] 6. Implement trail and explosion particle effects
- [x] 6.1 Implement trail particle creation
  - Add createTrail method to ParticleSystem
  - Spawn trail particles when player moves horizontally
  - Set fade-out properties (opacity decrease per frame)
  - Position particles at player's previous position
  - Add timer to control spawn rate
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [x] 6.2 Implement explosion particle effect
  - Add createExplosion method to ParticleSystem
  - Spawn 8-12 particles radiating outward
  - Set velocities pointing away from spawn point
  - Add fade and spread animation properties
  - Trigger on enemy collision (non-top direction)
  - _Requirements: 5.1, 5.2, 5.5_

- [x] 6.3 Write property test for trail spawning on movement
  - **Property 13: Trail spawning on movement**
  - **Validates: Requirements 4.1**

- [x] 6.4 Write property test for explosion particle radiation
  - **Property 19: Explosion particle radiation**
  - **Validates: Requirements 5.2**

- [x] 6.5 Write unit tests for trail and explosion effects
  - Test trail particles spawn during movement
  - Test no trails when stationary
  - Test explosion spawns on enemy collision
  - Test explosion particles radiate outward
  - _Requirements: 4.1, 4.4, 5.1, 5.2_

- [x] 7. Implement sparkle and confetti particle effects
- [x] 7.1 Implement sparkle particle effect
  - Add createSparkle method to ParticleSystem
  - Spawn 5-10 particles on collectible collection
  - Set upward velocity and rotation for each particle
  - Add varying sizes and fading opacity
  - Trigger on coin/collectible collection
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 7.2 Implement confetti particle effect
  - Add createConfetti method to ParticleSystem
  - Spawn 20-30 particles across screen on new high score
  - Set falling motion with gravity and rotation
  - Assign multiple random colors to particles
  - Add varying rotation speeds
  - Trigger only once per high score achievement
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 7.3 Write property test for sparkle count constraint
  - **Property 25: Sparkle count constraint**
  - **Validates: Requirements 6.4**

- [x] 7.4 Write property test for confetti count constraint
  - **Property 30: Confetti count constraint**
  - **Validates: Requirements 7.4**

- [x] 7.5 Write unit tests for sparkle and confetti effects
  - Test sparkle spawns on collection
  - Test sparkle count between 5-10
  - Test confetti spawns on new high score
  - Test confetti count between 20-30
  - Test confetti has multiple colors
  - _Requirements: 6.1, 6.4, 7.1, 7.4, 7.5_

- [x] 8. Implement flying animation and physics
- [x] 8.1 Create AnimationController module
  - Add animationState and rotation properties to player
  - Implement updateState method based on velocity
  - Implement applyFlyingPhysics method
  - Add apex float effect (reduced gravity at jump peak)
  - Add reduced gravity during descent
  - Calculate sprite rotation based on vertical velocity
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8.2 Integrate AnimationController into game loop
  - Call updateState in player update cycle
  - Call applyFlyingPhysics when player is airborne
  - Apply sprite rotation when rendering player
  - Add enhanced visual effect for double jump
  - _Requirements: 8.1, 8.4, 8.5_

- [x] 8.3 Write property test for reduced gravity on descent
  - **Property 34: Reduced gravity on descent**
  - **Validates: Requirements 8.3**

- [x] 8.4 Write property test for sprite rotation
  - **Property 35: Sprite rotation based on velocity**
  - **Validates: Requirements 8.4**

- [x] 8.5 Write unit tests for AnimationController
  - Test state transitions based on velocity
  - Test gravity reduction at jump apex
  - Test reduced gravity during descent
  - Test sprite rotation calculation
  - Test double jump visual effect
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 9. Final integration and testing
  - Ensure all features work together seamlessly
  - Test complete game flow: start → play → score → submit → leaderboard
  - Verify particle effects don't impact performance
  - Test error handling when backend is unavailable
  - Verify high score persists across browser refreshes
  - Test in multiple browsers (Chrome, Firefox, Safari)
  - Ensure all tests pass, ask the user if questions arise
