const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// StorageManager - Handles high score persistence
const StorageManager = {
    HIGH_SCORE_KEY: 'superKiroWorld_highScore',
    
    // Get high score from local storage
    getHighScore() {
        try {
            const stored = localStorage.getItem(this.HIGH_SCORE_KEY);
            if (stored === null) {
                return 0;
            }
            const parsed = JSON.parse(stored);
            // Validate that it's a number
            if (typeof parsed === 'number' && parsed >= 0) {
                return parsed;
            }
            // Corrupted data - reset to 0
            console.warn('Corrupted high score data, resetting to 0');
            this.clearHighScore();
            return 0;
        } catch (error) {
            // Handle JSON parse errors or storage access errors
            console.error('Error reading high score:', error);
            this.clearHighScore();
            return 0;
        }
    },
    
    // Update high score if new score is higher
    updateHighScore(newScore) {
        try {
            const currentHighScore = this.getHighScore();
            if (newScore > currentHighScore) {
                localStorage.setItem(this.HIGH_SCORE_KEY, JSON.stringify(newScore));
                return true; // New high score achieved
            }
            return false; // Not a new high score
        } catch (error) {
            // Handle storage quota exceeded or access denied
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded - high score not saved');
            } else if (error.name === 'SecurityError') {
                console.warn('Storage access denied (private browsing?) - high score not saved');
            } else {
                console.error('Error updating high score:', error);
            }
            return false;
        }
    },
    
    // Clear high score (for testing)
    clearHighScore() {
        try {
            localStorage.removeItem(this.HIGH_SCORE_KEY);
        } catch (error) {
            console.error('Error clearing high score:', error);
        }
    }
};

// ProgressStorage - Handles level progression persistence
const ProgressStorage = {
    STORAGE_KEY: 'superKiroWorld_levelProgress',
    VERSION: 1,
    
    // Save progress data to local storage
    saveProgress(data) {
        try {
            const progressData = {
                version: this.VERSION,
                completedLevels: Array.from(data.completedLevels || []),
                levelScores: data.levelScores || {},
                totalScore: data.totalScore || 0,
                lastPlayedLevel: data.lastPlayedLevel || 1,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progressData));
            return true;
        } catch (error) {
            // Handle storage errors gracefully
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded - progress not saved');
            } else if (error.name === 'SecurityError') {
                console.warn('Storage access denied (private browsing?) - progress not saved');
            } else {
                console.error('Error saving progress:', error);
            }
            return false;
        }
    },
    
    // Load progress data from local storage
    loadProgress() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            
            // No saved data - return default state
            if (stored === null) {
                return this.getDefaultProgress();
            }
            
            // Parse stored data
            const parsed = JSON.parse(stored);
            
            // Validate data structure
            if (!this.validateProgress(parsed)) {
                console.warn('Invalid progress data structure, resetting to default');
                this.clearProgress();
                return this.getDefaultProgress();
            }
            
            // Handle version mismatch
            if (parsed.version !== this.VERSION) {
                console.log('Progress data version mismatch, migrating...');
                const migrated = this.migrateProgress(parsed);
                if (migrated) {
                    this.saveProgress(migrated);
                    return migrated;
                } else {
                    console.warn('Migration failed, resetting to default');
                    this.clearProgress();
                    return this.getDefaultProgress();
                }
            }
            
            // Convert completedLevels array back to Set
            return {
                version: parsed.version,
                completedLevels: new Set(parsed.completedLevels),
                levelScores: parsed.levelScores,
                totalScore: parsed.totalScore,
                lastPlayedLevel: parsed.lastPlayedLevel,
                timestamp: parsed.timestamp
            };
            
        } catch (error) {
            // Handle corrupted data
            console.error('Error loading progress (corrupted data):', error);
            this.clearProgress();
            return this.getDefaultProgress();
        }
    },
    
    // Validate progress data structure
    validateProgress(data) {
        if (!data || typeof data !== 'object') return false;
        if (typeof data.version !== 'number') return false;
        if (!Array.isArray(data.completedLevels)) return false;
        if (typeof data.levelScores !== 'object') return false;
        if (typeof data.totalScore !== 'number') return false;
        if (typeof data.lastPlayedLevel !== 'number') return false;
        
        // Validate that all completed levels are valid numbers
        for (const level of data.completedLevels) {
            if (typeof level !== 'number' || level < 1) return false;
        }
        
        // Validate that all level scores are valid
        for (const [level, score] of Object.entries(data.levelScores)) {
            if (isNaN(parseInt(level)) || typeof score !== 'number' || score < 0) {
                return false;
            }
        }
        
        return true;
    },
    
    // Migrate progress data from older versions
    migrateProgress(oldData) {
        // Currently only version 1 exists, but this allows for future migrations
        if (oldData.version < 1) {
            // Migrate from pre-version format (if it existed)
            return null;
        }
        
        // No migration needed for version 1
        return oldData;
    },
    
    // Get default progress state
    getDefaultProgress() {
        return {
            version: this.VERSION,
            completedLevels: new Set(),
            levelScores: {},
            totalScore: 0,
            lastPlayedLevel: 1,
            timestamp: new Date().toISOString()
        };
    },
    
    // Clear progress data
    clearProgress() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing progress:', error);
        }
    }
};

// LevelProgressionManager - Tracks level completion and unlocking
const LevelProgressionManager = {
    totalLevels: 8,
    completedLevels: new Set(),
    levelScores: {},
    
    // Initialize from storage
    init() {
        const progress = ProgressStorage.loadProgress();
        this.completedLevels = progress.completedLevels;
        this.levelScores = progress.levelScores;
    },
    
    // Mark level as completed
    completeLevel(levelNumber, score) {
        // Add to completed set
        this.completedLevels.add(levelNumber);
        
        // Update best score if higher
        if (!this.levelScores[levelNumber] || score > this.levelScores[levelNumber]) {
            this.levelScores[levelNumber] = score;
        }
        
        // Calculate total score
        const totalScore = Object.values(this.levelScores).reduce((sum, s) => sum + s, 0);
        
        // Save to storage
        ProgressStorage.saveProgress({
            completedLevels: this.completedLevels,
            levelScores: this.levelScores,
            totalScore: totalScore,
            lastPlayedLevel: levelNumber
        });
    },
    
    // Check if level is unlocked
    isLevelUnlocked(levelNumber) {
        // Level 1 always unlocked
        if (levelNumber === 1) {
            return true;
        }
        
        // Other levels unlocked if previous level completed
        return this.completedLevels.has(levelNumber - 1);
    },
    
    // Check if level is completed
    isLevelCompleted(levelNumber) {
        return this.completedLevels.has(levelNumber);
    },
    
    // Get best score for level
    getBestScore(levelNumber) {
        return this.levelScores[levelNumber] || 0;
    },
    
    // Reset all progress
    resetProgress() {
        this.completedLevels.clear();
        this.levelScores = {};
        ProgressStorage.clearProgress();
    }
};

