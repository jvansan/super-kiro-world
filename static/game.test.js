import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock localStorage for testing
class LocalStorageMock {
    constructor() {
        this.store = {};
    }

    clear() {
        this.store = {};
    }

    getItem(key) {
        return this.store[key] || null;
    }

    setItem(key, value) {
        this.store[key] = String(value);
    }

    removeItem(key) {
        delete this.store[key];
    }
}

// StorageManager implementation (copied from game.js for testing)
const StorageManager = {
    HIGH_SCORE_KEY: 'superKiroWorld_highScore',
    
    getHighScore() {
        try {
            const stored = localStorage.getItem(this.HIGH_SCORE_KEY);
            if (stored === null) {
                return 0;
            }
            const parsed = JSON.parse(stored);
            if (typeof parsed === 'number' && parsed >= 0) {
                return parsed;
            }
            console.warn('Corrupted high score data, resetting to 0');
            this.clearHighScore();
            return 0;
        } catch (error) {
            console.error('Error reading high score:', error);
            this.clearHighScore();
            return 0;
        }
    },
    
    updateHighScore(newScore) {
        try {
            const currentHighScore = this.getHighScore();
            if (newScore > currentHighScore) {
                localStorage.setItem(this.HIGH_SCORE_KEY, JSON.stringify(newScore));
                return true;
            }
            return false;
        } catch (error) {
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
    
    clearHighScore() {
        try {
            localStorage.removeItem(this.HIGH_SCORE_KEY);
        } catch (error) {
            console.error('Error clearing high score:', error);
        }
    }
};

describe('StorageManager', () => {
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        global.localStorage = new LocalStorageMock();
        // Suppress console output during tests
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        global.localStorage.clear();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    /**
     * **Feature: game-enhancements, Property 2: High score monotonicity**
     * For any new score that exceeds the current high score, the stored high score
     * should be updated to the new value
     * **Validates: Requirements 1.2**
     */
    it('Property 2: High score monotonicity - high score never decreases', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 1, maxLength: 50 }),
                (scores) => {
                    // Clear storage before test
                    StorageManager.clearHighScore();
                    
                    let maxScoreSeen = 0;
                    
                    for (const score of scores) {
                        StorageManager.updateHighScore(score);
                        const currentHighScore = StorageManager.getHighScore();
                        
                        // Update our tracking of max score
                        if (score > maxScoreSeen) {
                            maxScoreSeen = score;
                        }
                        
                        // Property: high score should equal the maximum score seen so far
                        if (currentHighScore !== maxScoreSeen) {
                            return false;
                        }
                        
                        // Property: high score should never decrease
                        // (This is implied by the above, but we check explicitly)
                        if (currentHighScore < maxScoreSeen) {
                            return false;
                        }
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests
    
    it('should return 0 when retrieving high score from empty storage', () => {
        const highScore = StorageManager.getHighScore();
        expect(highScore).toBe(0);
    });

    it('should update high score when new score is higher', () => {
        StorageManager.clearHighScore();
        
        const result = StorageManager.updateHighScore(100);
        expect(result).toBe(true);
        expect(StorageManager.getHighScore()).toBe(100);
        
        const result2 = StorageManager.updateHighScore(200);
        expect(result2).toBe(true);
        expect(StorageManager.getHighScore()).toBe(200);
    });

    it('should not update high score when new score is lower', () => {
        StorageManager.clearHighScore();
        
        StorageManager.updateHighScore(500);
        expect(StorageManager.getHighScore()).toBe(500);
        
        const result = StorageManager.updateHighScore(300);
        expect(result).toBe(false);
        expect(StorageManager.getHighScore()).toBe(500);
    });

    it('should not update high score when new score is equal', () => {
        StorageManager.clearHighScore();
        
        StorageManager.updateHighScore(500);
        expect(StorageManager.getHighScore()).toBe(500);
        
        const result = StorageManager.updateHighScore(500);
        expect(result).toBe(false);
        expect(StorageManager.getHighScore()).toBe(500);
    });

    it('should handle corrupted JSON data', () => {
        // Manually set corrupted data
        localStorage.setItem(StorageManager.HIGH_SCORE_KEY, 'not valid json{');
        
        const highScore = StorageManager.getHighScore();
        expect(highScore).toBe(0);
        
        // Verify storage was cleared
        expect(localStorage.getItem(StorageManager.HIGH_SCORE_KEY)).toBeNull();
    });

    it('should handle non-numeric data', () => {
        // Set non-numeric data
        localStorage.setItem(StorageManager.HIGH_SCORE_KEY, JSON.stringify('not a number'));
        
        const highScore = StorageManager.getHighScore();
        expect(highScore).toBe(0);
        
        // Verify storage was cleared
        expect(localStorage.getItem(StorageManager.HIGH_SCORE_KEY)).toBeNull();
    });

    it('should handle negative scores', () => {
        // Set negative score
        localStorage.setItem(StorageManager.HIGH_SCORE_KEY, JSON.stringify(-100));
        
        const highScore = StorageManager.getHighScore();
        expect(highScore).toBe(0);
        
        // Verify storage was cleared
        expect(localStorage.getItem(StorageManager.HIGH_SCORE_KEY)).toBeNull();
    });
});

// LeaderboardAPI implementation (copied from game.js for testing)
const LeaderboardAPI = {
    BASE_URL: '/api/leaderboard',
    TIMEOUT_MS: 5000,
    
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
        
        return {
            error: true,
            message: userMessage
        };
    }
};

// JumpController implementation (copied from game.js for testing)
const JumpController = {
    handleJump(player, keys) {
        const jumpPressed = keys['ArrowUp'] || keys['w'] || keys[' '];
        
        if (jumpPressed && player.jumpsRemaining > 0) {
            player.velocityY = -player.jumpPower;
            player.jumpsRemaining--;
            player.onGround = false;
        }
    },
    
    resetJumps(player) {
        player.jumpsRemaining = 2;
    },
    
    canJump(player) {
        return player.jumpsRemaining > 0;
    }
};

describe('JumpController', () => {
    /**
     * **Feature: game-enhancements, Property 9: Jump reset on landing**
     * For any landing event, the double jump availability should be restored to allow two jumps
     * **Validates: Requirements 3.2**
     */
    it('Property 9: Jump reset on landing - landing always resets jump count to 2', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 2 }), // Current jumps remaining (0, 1, or 2)
                (currentJumps) => {
                    // Create a player with arbitrary jumps remaining
                    const player = {
                        jumpsRemaining: currentJumps,
                        velocityY: 0,
                        jumpPower: 12,
                        onGround: false
                    };
                    
                    // Simulate landing by calling resetJumps
                    JumpController.resetJumps(player);
                    
                    // Property: After landing, jumps should always be reset to 2
                    return player.jumpsRemaining === 2;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: game-enhancements, Property 11: Jump power consistency**
     * For any double jump performed, the applied velocity should equal the velocity applied by the initial jump
     * **Validates: Requirements 3.4**
     */
    it('Property 11: Jump power consistency - both jumps apply same velocity', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 5, max: 20 }), // Random jump power
                (jumpPower) => {
                    // Create a player for first jump
                    const player = {
                        jumpsRemaining: 2,
                        velocityY: 0,
                        jumpPower: jumpPower,
                        onGround: false
                    };
                    
                    // Simulate first jump
                    const keys = { 'ArrowUp': true };
                    JumpController.handleJump(player, keys);
                    const firstJumpVelocity = player.velocityY;
                    
                    // Reset velocity and simulate second jump
                    player.velocityY = 0;
                    JumpController.handleJump(player, keys);
                    const secondJumpVelocity = player.velocityY;
                    
                    // Property: Both jumps should apply the same velocity (negative jumpPower)
                    return firstJumpVelocity === secondJumpVelocity && 
                           firstJumpVelocity === -jumpPower;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests

    it('should allow jump when player has jumps remaining after landing', () => {
        const player = {
            jumpsRemaining: 2,
            velocityY: 0,
            jumpPower: 12,
            onGround: true
        };
        const keys = { 'ArrowUp': true };

        JumpController.handleJump(player, keys);

        expect(player.velocityY).toBe(-12);
        expect(player.jumpsRemaining).toBe(1);
        expect(player.onGround).toBe(false);
    });

    it('should deplete jumps after two jumps', () => {
        const player = {
            jumpsRemaining: 2,
            velocityY: 0,
            jumpPower: 12,
            onGround: false
        };
        const keys = { 'ArrowUp': true };

        // First jump
        JumpController.handleJump(player, keys);
        expect(player.jumpsRemaining).toBe(1);

        // Second jump
        player.velocityY = 0;
        JumpController.handleJump(player, keys);
        expect(player.jumpsRemaining).toBe(0);
    });

    it('should ignore jump when jumps are exhausted', () => {
        const player = {
            jumpsRemaining: 0,
            velocityY: 5,
            jumpPower: 12,
            onGround: false
        };
        const keys = { 'ArrowUp': true };

        JumpController.handleJump(player, keys);

        // Velocity should remain unchanged
        expect(player.velocityY).toBe(5);
        expect(player.jumpsRemaining).toBe(0);
    });

    it('should allow double jump while falling', () => {
        const player = {
            jumpsRemaining: 2,
            velocityY: 8, // Falling downward
            jumpPower: 12,
            onGround: false
        };
        const keys = { 'ArrowUp': true };

        // Use first jump while falling
        JumpController.handleJump(player, keys);
        expect(player.velocityY).toBe(-12);
        expect(player.jumpsRemaining).toBe(1);

        // Can still use second jump
        player.velocityY = 5;
        JumpController.handleJump(player, keys);
        expect(player.velocityY).toBe(-12);
        expect(player.jumpsRemaining).toBe(0);
    });

    it('should not jump when jump key is not pressed', () => {
        const player = {
            jumpsRemaining: 2,
            velocityY: 0,
            jumpPower: 12,
            onGround: true
        };
        const keys = {}; // No keys pressed

        JumpController.handleJump(player, keys);

        expect(player.velocityY).toBe(0);
        expect(player.jumpsRemaining).toBe(2);
    });

    it('should support multiple jump keys (ArrowUp, w, space)', () => {
        const player = {
            jumpsRemaining: 2,
            velocityY: 0,
            jumpPower: 12,
            onGround: true
        };

        // Test with 'w' key
        JumpController.handleJump(player, { 'w': true });
        expect(player.velocityY).toBe(-12);
        expect(player.jumpsRemaining).toBe(1);

        // Reset and test with space
        player.velocityY = 0;
        player.jumpsRemaining = 2;
        JumpController.handleJump(player, { ' ': true });
        expect(player.velocityY).toBe(-12);
        expect(player.jumpsRemaining).toBe(1);
    });
});

describe('LeaderboardAPI', () => {
    let consoleErrorSpy;
    let fetchMock;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchMock = vi.fn();
        global.fetch = fetchMock;
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    describe('submitScore', () => {
        it('should successfully submit a score', async () => {
            const mockResponse = {
                id: 'test-id-123',
                score: 1000,
                playerName: 'TestPlayer',
                timestamp: '2024-12-02T10:00:00Z'
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => mockResponse
            });

            const result = await LeaderboardAPI.submitScore(1000, 'TestPlayer');

            expect(fetchMock).toHaveBeenCalledWith(
                '/api/leaderboard',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        score: 1000,
                        playerName: 'TestPlayer'
                    })
                })
            );

            expect(result).toEqual(mockResponse);
            expect(result.error).toBeUndefined();
        });

        it('should handle server errors (5xx)', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            const result = await LeaderboardAPI.submitScore(1000, 'TestPlayer');

            expect(result.error).toBe(true);
            expect(result.message).toContain('Server error');
        });

        it('should handle rate limiting (429)', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 429
            });

            const result = await LeaderboardAPI.submitScore(1000, 'TestPlayer');

            expect(result.error).toBe(true);
            expect(result.message).toContain('Too many requests');
        });

        it('should handle bad request (400)', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 400
            });

            const result = await LeaderboardAPI.submitScore(1000, 'TestPlayer');

            expect(result.error).toBe(true);
            expect(result.message).toContain('Invalid score data');
        });

        it('should handle network errors', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));

            const result = await LeaderboardAPI.submitScore(1000, 'TestPlayer');

            expect(result.error).toBe(true);
            expect(result.message).toContain('Unable to connect');
        });

        it('should handle timeout errors', async () => {
            // Mock a timeout by rejecting with AbortError
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            
            fetchMock.mockRejectedValueOnce(abortError);

            const result = await LeaderboardAPI.submitScore(1000, 'TestPlayer');

            expect(result.error).toBe(true);
            expect(result.message).toContain('timed out');
        });
    });

    describe('getLeaderboard', () => {
        it('should successfully retrieve leaderboard', async () => {
            const mockLeaderboard = [
                { id: '1', score: 1000, playerName: 'Player1', timestamp: '2024-12-02T10:00:00Z' },
                { id: '2', score: 900, playerName: 'Player2', timestamp: '2024-12-02T09:00:00Z' }
            ];

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockLeaderboard
            });

            const result = await LeaderboardAPI.getLeaderboard(10);

            expect(fetchMock).toHaveBeenCalledWith(
                '/api/leaderboard?limit=10',
                expect.objectContaining({
                    method: 'GET'
                })
            );

            expect(result).toEqual(mockLeaderboard);
            expect(result.error).toBeUndefined();
        });

        it('should use default limit of 10', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => []
            });

            await LeaderboardAPI.getLeaderboard();

            expect(fetchMock).toHaveBeenCalledWith(
                '/api/leaderboard?limit=10',
                expect.anything()
            );
        });

        it('should handle server errors', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 503
            });

            const result = await LeaderboardAPI.getLeaderboard(10);

            expect(result.error).toBe(true);
            expect(result.message).toContain('Server error');
        });

        it('should handle network errors', async () => {
            fetchMock.mockRejectedValueOnce(new Error('NetworkError'));

            const result = await LeaderboardAPI.getLeaderboard(10);

            expect(result.error).toBe(true);
            expect(result.message).toContain('Unable to connect');
        });

        it('should handle timeout errors', async () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            
            fetchMock.mockRejectedValueOnce(abortError);

            const result = await LeaderboardAPI.getLeaderboard(10);

            expect(result.error).toBe(true);
            expect(result.message).toContain('timed out');
        });
    });
});
