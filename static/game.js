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
        
        // Remove dead particles (opacity <= 0)
        this.particles = this.particles.filter(particle => particle.opacity > 0);
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
    JumpController.handleJump(player, keys);
    
    // Apply gravity
    player.velocityY += player.gravity;
    
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
        }
    }
}

// Draw functions
function drawPlayer() {
    ctx.drawImage(player.image, player.x - camera.x, player.y, player.width, player.height);
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