// LevelGenerator - Creates level configurations with difficulty scaling
const LevelGenerator = {
    // Seeded random number generator for deterministic generation
    createSeededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    },
    
    // Calculate difficulty multiplier based on level number
    getDifficultyMultiplier(levelNumber) {
        // Scale from 1.0 (level 1) to 2.0 (level 8)
        const minDifficulty = 1.0;
        const maxDifficulty = 2.0;
        const maxLevel = 8;
        
        return minDifficulty + ((levelNumber - 1) / (maxLevel - 1)) * (maxDifficulty - minDifficulty);
    },
    
    // Generate complete level configuration
    generateLevel(levelNumber) {
        // Validate level number
        if (levelNumber < 1 || levelNumber > 8) {
            console.warn(`Invalid level number ${levelNumber}, defaulting to 1`);
            levelNumber = 1;
        }
        
        // Create seeded random function
        const random = this.createSeededRandom(levelNumber * 1000);
        
        // Calculate difficulty
        const difficulty = this.getDifficultyMultiplier(levelNumber);
        
        // Generate level components
        const platforms = this.generatePlatforms(levelNumber, difficulty, random);
        const enemies = this.generateEnemies(levelNumber, difficulty, platforms, random);
        const collectibles = this.generateCollectibles(levelNumber, platforms, random);
        const endFlag = this.generateEndFlag(platforms);
        
        return {
            levelNumber: levelNumber,
            platforms: platforms,
            enemies: enemies,
            collectibles: collectibles,
            endFlag: endFlag,
            backgroundSeed: levelNumber
        };
    },
    
    // Generate platform layout with increasing gap distances
    generatePlatforms(levelNumber, difficulty, random) {
        const platforms = [];
        
        // Base parameters
        const baseGapSize = 100;
        const gapIncrease = 50 * (difficulty - 1); // Increases with difficulty
        const platformCount = 12 - Math.floor(difficulty * 2); // Fewer platforms at higher difficulty
        const levelLength = 3000;
        
        let currentX = 0;
        
        for (let i = 0; i < platformCount; i++) {
            // Calculate platform width (varies between 150-400)
            const platformWidth = 150 + random() * 250;
            
            // Determine if this is a ground or raised platform
            const isRaised = random() > 0.6; // 40% chance of raised platform
            const platformY = isRaised ? 400 - random() * 150 : 550; // Raised platforms between 250-400, ground at 550
            const platformHeight = isRaised ? 20 : 50;
            
            // Add platform
            platforms.push({
                x: currentX,
                y: platformY,
                width: platformWidth,
                height: platformHeight
            });
            
            // Calculate gap to next platform (increases with difficulty)
            // Reduced random variance to ensure monotonic gap scaling
            const gapSize = baseGapSize + gapIncrease + random() * 30;
            currentX += platformWidth + gapSize;
        }
        
        // Ensure level ends with a solid platform for the flag
        platforms.push({
            x: currentX,
            y: 550,
            width: 300,
            height: 50
        });
        
        return platforms;
    },
    
    // Generate collectible placements (coins and extra lives)
    generateCollectibles(levelNumber, platforms, random) {
        const collectibles = [];
        
        // Generate coins on and above platforms
        platforms.forEach((platform, index) => {
            // Skip some platforms at higher difficulty (fewer safe platforms)
            const skipChance = 0.1 * (this.getDifficultyMultiplier(levelNumber) - 1);
            if (random() < skipChance) return;
            
            // Number of coins on this platform (1-4)
            const coinCount = Math.floor(1 + random() * 3);
            
            for (let i = 0; i < coinCount; i++) {
                const coinX = platform.x + (platform.width / (coinCount + 1)) * (i + 1);
                const coinY = platform.y - 50; // Above platform
                
                collectibles.push({
                    type: 'coin',
                    x: coinX,
                    y: coinY,
                    width: 20,
                    height: 20,
                    collected: false
                });
            }
        });
        
        // Add extra lives (1-2 per level)
        const extraLifeCount = levelNumber <= 3 ? 2 : 1; // More lives in early levels
        for (let i = 0; i < extraLifeCount; i++) {
            // Place on a random raised platform
            const raisedPlatforms = platforms.filter(p => p.y < 500);
            if (raisedPlatforms.length > 0) {
                const platform = raisedPlatforms[Math.floor(random() * raisedPlatforms.length)];
                collectibles.push({
                    type: 'extraLife',
                    x: platform.x + platform.width / 2,
                    y: platform.y - 50,
                    width: 25,
                    height: 25,
                    collected: false
                });
            }
        }
        
        return collectibles;
    },
    
    // Generate enemy placements with increasing density
    generateEnemies(levelNumber, difficulty, platforms, random) {
        const enemies = [];
        
        // Calculate enemy count based on difficulty (2-8 enemies)
        const baseEnemyCount = 2;
        const enemyCount = Math.floor(baseEnemyCount + (difficulty - 1) * 3);
        
        // Filter out the last platform (where the flag is) and very short platforms
        const validPlatforms = platforms.filter((p, idx) => 
            idx < platforms.length - 1 && p.width > 100
        );
        
        if (validPlatforms.length === 0) return enemies;
        
        // Enemy type distribution (mix types as difficulty increases)
        const enemyTypes = ['ground', 'plasma', 'jumping'];
        
        for (let i = 0; i < enemyCount; i++) {
            // Select a random platform
            const platformIndex = Math.floor(random() * validPlatforms.length);
            const platform = validPlatforms[platformIndex];
            
            // Choose enemy type (more variety at higher difficulties)
            let enemyType;
            if (difficulty < 1.3) {
                // Early levels: mostly ground enemies
                enemyType = random() < 0.8 ? 'ground' : 'jumping';
            } else if (difficulty < 1.6) {
                // Mid levels: mix of all types
                const typeIndex = Math.floor(random() * 3);
                enemyType = enemyTypes[typeIndex];
            } else {
                // Late levels: more plasma and jumping enemies
                enemyType = random() < 0.4 ? 'ground' : (random() < 0.5 ? 'plasma' : 'jumping');
            }
            
            // Generate enemy based on type
            if (enemyType === 'ground') {
                // Ground enemy patrols along platform
                const patrolWidth = Math.min(platform.width * 0.6, 200);
                const patrolStart = platform.x + (platform.width - patrolWidth) / 2;
                const patrolEnd = patrolStart + patrolWidth;
                
                enemies.push({
                    type: 'ground',
                    x: patrolStart + patrolWidth / 2,
                    y: platform.y - 30,
                    width: 30,
                    height: 30,
                    patrolStart: patrolStart,
                    patrolEnd: patrolEnd,
                    speed: 1 + random() * 0.5,
                    direction: random() < 0.5 ? 1 : -1,
                    alive: true
                });
            } else if (enemyType === 'plasma') {
                // Plasma shooter stays in one place
                enemies.push({
                    type: 'plasma',
                    x: platform.x + platform.width / 2,
                    y: platform.y - 35,
                    width: 35,
                    height: 35,
                    range: 300 + random() * 200,
                    fireRate: 120 - Math.floor(difficulty * 20), // Faster at higher difficulty
                    fireTimer: Math.floor(random() * 60),
                    alive: true
                });
            } else if (enemyType === 'jumping') {
                // Jumping enemy with random timing
                const minJumpInterval = Math.max(60, 120 - Math.floor(difficulty * 20));
                const maxJumpInterval = Math.max(120, 180 - Math.floor(difficulty * 20));
                
                enemies.push({
                    type: 'jumping',
                    x: platform.x + platform.width / 2,
                    y: platform.y - 28,
                    width: 28,
                    height: 28,
                    jumpInterval: [minJumpInterval, maxJumpInterval],
                    jumpTimer: minJumpInterval + Math.floor(random() * (maxJumpInterval - minJumpInterval)),
                    velocityX: 0,
                    velocityY: 0,
                    onGround: true,
                    alive: true
                });
            }
        }
        
        return enemies;
    },
    
    // Generate end flag position
    generateEndFlag(platforms) {
        // Place flag on the last platform
        const lastPlatform = platforms[platforms.length - 1];
        
        return {
            x: lastPlatform.x + lastPlatform.width - 100,
            y: lastPlatform.y - 80,
            width: 40,
            height: 80
        };
    }
};

