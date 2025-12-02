const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// Game state
let gameState = {
    score: 0,
    lives: 3,
    gameOver: false,
    levelComplete: false
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
    
    // Jump
    if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && player.onGround) {
        player.velocityY = -player.jumpPower;
        player.onGround = false;
    }
    
    // Apply gravity
    player.velocityY += player.gravity;
    
    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
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
            // Player jumps on enemy
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= enemy.y + 10) {
                enemy.alive = false;
                player.velocityY = -8;
                gameState.score += 50;
                updateHUD();
            } else {
                // Player gets hit
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
    
    requestAnimationFrame(gameLoop);
}

// Restart game
function restartGame() {
    gameState = {
        score: 0,
        lives: 3,
        gameOver: false,
        levelComplete: false
    };
    
    player.x = 100;
    player.y = 400;
    player.velocityX = 0;
    player.velocityY = 0;
    
    coins.forEach(coin => coin.collected = false);
    extraLives.forEach(life => life.collected = false);
    enemies.forEach(enemy => enemy.alive = true);
    
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('levelComplete').classList.add('hidden');
    
    updateHUD();
    gameLoop();
}

// Start game
updateHUD();
gameLoop();
