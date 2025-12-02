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