// GroundEnemy - Patrols horizontally along platforms
class GroundEnemy {
    constructor(x, y, patrolStart, patrolEnd, speed = 1.5) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.patrolStart = patrolStart;
        this.patrolEnd = patrolEnd;
        this.speed = speed;
        this.direction = 1; // 1 for right, -1 for left
        this.velocityY = 0;
        this.gravity = 0.5;
        this.onGround = false;
        this.alive = true;
        this.type = 'ground';
    }
    
    update(platforms) {
        if (!this.alive) return;
        
        // Horizontal patrol movement
        this.x += this.speed * this.direction;
        
        // Direction reversal at patrol boundaries
        if (this.x >= this.patrolEnd || this.x <= this.patrolStart) {
            this.direction *= -1;
        }
        
        // Apply gravity
        this.velocityY += this.gravity;
        this.y += this.velocityY;
        
        // Reset ground state
        this.onGround = false;
        
        // Check platform collisions to keep enemy on platforms
        platforms.forEach(platform => {
            if (this.checkCollision(platform)) {
                // Landing on top
                if (this.velocityY > 0 && this.y + this.height - this.velocityY <= platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                }
            }
        });
    }
    
    render(ctx, camera) {
        if (!this.alive) return;
        
        // Draw enemy body (red rectangle)
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
        
        // Draw eyes (white rectangles)
        ctx.fillStyle = '#FFF';
        ctx.fillRect(this.x - camera.x + 5, this.y + 5, 8, 8);
        ctx.fillRect(this.x - camera.x + 17, this.y + 5, 8, 8);
    }
    
    checkCollision(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }
    
    checkPlayerCollision(player) {
        if (!this.alive) return null;
        
        if (this.checkCollision(player)) {
            // Check if player is coming from above (defeat from above)
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= this.y + 10) {
                return 'defeat'; // Player defeats enemy from above
            } else {
                return 'damage'; // Player takes damage from sides/below
            }
        }
        
        return null;
    }
    
    defeat() {
        this.alive = false;
    }
}

// Projectile - Plasma projectile fired by PlasmaShooter
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
        if (!this.active) return;
        
        // Move in straight line
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        // Check if off-screen (with some margin)
        const margin = 100;
        if (this.x < -margin || this.x > 3000 + margin || 
            this.y < -margin || this.y > 700 + margin) {
            this.active = false;
        }
    }
    
    render(ctx, camera) {
        if (!this.active) return;
        
        // Draw glowing projectile
        ctx.save();
        
        // Outer glow
        ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    checkCollision(rect) {
        if (!this.active) return false;
        
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }
    
    checkPlayerCollision(player) {
        if (!this.active) return false;
        
        return this.checkCollision(player);
    }
    
    deactivate() {
        this.active = false;
    }
}

// PlasmaShooter - Stationary enemy that fires projectiles
class PlasmaShooter {
    constructor(x, y, range, fireRate) {
        this.x = x;
        this.y = y;
        this.width = 35;
        this.height = 35;
        this.range = range;
        this.fireRate = fireRate;
        this.fireTimer = 0;
        this.alive = true;
        this.type = 'plasma';
    }
    
    update(player, projectiles) {
        if (!this.alive) return;
        
        // Check if player is in range
        const distanceToPlayer = Math.abs(player.x - this.x);
        
        if (distanceToPlayer <= this.range) {
            // Update fire timer
            this.fireTimer++;
            
            // Fire projectile when timer expires
            if (this.fireTimer >= this.fireRate) {
                const projectile = this.fireProjectile(player.x + player.width / 2, player.y + player.height / 2);
                projectiles.push(projectile);
                this.fireTimer = 0;
            }
        }
    }
    
    fireProjectile(targetX, targetY) {
        // Calculate direction to target
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize and set speed
        const speed = 3;
        const velocityX = (dx / distance) * speed;
        const velocityY = (dy / distance) * speed;
        
        return new Projectile(this.x, this.y, velocityX, velocityY);
    }
    
    render(ctx, camera) {
        if (!this.alive) return;
        
        // Draw enemy body (purple/pink rectangle)
        ctx.fillStyle = '#9B59B6';
        ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
        
        // Draw cannon/turret indicator
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(this.x - camera.x + 10, this.y + 10, 15, 15);
        
        // Draw eyes
        ctx.fillStyle = '#FFF';
        ctx.fillRect(this.x - camera.x + 5, this.y + 5, 6, 6);
        ctx.fillRect(this.x - camera.x + 24, this.y + 5, 6, 6);
    }
    
    checkCollision(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }
    
    defeat() {
        this.alive = false;
    }
}

// JumpingEnemy - Jumps randomly with unpredictable movement
class JumpingEnemy {
    constructor(x, y, jumpInterval) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 28;
        this.jumpInterval = jumpInterval; // [min, max] frames
        this.jumpTimer = this.getRandomJumpTime();
        this.velocityX = 0;
        this.velocityY = 0;
        this.gravity = 0.5;
        this.onGround = false;
        this.alive = true;
        this.type = 'jumping';
    }
    
    update(platforms) {
        if (!this.alive) return;
        
        // Update jump timer
        this.jumpTimer--;
        
        // Jump when timer expires and on ground
        if (this.jumpTimer <= 0 && this.onGround) {
            this.jump();
            this.jumpTimer = this.getRandomJumpTime();
        }
        
        // Apply gravity
        this.velocityY += this.gravity;
        
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        // Apply friction to horizontal velocity
        this.velocityX *= 0.95;
        
        // Reset ground state
        this.onGround = false;
        
        // Check platform collisions
        platforms.forEach(platform => {
            if (this.checkCollision(platform)) {
                // Landing on top
                if (this.velocityY > 0 && this.y + this.height - this.velocityY <= platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                }
            }
        });
    }
    
    jump() {
        // Apply random horizontal velocity (-3 to 3)
        this.velocityX = (Math.random() - 0.5) * 6;
        
        // Apply upward velocity
        this.velocityY = -10;
        
        this.onGround = false;
    }
    
    getRandomJumpTime() {
        // Return random value in jumpInterval range
        const min = this.jumpInterval[0];
        const max = this.jumpInterval[1];
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    render(ctx, camera) {
        if (!this.alive) return;
        
        // Draw enemy body (green rectangle)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
        
        // Draw eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - camera.x + 5, this.y + 5, 6, 6);
        ctx.fillRect(this.x - camera.x + 17, this.y + 5, 6, 6);
        
        // Draw mouth (jumping indicator)
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - camera.x + 8, this.y + 18, 12, 3);
    }
    
    checkCollision(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }
    
    checkPlayerCollision(player) {
        if (!this.alive) return null;
        
        if (this.checkCollision(player)) {
            // Check if player is coming from above (defeat from above)
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= this.y + 10) {
                return 'defeat'; // Player defeats enemy from above
            } else {
                return 'damage'; // Player takes damage from sides/below
            }
        }
        
        return null;
    }
    
    defeat() {
        this.alive = false;
    }
}

// LeaderboardAPI - Handles communication with backend API
const LeaderboardAPI = {
    BASE_URL: '/api/leaderboard',
    TIMEOUT_MS: 5000,
    
    // Submit score to backend
    async submitScore(score, playerName) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
            
            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    score: score,
                    playerName: playerName
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                // Handle different error status codes
                if (response.status >= 500) {
                    throw new Error('Server error - leaderboard service temporarily unavailable');
                } else if (response.status === 429) {
                    throw new Error('Too many requests - please wait a moment');
                } else if (response.status === 400) {
                    throw new Error('Invalid score data');
                } else {
                    throw new Error(`Failed to submit score (${response.status})`);
                }
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            return this.handleError(error);
        }
    },
    
    // Get top leaderboard entries
    async getLeaderboard(limit = 10) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
            
            const response = await fetch(`${this.BASE_URL}?limit=${limit}`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                // Handle different error status codes
                if (response.status >= 500) {
                    throw new Error('Server error - leaderboard service temporarily unavailable');
                } else {
                    throw new Error(`Failed to fetch leaderboard (${response.status})`);
                }
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            return this.handleError(error);
        }
    },
    
    // Handle API errors
    handleError(error) {
        let userMessage;
        
        if (error.name === 'AbortError') {
            userMessage = 'Request timed out - please check your connection';
            console.error('API timeout:', error);
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            userMessage = 'Unable to connect to leaderboard server - please check your connection';
            console.error('Network error:', error);
        } else if (error.message) {
            userMessage = error.message;
            console.error('API error:', error);
        } else {
            userMessage = 'An unexpected error occurred';
            console.error('Unknown error:', error);
        }
        
        // Return error object that can be checked by caller
        return {
            error: true,
            message: userMessage
        };
    }
};

// LeaderboardUI - Manages leaderboard display interface
const LeaderboardUI = {
    currentSessionId: null,
    
    // Show leaderboard
    async show(currentScore, currentSessionId) {
        this.currentSessionId = currentSessionId;
        const overlay = document.getElementById('leaderboardOverlay');
        const content = document.getElementById('leaderboardContent');
        
        // Show loading state
        content.innerHTML = '<div class="loading">Loading leaderboard...</div>';
        overlay.classList.remove('hidden');
        
        // Fetch leaderboard data
        const result = await LeaderboardAPI.getLeaderboard(10);
        
        if (result.error) {
            this.showError(result.message);
            return;
        }
        
        // Render leaderboard
        this.renderLeaderboard(result, currentScore);
    },
    
    // Render leaderboard entries
    renderLeaderboard(entries, currentScore) {
        const content = document.getElementById('leaderboardContent');
        
        if (!entries || entries.length === 0) {
            content.innerHTML = '<div class="empty">No scores yet. Be the first!</div>';
            return;
        }
        
        let html = '<div class="leaderboard-list">';
        html += '<h2>Top Scores</h2>';
        html += '<div class="leaderboard-entries">';
        
        entries.forEach((entry, index) => {
            const isCurrent = entry.id === this.currentSessionId;
            html += this.formatEntry(entry, index + 1, isCurrent);
        });
        
        html += '</div>';
        html += '</div>';
        
        content.innerHTML = html;
    },
    
    // Format a single leaderboard entry
    formatEntry(entry, rank, isCurrent) {
        const highlightClass = isCurrent ? 'current-session' : '';
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        return `
            <div class="leaderboard-entry ${highlightClass}">
                <span class="rank">#${rank}</span>
                <span class="player-name">${this.escapeHtml(entry.playerName)}</span>
                <span class="score">${entry.score}</span>
                <span class="date">${dateStr}</span>
            </div>
        `;
    },
    
    // Show error message
    showError(message) {
        const content = document.getElementById('leaderboardContent');
        content.innerHTML = `
            <div class="error">
                <p>${this.escapeHtml(message)}</p>
                <button onclick="LeaderboardUI.retry()">Retry</button>
                <button onclick="LeaderboardUI.hide()">Close</button>
            </div>
        `;
    },
    
    // Retry loading leaderboard
    async retry() {
        const content = document.getElementById('leaderboardContent');
        content.innerHTML = '<div class="loading">Loading leaderboard...</div>';
        
        const result = await LeaderboardAPI.getLeaderboard(10);
        
        if (result.error) {
            this.showError(result.message);
        } else {
            this.renderLeaderboard(result, null);
        }
    },
    
    // Hide leaderboard
    hide() {
        const overlay = document.getElementById('leaderboardOverlay');
        overlay.classList.add('hidden');
    },
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ParticleSystem - Manages all particle effects
const ParticleSystem = {
    particles: [],
    MAX_PARTICLES: 500,
    
    // Create a new particle
    createParticle(config) {
        const particle = {
            x: config.x || 0,
            y: config.y || 0,
            velocityX: config.velocityX || 0,
            velocityY: config.velocityY || 0,
            size: config.size || 5,
            color: config.color || '#FFF',
            opacity: config.opacity !== undefined ? config.opacity : 1.0,
            fadeRate: config.fadeRate || 0.02,
            rotation: config.rotation || 0,
            rotationSpeed: config.rotationSpeed || 0,
            type: config.type || 'generic',
            lifetime: 0
        };
        
        // Enforce particle limit - remove oldest particles if at limit
        if (this.particles.length >= this.MAX_PARTICLES) {
            this.particles.shift(); // Remove oldest particle
        }
        
        this.particles.push(particle);
        return particle;
    },
    
    // Update all particles
    update() {
        // Update each particle
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Apply gravity to confetti particles
            if (particle.type === 'confetti') {
                particle.velocityY += 0.15; // Gravity effect
            }
            
            // Update position
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            
            // Update opacity
            particle.opacity -= particle.fadeRate;
            
            // Update rotation
            particle.rotation += particle.rotationSpeed;
            
            // Increment lifetime
            particle.lifetime++;
        }
        
        // Remove dead particles (opacity <= 0 or confetti off-screen)
        this.particles = this.particles.filter(particle => {
            if (particle.opacity <= 0) return false;
            // Remove confetti that falls below visible screen
            if (particle.type === 'confetti' && particle.y > 700) return false;
            return true;
        });
    },
    
    // Render all particles
    render(ctx, camera) {
        for (const particle of this.particles) {
            ctx.save();
            
            // Apply camera offset
            const screenX = particle.x - camera.x;
            const screenY = particle.y;
            
            // Set opacity
            ctx.globalAlpha = particle.opacity;
            
            // Apply rotation if needed
            if (particle.rotation !== 0) {
                ctx.translate(screenX, screenY);
                ctx.rotate(particle.rotation);
                ctx.translate(-screenX, -screenY);
            }
            
            // Draw particle
            ctx.fillStyle = particle.color;
            ctx.fillRect(
                screenX - particle.size / 2,
                screenY - particle.size / 2,
                particle.size,
                particle.size
            );
            
            ctx.restore();
        }
    },
    
    // Create trail particle effect
    createTrail(x, y) {
        this.createParticle({
            x: x,
            y: y,
            velocityX: 0,
            velocityY: 0,
            size: 6,
            color: '#790ECB', // Kiro purple
            opacity: 0.6,
            fadeRate: 0.03,
            rotation: 0,
            rotationSpeed: 0,
            type: 'trail'
        });
    },
    
    // Create explosion particle effect
    createExplosion(x, y) {
        // Spawn 8-12 particles radiating outward
        const particleCount = Math.floor(Math.random() * 5) + 8; // 8-12 particles
        
        for (let i = 0; i < particleCount; i++) {
            // Calculate angle for even distribution
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 2; // Random speed 2-4
            
            this.createParticle({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                size: 4 + Math.random() * 4, // Size 4-8
                color: ['#FF0000', '#FF6600', '#FFAA00', '#FF3300'][Math.floor(Math.random() * 4)], // Red/orange colors
                opacity: 1.0,
                fadeRate: 0.025,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                type: 'explosion'
            });
        }
    },
    
    // Create sparkle particle effect
    createSparkle(x, y) {
        // Spawn 5-10 particles with upward motion
        const particleCount = Math.floor(Math.random() * 6) + 5; // 5-10 particles
        
        for (let i = 0; i < particleCount; i++) {
            // Random angle with upward bias
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // Upward cone
            const speed = 1 + Math.random() * 2; // Speed 1-3
            
            this.createParticle({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                size: 3 + Math.random() * 4, // Varying sizes 3-7
                color: ['#FFD700', '#FFA500', '#FFFF00', '#FFE4B5'][Math.floor(Math.random() * 4)], // Gold/yellow colors
                opacity: 1.0,
                fadeRate: 0.02 + Math.random() * 0.01, // Varying fade rates
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3, // Rotation for sparkle effect
                type: 'sparkle'
            });
        }
    },
    
    // Create confetti particle effect
    createConfetti() {
        // Spawn 20-30 particles across screen
        const particleCount = Math.floor(Math.random() * 11) + 20; // 20-30 particles
        
        // Multiple colors for confetti
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#790ECB'];
        
        for (let i = 0; i < particleCount; i++) {
            // Spawn across the screen width (relative to camera)
            const spawnX = camera.x + Math.random() * canvas.width;
            const spawnY = -20 - Math.random() * 100; // Start above screen
            
            this.createParticle({
                x: spawnX,
                y: spawnY,
                velocityX: (Math.random() - 0.5) * 2, // Slight horizontal drift
                velocityY: 2 + Math.random() * 2, // Falling motion (2-4)
                size: 4 + Math.random() * 4, // Varying sizes 4-8
                color: colors[Math.floor(Math.random() * colors.length)], // Random color
                opacity: 1.0,
                fadeRate: 0.005, // Slow fade for longer visibility
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.4, // Varying rotation speeds
                type: 'confetti'
            });
        }
    },
    
    // Clear all particles (for testing/reset)
    clear() {
        this.particles = [];
    }
};

// JumpController - Manages double jump mechanic
const JumpController = {
    // Handle jump input
    handleJump(player, keys) {
        // Check if jump button is pressed
        const jumpPressed = keys['ArrowUp'] || keys['w'] || keys[' '];
        
        if (jumpPressed && player.jumpsRemaining > 0) {
            // Apply jump velocity
            player.velocityY = -player.jumpPower;
            // Decrement available jumps
            player.jumpsRemaining--;
            // Clear ground state since we're jumping
            player.onGround = false;
        }
    },
    
    // Reset jumps when landing
    resetJumps(player) {
        player.jumpsRemaining = 2;
    },
    
    // Check if player can jump
    canJump(player) {
        return player.jumpsRemaining > 0;
    }
};

// AnimationController - Manages flying animation and physics
const AnimationController = {
    // Update animation state based on velocity
    updateState(player) {
        if (player.velocityY < -1) {
            // Ascending - flying up
            player.animationState = 'flying';
        } else if (player.velocityY > 1 && !player.onGround) {
            // Descending - falling
            player.animationState = 'falling';
        } else if (Math.abs(player.velocityX) > 0.5) {
            // Moving horizontally on ground
            player.animationState = 'running';
        } else {
            // Stationary
            player.animationState = 'idle';
        }
    },
    
    // Apply flying physics for floaty feel
    applyFlyingPhysics(player) {
        if (player.onGround) {
            // Reset rotation when on ground
            player.rotation = 0;
            return;
        }
        
        // Apex float effect - reduce gravity when near peak of jump
        if (Math.abs(player.velocityY) < 2) {
            // At apex - apply minimal gravity for float effect
            player.velocityY += player.gravity * 0.3; // 30% of normal gravity
        } else if (player.velocityY > 0) {
            // Descending - apply reduced gravity for floaty feel
            player.velocityY += player.gravity * 0.7; // 70% of normal gravity
        } else {
            // Ascending - normal gravity
            player.velocityY += player.gravity;
        }
        
        // Calculate sprite rotation based on vertical velocity
        // Tilt up when ascending, tilt down when descending
        const maxRotation = Math.PI / 6; // 30 degrees max
        const rotationFactor = player.velocityY / 15; // Scale velocity to rotation
        player.rotation = Math.max(-maxRotation, Math.min(maxRotation, rotationFactor));
    }
};

// Audio Manager - Handles background music and sound effects
const AudioManager = {
    bgMusic: null,
    musicEnabled: true,
    
    // Initialize audio
    init() {
        this.bgMusic = new Audio('/background-music.wav');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.3; // Set to 30% volume
        
        // Load music state from localStorage
        const savedState = localStorage.getItem('musicEnabled');
        if (savedState !== null) {
            this.musicEnabled = JSON.parse(savedState);
        }
    },
    
    // Play background music
    playMusic() {
        if (this.musicEnabled && this.bgMusic) {
            this.bgMusic.play().catch(err => {
                console.log('Audio playback failed:', err);
            });
        }
    },
    
    // Pause background music
    pauseMusic() {
        if (this.bgMusic) {
            this.bgMusic.pause();
        }
    },
    
    // Toggle music on/off
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        localStorage.setItem('musicEnabled', JSON.stringify(this.musicEnabled));
        
        if (this.musicEnabled) {
            this.playMusic();
        } else {
            this.pauseMusic();
        }
        
        return this.musicEnabled;
    },
    
    // Restart music from beginning
    restartMusic() {
        if (this.bgMusic) {
            this.bgMusic.currentTime = 0;
            this.playMusic();
        }
    }
};

// Game state
let gameState = {
    score: 0,
    lives: 3,
    gameOver: false,
    levelComplete: false,
    highScore: 0,
    newHighScore: false,
    confettiTriggered: false
};

// Player
const player = {
    x: 100,
    y: 400,
    width: 40,
    height: 40,
    velocityX: 0,
    velocityY: 0,
    speed: 3.5,
    jumpPower: 12,
    gravity: 0.45,
    friction: 0.8,
    onGround: false,
    jumpsRemaining: 2,  // NEW: Available jumps for double jump mechanic
    trailTimer: 0,      // NEW: Timer for trail particle spawning
    animationState: 'idle',  // NEW: Current animation state (idle, running, flying, falling)
    rotation: 0,        // NEW: Sprite rotation for flying effect
    image: new Image()
};

player.image.src = '/kiro-logo.png';

// Camera
const camera = {
    x: 0,
    y: 0
};

// Keyboard input
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Level data
const platforms = [
    // Ground platforms
    { x: 0, y: 550, width: 400, height: 50 },
    { x: 500, y: 550, width: 300, height: 50 },
    { x: 900, y: 550, width: 400, height: 50 },
    { x: 1400, y: 550, width: 300, height: 50 },
    { x: 1800, y: 550, width: 400, height: 50 },
    { x: 2300, y: 550, width: 500, height: 50 },
    
    // Raised platforms
    { x: 600, y: 400, width: 150, height: 20 },
    { x: 1000, y: 350, width: 150, height: 20 },
    { x: 1500, y: 400, width: 150, height: 20 },
    { x: 2000, y: 300, width: 150, height: 20 },
];

// Moving platforms
const movingPlatforms = [
    { x: 1200, y: 450, width: 120, height: 20, startX: 1200, endX: 1400, speed: 2, direction: 1 },
    { x: 2200, y: 400, width: 120, height: 20, startX: 2200, endX: 2400, speed: 1.5, direction: 1 }
];

// Coins
const coins = [];
// Initialize coins
function initCoins() {
    const coinPositions = [
        { x: 200, y: 500 }, { x: 250, y: 500 }, { x: 300, y: 500 },
        { x: 650, y: 350 }, { x: 700, y: 350 },
        { x: 1050, y: 300 }, { x: 1100, y: 300 },
        { x: 1550, y: 350 }, { x: 1600, y: 350 },
        { x: 2050, y: 250 }, { x: 2100, y: 250 }, { x: 2150, y: 250 },
        { x: 2500, y: 500 }, { x: 2550, y: 500 }, { x: 2600, y: 500 }
    ];
    
    coinPositions.forEach(pos => {
        coins.push({ x: pos.x, y: pos.y, width: 20, height: 20, collected: false });
    });
}

// Extra lives (Pacman sprites)
const extraLives = [
    { x: 1300, y: 400, width: 25, height: 25, collected: false },
    { x: 2300, y: 250, width: 25, height: 25, collected: false }
];

// Enemies
const enemies = [
    { x: 600, y: 520, width: 30, height: 30, startX: 500, endX: 750, speed: 1, direction: 1, alive: true },
    { x: 1100, y: 520, width: 30, height: 30, startX: 900, endX: 1250, speed: 1.5, direction: 1, alive: true },
    { x: 1900, y: 520, width: 30, height: 30, startX: 1800, endX: 2100, speed: 1.2, direction: 1, alive: true }
];

// End flag
const endFlag = { x: 2700, y: 470, width: 40, height: 80 };

// Initialize game
initCoins();
gameState.highScore = StorageManager.getHighScore();
AudioManager.init();

// Update player
function updatePlayer() {
    // Horizontal movement
    if (keys['ArrowLeft'] || keys['a']) {
        player.velocityX = -player.speed;
    } else if (keys['ArrowRight'] || keys['d']) {
        player.velocityX = player.speed;
    } else {
        player.velocityX *= player.friction;
    }
    
    // Jump - use JumpController for double jump mechanic
    const wasJumping = player.jumpsRemaining < 2;
    JumpController.handleJump(player, keys);
    const justDoubleJumped = wasJumping && player.jumpsRemaining === 0;
    
    // Apply flying physics when airborne (replaces normal gravity)
    if (!player.onGround) {
        AnimationController.applyFlyingPhysics(player);
    } else {
        // Normal gravity when on ground (though this shouldn't apply)
        player.velocityY += player.gravity;
    }
    
    // Update animation state
    AnimationController.updateState(player);
    
    // Enhanced visual effect for double jump (spawn extra particles)
    if (justDoubleJumped) {
        // Spawn sparkle effect at player position for double jump
        ParticleSystem.createSparkle(
            player.x + player.width / 2,
            player.y + player.height / 2
        );
    }
    
    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Spawn trail particles when moving horizontally
    const movementThreshold = 0.5; // Minimum velocity to spawn trails
    if (Math.abs(player.velocityX) > movementThreshold) {
        player.trailTimer++;
        // Spawn trail every 3 frames
        if (player.trailTimer >= 3) {
            ParticleSystem.createTrail(
                player.x + player.width / 2,
                player.y + player.height / 2
            );
            player.trailTimer = 0;
        }
    } else {
        player.trailTimer = 0;
    }
    
    // Reset ground state
    player.onGround = false;
    
    // Check platform collisions
    checkPlatformCollisions();
    
    // Check moving platform collisions
    checkMovingPlatformCollisions();
    
    // Prevent falling through bottom
    if (player.y > canvas.height) {
        loseLife();
    }
}

// Check collisions with static platforms
function checkPlatformCollisions() {
    platforms.forEach(platform => {
        if (checkCollision(player, platform)) {
            // Landing on top
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= platform.y) {
                player.y = platform.y - player.height;
                player.velocityY = 0;
                player.onGround = true;
                // Reset jumps when landing
                JumpController.resetJumps(player);
            }
            // Hitting from below
            else if (player.velocityY < 0 && player.y - player.velocityY >= platform.y + platform.height) {
                player.y = platform.y + platform.height;
                player.velocityY = 0;
            }
            // Side collisions
            else if (player.velocityX > 0) {
                player.x = platform.x - player.width;
            } else if (player.velocityX < 0) {
                player.x = platform.x + platform.width;
            }
        }
    });
}

// Check collisions with moving platforms
function checkMovingPlatformCollisions() {
    movingPlatforms.forEach(platform => {
        if (checkCollision(player, platform)) {
            // Landing on top
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= platform.y) {
                player.y = platform.y - player.height;
                player.velocityY = 0;
                player.onGround = true;
                player.x += platform.speed * platform.direction;
                // Reset jumps when landing
                JumpController.resetJumps(player);
            }
        }
    });
}

// Collision detection helper
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Update moving platforms
function updateMovingPlatforms() {
    movingPlatforms.forEach(platform => {
        platform.x += platform.speed * platform.direction;
        
        if (platform.x >= platform.endX || platform.x <= platform.startX) {
            platform.direction *= -1;
        }
    });
}

// Update enemies
function updateEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        enemy.x += enemy.speed * enemy.direction;
        
        if (enemy.x >= enemy.endX || enemy.x <= enemy.startX) {
            enemy.direction *= -1;
        }
        
        // Check collision with player
        if (checkCollision(player, enemy)) {
            // Player jumps on enemy (from above)
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= enemy.y + 10) {
                enemy.alive = false;
                player.velocityY = -8;
                gameState.score += 50;
                updateHUD();
                // Reset jumps when bouncing off enemy
                JumpController.resetJumps(player);
                // No explosion when defeating enemy from above
            } else {
                // Player gets hit from side/below - spawn explosion
                ParticleSystem.createExplosion(
                    player.x + player.width / 2,
                    player.y + player.height / 2
                );
                loseLife();
            }
        }
    });
}

// Check coin collection
function checkCoins() {
    coins.forEach(coin => {
        if (!coin.collected && checkCollision(player, coin)) {
            coin.collected = true;
            gameState.score += 10;
            updateHUD();
            // Spawn sparkle effect at coin position
            ParticleSystem.createSparkle(
                coin.x + coin.width / 2,
                coin.y + coin.height / 2
            );
        }
    });
}

// Check extra life collection
function checkExtraLives() {
    extraLives.forEach(life => {
        if (!life.collected && checkCollision(player, life)) {
            life.collected = true;
            gameState.lives++;
            gameState.score += 100;
            updateHUD();
        }
    });
}

// Check level completion
function checkLevelComplete() {
    if (checkCollision(player, endFlag)) {
        gameState.levelComplete = true;
        document.getElementById('completeScore').textContent = gameState.score;
        document.getElementById('levelComplete').classList.remove('hidden');
    }
}

// Lose a life
function loseLife() {
    gameState.lives--;
    updateHUD();
    
    if (gameState.lives <= 0) {
        gameState.gameOver = true;
        document.getElementById('finalScore').textContent = gameState.score;
        document.getElementById('gameOver').classList.remove('hidden');
    } else {
        // Reset player position
        player.x = 100;
        player.y = 400;
        player.velocityX = 0;
        player.velocityY = 0;
        player.jumpsRemaining = 2;
        player.trailTimer = 0;
        player.animationState = 'idle';
        player.rotation = 0;
    }
}

// Update camera
function updateCamera() {
    camera.x = player.x - canvas.width / 3;
    camera.x = Math.max(0, camera.x);
}

// Update HUD
function updateHUD() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('lives').textContent = gameState.lives;
    document.getElementById('highScore').textContent = gameState.highScore;
    
    // Check if current score exceeds high score
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        if (StorageManager.updateHighScore(gameState.score)) {
            gameState.newHighScore = true;
            // Trigger confetti only once per high score achievement
            if (!gameState.confettiTriggered) {
                ParticleSystem.createConfetti();
                gameState.confettiTriggered = true;
            }
        }
    }
}

// Draw functions
function drawPlayer() {
    ctx.save();
    
    // Apply rotation for flying effect
    if (player.rotation !== 0) {
        const centerX = player.x - camera.x + player.width / 2;
        const centerY = player.y + player.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(player.rotation);
        ctx.translate(-centerX, -centerY);
    }
    
    ctx.drawImage(player.image, player.x - camera.x, player.y, player.width, player.height);
    
    ctx.restore();
}

function drawPlatforms() {
    ctx.fillStyle = '#8B4513';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x - camera.x, platform.y, platform.width, platform.height);
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x - camera.x, platform.y, platform.width, platform.height);
    });
}

function drawMovingPlatforms() {
    ctx.fillStyle = '#FF6347';
    movingPlatforms.forEach(platform => {
        ctx.fillRect(platform.x - camera.x, platform.y, platform.width, platform.height);
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x - camera.x, platform.y, platform.width, platform.height);
    });
}

function drawCoins() {
    coins.forEach(coin => {
        if (!coin.collected) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(coin.x + coin.width/2 - camera.x, coin.y + coin.height/2, coin.width/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

function drawExtraLives() {
    extraLives.forEach(life => {
        if (!life.collected) {
            // Draw Pacman-style sprite
            ctx.fillStyle = '#FFFF00';
            ctx.beginPath();
            ctx.arc(life.x + life.width/2 - camera.x, life.y + life.height/2, life.width/2, 0.2 * Math.PI, 1.8 * Math.PI);
            ctx.lineTo(life.x + life.width/2 - camera.x, life.y + life.height/2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Eye
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(life.x + life.width/2 - camera.x + 5, life.y + life.height/2 - 3, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        if (enemy.alive) {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(enemy.x - camera.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = '#FFF';
            ctx.fillRect(enemy.x - camera.x + 5, enemy.y + 5, 8, 8);
            ctx.fillRect(enemy.x - camera.x + 17, enemy.y + 5, 8, 8);
        }
    });
}

function drawEndFlag() {
    ctx.fillStyle = '#000';
    ctx.fillRect(endFlag.x - camera.x, endFlag.y, 5, endFlag.height);
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(endFlag.x - camera.x + 5, endFlag.y, 35, 30);
}

// Main game loop
function gameLoop() {
    if (gameState.gameOver || gameState.levelComplete) return;
    
    // Update
    updatePlayer();
    updateMovingPlatforms();
    updateEnemies();
    checkCoins();
    checkExtraLives();
    checkLevelComplete();
    updateCamera();
    ParticleSystem.update(); // Update all particles
    
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw
    drawPlatforms();
    drawMovingPlatforms();
    drawCoins();
    drawExtraLives();
    drawEnemies();
    drawEndFlag();
    drawPlayer();
    ParticleSystem.render(ctx, camera); // Render all particles
    
    requestAnimationFrame(gameLoop);
}

// Show name prompt for leaderboard submission
function showNamePrompt() {
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('levelComplete').classList.add('hidden');
    document.getElementById('namePrompt').classList.remove('hidden');
    document.getElementById('playerNameInput').focus();
    document.getElementById('submitStatus').textContent = '';
}

// Submit score with player name
async function submitScoreWithName() {
    const nameInput = document.getElementById('playerNameInput');
    const playerName = nameInput.value.trim();
    const statusDiv = document.getElementById('submitStatus');
    
    if (!playerName) {
        statusDiv.textContent = 'Please enter your name';
        statusDiv.style.color = '#ff6b6b';
        return;
    }
    
    // Show submitting status
    statusDiv.textContent = 'Submitting...';
    statusDiv.style.color = 'white';
    
    // Submit score to backend
    const result = await LeaderboardAPI.submitScore(gameState.score, playerName);
    
    if (result.error) {
        // Show error but allow retry
        statusDiv.textContent = result.message;
        statusDiv.style.color = '#ff6b6b';
        return;
    }
    
    // Success - hide name prompt and show leaderboard
    document.getElementById('namePrompt').classList.add('hidden');
    
    // Show leaderboard with current session highlighted
    await LeaderboardUI.show(gameState.score, result.id);
}

// Skip leaderboard submission
function skipLeaderboard() {
    document.getElementById('namePrompt').classList.add('hidden');
    restartGame();
}

// Restart game
function restartGame() {
    const currentHighScore = gameState.highScore;
    
    gameState = {
        score: 0,
        lives: 3,
        gameOver: false,
        levelComplete: false,
        highScore: currentHighScore,
        newHighScore: false,
        confettiTriggered: false
    };
    
    player.x = 100;
    player.y = 400;
    player.velocityX = 0;
    player.velocityY = 0;
    player.jumpsRemaining = 2;
    player.trailTimer = 0;
    player.animationState = 'idle';
    player.rotation = 0;
    
    coins.forEach(coin => coin.collected = false);
    extraLives.forEach(life => life.collected = false);
    enemies.forEach(enemy => enemy.alive = true);
    
    ParticleSystem.clear(); // Clear all particles on restart
    
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('levelComplete').classList.add('hidden');
    document.getElementById('namePrompt').classList.add('hidden');
    document.getElementById('leaderboardOverlay').classList.add('hidden');
    
    AudioManager.restartMusic();
    updateHUD();
    gameLoop();
}

// Toggle music (can be called from UI)
function toggleMusic() {
    const enabled = AudioManager.toggleMusic();
    const button = document.getElementById('musicToggle');
    if (button) {
        button.textContent = enabled ? '🔊 Music On' : '🔇 Music Off';
    }
}

// Start game on first user interaction (required for autoplay)
let gameStarted = false;
function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        AudioManager.playMusic();
        updateHUD();
        gameLoop();
        document.removeEventListener('keydown', startGame);
        document.removeEventListener('click', startGame);
    }
}

// Wait for user interaction before starting
document.addEventListener('keydown', startGame);
document.addEventListener('click', startGame);

// Show initial message
updateHUD();
