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

// ProgressStorage implementation (copied from game.js for testing)
const ProgressStorage = {
    STORAGE_KEY: 'superKiroWorld_levelProgress',
    VERSION: 1,
    
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
    
    loadProgress() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            
            if (stored === null) {
                return this.getDefaultProgress();
            }
            
            const parsed = JSON.parse(stored);
            
            if (!this.validateProgress(parsed)) {
                console.warn('Invalid progress data structure, resetting to default');
                this.clearProgress();
                return this.getDefaultProgress();
            }
            
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
            
            return {
                version: parsed.version,
                completedLevels: new Set(parsed.completedLevels),
                levelScores: parsed.levelScores,
                totalScore: parsed.totalScore,
                lastPlayedLevel: parsed.lastPlayedLevel,
                timestamp: parsed.timestamp
            };
            
        } catch (error) {
            console.error('Error loading progress (corrupted data):', error);
            this.clearProgress();
            return this.getDefaultProgress();
        }
    },
    
    validateProgress(data) {
        if (!data || typeof data !== 'object') return false;
        if (typeof data.version !== 'number') return false;
        if (!Array.isArray(data.completedLevels)) return false;
        if (typeof data.levelScores !== 'object') return false;
        if (typeof data.totalScore !== 'number') return false;
        if (typeof data.lastPlayedLevel !== 'number') return false;
        
        for (const level of data.completedLevels) {
            if (typeof level !== 'number' || level < 1) return false;
        }
        
        for (const [level, score] of Object.entries(data.levelScores)) {
            if (isNaN(parseInt(level)) || typeof score !== 'number' || score < 0) {
                return false;
            }
        }
        
        return true;
    },
    
    migrateProgress(oldData) {
        if (oldData.version < 1) {
            return null;
        }
        return oldData;
    },
    
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
    
    clearProgress() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing progress:', error);
        }
    }
};

describe('ProgressStorage', () => {
    let consoleErrorSpy;
    let consoleWarnSpy;
    let consoleLogSpy;

    beforeEach(() => {
        global.localStorage = new LocalStorageMock();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        global.localStorage.clear();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    /**
     * **Feature: multi-level-world, Property 36: Completion status persistence**
     * For any level completion, the completion status should be saved to local storage
     * and retrievable after saving
     * **Validates: Requirements 9.1**
     */
    it('Property 36: Completion status persistence - save then load returns same data', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 8 }), { minLength: 0, maxLength: 8 }), // completed levels
                fc.record({
                    1: fc.integer({ min: 0, max: 10000 }),
                    2: fc.integer({ min: 0, max: 10000 }),
                    3: fc.integer({ min: 0, max: 10000 }),
                    4: fc.integer({ min: 0, max: 10000 }),
                    5: fc.integer({ min: 0, max: 10000 }),
                    6: fc.integer({ min: 0, max: 10000 }),
                    7: fc.integer({ min: 0, max: 10000 }),
                    8: fc.integer({ min: 0, max: 10000 })
                }), // level scores
                fc.integer({ min: 0, max: 80000 }), // total score
                fc.integer({ min: 1, max: 8 }), // last played level
                (completedLevels, levelScores, totalScore, lastPlayedLevel) => {
                    ProgressStorage.clearProgress();
                    
                    // Create progress data
                    const progressData = {
                        completedLevels: new Set(completedLevels),
                        levelScores: levelScores,
                        totalScore: totalScore,
                        lastPlayedLevel: lastPlayedLevel
                    };
                    
                    // Save progress
                    const saveResult = ProgressStorage.saveProgress(progressData);
                    if (!saveResult) return false;
                    
                    // Load progress
                    const loadedProgress = ProgressStorage.loadProgress();
                    
                    // Property: Loaded data should match saved data
                    // Check completed levels (convert Set to sorted array for comparison)
                    const savedLevels = Array.from(progressData.completedLevels).sort((a, b) => a - b);
                    const loadedLevels = Array.from(loadedProgress.completedLevels).sort((a, b) => a - b);
                    
                    if (savedLevels.length !== loadedLevels.length) return false;
                    for (let i = 0; i < savedLevels.length; i++) {
                        if (savedLevels[i] !== loadedLevels[i]) return false;
                    }
                    
                    // Check level scores
                    for (const [level, score] of Object.entries(progressData.levelScores)) {
                        if (loadedProgress.levelScores[level] !== score) return false;
                    }
                    
                    // Check other fields
                    if (loadedProgress.totalScore !== progressData.totalScore) return false;
                    if (loadedProgress.lastPlayedLevel !== progressData.lastPlayedLevel) return false;
                    if (loadedProgress.version !== ProgressStorage.VERSION) return false;
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests

    it('should return default progress when storage is empty', () => {
        const progress = ProgressStorage.loadProgress();
        
        expect(progress.version).toBe(1);
        expect(progress.completedLevels).toBeInstanceOf(Set);
        expect(progress.completedLevels.size).toBe(0);
        expect(progress.levelScores).toEqual({});
        expect(progress.totalScore).toBe(0);
        expect(progress.lastPlayedLevel).toBe(1);
        expect(progress.timestamp).toBeDefined();
    });

    it('should save and load progress data correctly', () => {
        const progressData = {
            completedLevels: new Set([1, 2, 3]),
            levelScores: { 1: 1000, 2: 1500, 3: 2000 },
            totalScore: 4500,
            lastPlayedLevel: 3
        };

        const saveResult = ProgressStorage.saveProgress(progressData);
        expect(saveResult).toBe(true);

        const loadedProgress = ProgressStorage.loadProgress();
        
        expect(loadedProgress.version).toBe(1);
        expect(Array.from(loadedProgress.completedLevels).sort()).toEqual([1, 2, 3]);
        expect(loadedProgress.levelScores).toEqual({ 1: 1000, 2: 1500, 3: 2000 });
        expect(loadedProgress.totalScore).toBe(4500);
        expect(loadedProgress.lastPlayedLevel).toBe(3);
    });

    it('should handle corrupted JSON data', () => {
        localStorage.setItem(ProgressStorage.STORAGE_KEY, 'not valid json{');
        
        const progress = ProgressStorage.loadProgress();
        
        // Should return default progress
        expect(progress.completedLevels.size).toBe(0);
        expect(progress.totalScore).toBe(0);
        
        // Storage should be cleared
        expect(localStorage.getItem(ProgressStorage.STORAGE_KEY)).toBeNull();
    });

    it('should handle invalid data structure', () => {
        const invalidData = {
            version: 1,
            completedLevels: 'not an array', // Invalid
            levelScores: {},
            totalScore: 0,
            lastPlayedLevel: 1
        };
        
        localStorage.setItem(ProgressStorage.STORAGE_KEY, JSON.stringify(invalidData));
        
        const progress = ProgressStorage.loadProgress();
        
        // Should return default progress
        expect(progress.completedLevels.size).toBe(0);
        expect(progress.totalScore).toBe(0);
    });

    it('should validate completed levels are positive numbers', () => {
        const invalidData = {
            version: 1,
            completedLevels: [1, 2, -1], // Negative level invalid
            levelScores: {},
            totalScore: 0,
            lastPlayedLevel: 1
        };
        
        localStorage.setItem(ProgressStorage.STORAGE_KEY, JSON.stringify(invalidData));
        
        const progress = ProgressStorage.loadProgress();
        
        // Should return default progress due to invalid level
        expect(progress.completedLevels.size).toBe(0);
    });

    it('should validate level scores are non-negative', () => {
        const invalidData = {
            version: 1,
            completedLevels: [1, 2],
            levelScores: { 1: 1000, 2: -500 }, // Negative score invalid
            totalScore: 0,
            lastPlayedLevel: 1
        };
        
        localStorage.setItem(ProgressStorage.STORAGE_KEY, JSON.stringify(invalidData));
        
        const progress = ProgressStorage.loadProgress();
        
        // Should return default progress due to invalid score
        expect(progress.completedLevels.size).toBe(0);
    });

    it('should clear progress data', () => {
        const progressData = {
            completedLevels: new Set([1, 2]),
            levelScores: { 1: 1000, 2: 1500 },
            totalScore: 2500,
            lastPlayedLevel: 2
        };

        ProgressStorage.saveProgress(progressData);
        expect(localStorage.getItem(ProgressStorage.STORAGE_KEY)).not.toBeNull();

        ProgressStorage.clearProgress();
        expect(localStorage.getItem(ProgressStorage.STORAGE_KEY)).toBeNull();
    });

    it('should handle empty completed levels set', () => {
        const progressData = {
            completedLevels: new Set(),
            levelScores: {},
            totalScore: 0,
            lastPlayedLevel: 1
        };

        ProgressStorage.saveProgress(progressData);
        const loadedProgress = ProgressStorage.loadProgress();
        
        expect(loadedProgress.completedLevels.size).toBe(0);
        expect(Object.keys(loadedProgress.levelScores).length).toBe(0);
    });

    it('should preserve timestamp on save', () => {
        const progressData = {
            completedLevels: new Set([1]),
            levelScores: { 1: 1000 },
            totalScore: 1000,
            lastPlayedLevel: 1
        };

        ProgressStorage.saveProgress(progressData);
        const loadedProgress = ProgressStorage.loadProgress();
        
        expect(loadedProgress.timestamp).toBeDefined();
        expect(typeof loadedProgress.timestamp).toBe('string');
        
        // Should be a valid ISO date string
        const date = new Date(loadedProgress.timestamp);
        expect(date.toString()).not.toBe('Invalid Date');
    });
});

// LevelProgressionManager implementation (copied from game.js for testing)
const LevelProgressionManager = {
    totalLevels: 8,
    completedLevels: new Set(),
    levelScores: {},
    
    init() {
        const progress = ProgressStorage.loadProgress();
        this.completedLevels = progress.completedLevels;
        this.levelScores = progress.levelScores;
    },
    
    completeLevel(levelNumber, score) {
        this.completedLevels.add(levelNumber);
        
        if (!this.levelScores[levelNumber] || score > this.levelScores[levelNumber]) {
            this.levelScores[levelNumber] = score;
        }
        
        const totalScore = Object.values(this.levelScores).reduce((sum, s) => sum + s, 0);
        
        ProgressStorage.saveProgress({
            completedLevels: this.completedLevels,
            levelScores: this.levelScores,
            totalScore: totalScore,
            lastPlayedLevel: levelNumber
        });
    },
    
    isLevelUnlocked(levelNumber) {
        if (levelNumber === 1) {
            return true;
        }
        return this.completedLevels.has(levelNumber - 1);
    },
    
    isLevelCompleted(levelNumber) {
        return this.completedLevels.has(levelNumber);
    },
    
    getBestScore(levelNumber) {
        return this.levelScores[levelNumber] || 0;
    },
    
    resetProgress() {
        this.completedLevels.clear();
        this.levelScores = {};
        ProgressStorage.clearProgress();
    }
};

describe('LevelProgressionManager', () => {
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        global.localStorage = new LocalStorageMock();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Reset manager state
        LevelProgressionManager.completedLevels = new Set();
        LevelProgressionManager.levelScores = {};
        ProgressStorage.clearProgress();
    });

    afterEach(() => {
        global.localStorage.clear();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    /**
     * **Feature: multi-level-world, Property 3: Level completion unlocks next level**
     * For any level completion (except the final level), the next sequential level should become unlocked
     * **Validates: Requirements 1.4**
     */
    it('Property 3: Level completion unlocks next level', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 7 }), // Level to complete (not the last level)
                fc.integer({ min: 0, max: 10000 }), // Score
                (levelNumber, score) => {
                    // Reset state
                    LevelProgressionManager.completedLevels = new Set();
                    LevelProgressionManager.levelScores = {};
                    ProgressStorage.clearProgress();
                    
                    // Complete all levels up to and including the target level
                    for (let i = 1; i <= levelNumber; i++) {
                        LevelProgressionManager.completeLevel(i, score);
                    }
                    
                    // Property: Next level should be unlocked
                    const nextLevel = levelNumber + 1;
                    return LevelProgressionManager.isLevelUnlocked(nextLevel);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: multi-level-world, Property 7: Replay score update**
     * For any replayed level completion, if the new score exceeds the previous best score,
     * the stored best score should be updated
     * **Validates: Requirements 2.3**
     */
    it('Property 7: Replay score update - best score updates only when higher', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }), // Level number
                fc.integer({ min: 0, max: 10000 }), // Initial score
                fc.integer({ min: 0, max: 10000 }), // Replay score
                (levelNumber, initialScore, replayScore) => {
                    // Reset state
                    LevelProgressionManager.completedLevels = new Set();
                    LevelProgressionManager.levelScores = {};
                    ProgressStorage.clearProgress();
                    
                    // Complete level with initial score
                    LevelProgressionManager.completeLevel(levelNumber, initialScore);
                    
                    // Replay level with new score
                    LevelProgressionManager.completeLevel(levelNumber, replayScore);
                    
                    // Property: Best score should be the maximum of the two scores
                    const expectedBestScore = Math.max(initialScore, replayScore);
                    const actualBestScore = LevelProgressionManager.getBestScore(levelNumber);
                    
                    return actualBestScore === expectedBestScore;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests

    it('should initialize with no completed levels', () => {
        LevelProgressionManager.init();
        
        expect(LevelProgressionManager.completedLevels.size).toBe(0);
        expect(Object.keys(LevelProgressionManager.levelScores).length).toBe(0);
    });

    it('should mark level as completed', () => {
        LevelProgressionManager.completeLevel(1, 1000);
        
        expect(LevelProgressionManager.isLevelCompleted(1)).toBe(true);
        expect(LevelProgressionManager.getBestScore(1)).toBe(1000);
    });

    it('should unlock next level after completion', () => {
        expect(LevelProgressionManager.isLevelUnlocked(2)).toBe(false);
        
        LevelProgressionManager.completeLevel(1, 1000);
        
        expect(LevelProgressionManager.isLevelUnlocked(2)).toBe(true);
    });

    it('should always have level 1 unlocked', () => {
        expect(LevelProgressionManager.isLevelUnlocked(1)).toBe(true);
    });

    it('should update best score when new score is higher', () => {
        LevelProgressionManager.completeLevel(1, 1000);
        expect(LevelProgressionManager.getBestScore(1)).toBe(1000);
        
        LevelProgressionManager.completeLevel(1, 1500);
        expect(LevelProgressionManager.getBestScore(1)).toBe(1500);
    });

    it('should not update best score when new score is lower', () => {
        LevelProgressionManager.completeLevel(1, 1500);
        expect(LevelProgressionManager.getBestScore(1)).toBe(1500);
        
        LevelProgressionManager.completeLevel(1, 1000);
        expect(LevelProgressionManager.getBestScore(1)).toBe(1500);
    });

    it('should persist progress to storage', () => {
        LevelProgressionManager.completeLevel(1, 1000);
        LevelProgressionManager.completeLevel(2, 1500);
        
        // Load from storage
        const progress = ProgressStorage.loadProgress();
        
        expect(progress.completedLevels.has(1)).toBe(true);
        expect(progress.completedLevels.has(2)).toBe(true);
        expect(progress.levelScores[1]).toBe(1000);
        expect(progress.levelScores[2]).toBe(1500);
    });

    it('should load progress from storage on init', () => {
        // Save some progress
        ProgressStorage.saveProgress({
            completedLevels: new Set([1, 2, 3]),
            levelScores: { 1: 1000, 2: 1500, 3: 2000 },
            totalScore: 4500,
            lastPlayedLevel: 3
        });
        
        // Initialize manager
        LevelProgressionManager.init();
        
        expect(LevelProgressionManager.isLevelCompleted(1)).toBe(true);
        expect(LevelProgressionManager.isLevelCompleted(2)).toBe(true);
        expect(LevelProgressionManager.isLevelCompleted(3)).toBe(true);
        expect(LevelProgressionManager.getBestScore(1)).toBe(1000);
        expect(LevelProgressionManager.getBestScore(2)).toBe(1500);
        expect(LevelProgressionManager.getBestScore(3)).toBe(2000);
    });

    it('should reset all progress', () => {
        LevelProgressionManager.completeLevel(1, 1000);
        LevelProgressionManager.completeLevel(2, 1500);
        
        LevelProgressionManager.resetProgress();
        
        expect(LevelProgressionManager.completedLevels.size).toBe(0);
        expect(Object.keys(LevelProgressionManager.levelScores).length).toBe(0);
        
        // Verify storage is cleared
        const progress = ProgressStorage.loadProgress();
        expect(progress.completedLevels.size).toBe(0);
    });

    it('should return 0 for best score of uncompleted level', () => {
        expect(LevelProgressionManager.getBestScore(5)).toBe(0);
    });

    it('should not unlock level 3 if level 2 is not completed', () => {
        LevelProgressionManager.completeLevel(1, 1000);
        
        expect(LevelProgressionManager.isLevelUnlocked(2)).toBe(true);
        expect(LevelProgressionManager.isLevelUnlocked(3)).toBe(false);
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

// ParticleSystem implementation (copied from game.js for testing)
const ParticleSystem = {
    particles: [],
    MAX_PARTICLES: 500,
    
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
        
        if (this.particles.length >= this.MAX_PARTICLES) {
            this.particles.shift();
        }
        
        this.particles.push(particle);
        return particle;
    },
    
    update() {
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            particle.opacity -= particle.fadeRate;
            particle.rotation += particle.rotationSpeed;
            particle.lifetime++;
        }
        
        this.particles = this.particles.filter(particle => particle.opacity > 0);
    },
    
    render(ctx, camera) {
        for (const particle of this.particles) {
            ctx.save();
            
            const screenX = particle.x - camera.x;
            const screenY = particle.y;
            
            ctx.globalAlpha = particle.opacity;
            
            if (particle.rotation !== 0) {
                ctx.translate(screenX, screenY);
                ctx.rotate(particle.rotation);
                ctx.translate(-screenX, -screenY);
            }
            
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
    
    createTrail(x, y) {
        this.createParticle({
            x: x,
            y: y,
            velocityX: 0,
            velocityY: 0,
            size: 6,
            color: '#790ECB',
            opacity: 0.6,
            fadeRate: 0.03,
            rotation: 0,
            rotationSpeed: 0,
            type: 'trail'
        });
    },
    
    createExplosion(x, y) {
        const particleCount = Math.floor(Math.random() * 5) + 8;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 2;
            
            this.createParticle({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                size: 4 + Math.random() * 4,
                color: ['#FF0000', '#FF6600', '#FFAA00', '#FF3300'][Math.floor(Math.random() * 4)],
                opacity: 1.0,
                fadeRate: 0.025,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                type: 'explosion'
            });
        }
    },
    
    createSparkle(x, y) {
        const particleCount = Math.floor(Math.random() * 6) + 5; // 5-10 particles
        
        for (let i = 0; i < particleCount; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
            const speed = 1 + Math.random() * 2;
            
            this.createParticle({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                size: 3 + Math.random() * 4,
                color: ['#FFD700', '#FFA500', '#FFFF00', '#FFE4B5'][Math.floor(Math.random() * 4)],
                opacity: 1.0,
                fadeRate: 0.02 + Math.random() * 0.01,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                type: 'sparkle'
            });
        }
    },
    
    createConfetti() {
        const particleCount = Math.floor(Math.random() * 11) + 20; // 20-30 particles
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#790ECB'];
        
        for (let i = 0; i < particleCount; i++) {
            const spawnX = Math.random() * 800; // Simplified for testing
            const spawnY = -20 - Math.random() * 100;
            
            this.createParticle({
                x: spawnX,
                y: spawnY,
                velocityX: (Math.random() - 0.5) * 2,
                velocityY: 2 + Math.random() * 2,
                size: 4 + Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: 1.0,
                fadeRate: 0.005,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.4,
                type: 'confetti'
            });
        }
    },
    
    clear() {
        this.particles = [];
    }
};

describe('ParticleSystem', () => {
    beforeEach(() => {
        ParticleSystem.clear();
    });

    /**
     * **Feature: game-enhancements, Property 15: Dead particle removal**
     * For any trail particle with zero opacity, it should be removed from the particle array
     * **Validates: Requirements 4.3**
     */
    it('Property 15: Dead particle removal - particles with opacity <= 0 are removed', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        opacity: fc.float({ min: -0.5, max: Math.fround(1.5) }),
                        fadeRate: fc.float({ min: 0, max: Math.fround(0.1) }),
                        x: fc.float({ min: 0, max: Math.fround(1000) }),
                        y: fc.float({ min: 0, max: Math.fround(1000) })
                    }),
                    { minLength: 1, maxLength: 100 }
                ),
                (particleConfigs) => {
                    ParticleSystem.clear();
                    
                    // Create particles with the generated configurations
                    for (const config of particleConfigs) {
                        ParticleSystem.createParticle(config);
                    }
                    
                    // Run update to process particles
                    ParticleSystem.update();
                    
                    // Property: After update, no particles should have opacity <= 0
                    for (const particle of ParticleSystem.particles) {
                        if (particle.opacity <= 0) {
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

    it('should create a particle with valid parameters', () => {
        ParticleSystem.clear();
        
        const particle = ParticleSystem.createParticle({
            x: 100,
            y: 200,
            velocityX: 2,
            velocityY: -3,
            size: 10,
            color: '#FF0000',
            opacity: 0.8,
            fadeRate: 0.05,
            rotation: 0.5,
            rotationSpeed: 0.1,
            type: 'trail'
        });

        expect(particle.x).toBe(100);
        expect(particle.y).toBe(200);
        expect(particle.velocityX).toBe(2);
        expect(particle.velocityY).toBe(-3);
        expect(particle.size).toBe(10);
        expect(particle.color).toBe('#FF0000');
        expect(particle.opacity).toBe(0.8);
        expect(particle.fadeRate).toBe(0.05);
        expect(particle.rotation).toBe(0.5);
        expect(particle.rotationSpeed).toBe(0.1);
        expect(particle.type).toBe('trail');
        expect(particle.lifetime).toBe(0);
        expect(ParticleSystem.particles.length).toBe(1);
    });

    it('should remove particle when opacity reaches zero', () => {
        ParticleSystem.clear();
        
        // Create particle with high fade rate
        ParticleSystem.createParticle({
            x: 100,
            y: 100,
            opacity: 0.05,
            fadeRate: 0.1
        });

        expect(ParticleSystem.particles.length).toBe(1);

        // Update should reduce opacity below 0 and remove particle
        ParticleSystem.update();

        expect(ParticleSystem.particles.length).toBe(0);
    });

    it('should enforce particle limit of 500', () => {
        ParticleSystem.clear();
        
        // Create 510 particles
        for (let i = 0; i < 510; i++) {
            ParticleSystem.createParticle({
                x: i,
                y: i,
                opacity: 1.0,
                fadeRate: 0.001
            });
        }

        // Should only have 500 particles (oldest removed)
        expect(ParticleSystem.particles.length).toBe(500);
        
        // First particle should have x=10 (particles 0-9 were removed)
        expect(ParticleSystem.particles[0].x).toBe(10);
    });

    it('should update particle position, opacity, and rotation', () => {
        ParticleSystem.clear();
        
        const particle = ParticleSystem.createParticle({
            x: 100,
            y: 200,
            velocityX: 5,
            velocityY: -3,
            opacity: 1.0,
            fadeRate: 0.02,
            rotation: 0,
            rotationSpeed: 0.1
        });

        ParticleSystem.update();

        expect(particle.x).toBe(105);
        expect(particle.y).toBe(197);
        expect(particle.opacity).toBeCloseTo(0.98, 2);
        expect(particle.rotation).toBeCloseTo(0.1, 2);
        expect(particle.lifetime).toBe(1);
    });

    it('should render particles with camera offset', () => {
        ParticleSystem.clear();
        
        // Create mock canvas context
        const mockCtx = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            fillRect: vi.fn(),
            fillStyle: '',
            globalAlpha: 1
        };

        const camera = { x: 50, y: 0 };

        ParticleSystem.createParticle({
            x: 150,
            y: 100,
            size: 10,
            color: '#FF0000',
            opacity: 0.8,
            rotation: 0
        });

        ParticleSystem.render(mockCtx, camera);

        // Should apply camera offset (150 - 50 = 100)
        expect(mockCtx.fillRect).toHaveBeenCalledWith(95, 95, 10, 10);
        expect(mockCtx.globalAlpha).toBe(0.8);
        expect(mockCtx.fillStyle).toBe('#FF0000');
        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
    });

    /**
     * **Feature: game-enhancements, Property 13: Trail spawning on movement**
     * For any frame where the character has non-zero horizontal velocity, trail particles should be spawned
     * **Validates: Requirements 4.1**
     */
    it('Property 13: Trail spawning on movement - trails spawn when moving horizontally', () => {
        fc.assert(
            fc.property(
                fc.float({ min: Math.fround(0.6), max: Math.fround(10), noNaN: true }), // velocityX above threshold (0.5)
                fc.integer({ min: 0, max: 10 }), // frames to simulate
                (velocityX, frames) => {
                    ParticleSystem.clear();
                    
                    // Simulate player movement for multiple frames
                    let trailTimer = 0;
                    const movementThreshold = 0.5;
                    
                    for (let i = 0; i < frames; i++) {
                        // Simulate trail spawning logic from game
                        if (Math.abs(velocityX) > movementThreshold) {
                            trailTimer++;
                            if (trailTimer >= 3) {
                                ParticleSystem.createTrail(100, 100);
                                trailTimer = 0;
                            }
                        } else {
                            trailTimer = 0;
                        }
                    }
                    
                    // Property: If we moved for at least 3 frames, we should have spawned at least one trail
                    if (frames >= 3) {
                        const trailParticles = ParticleSystem.particles.filter(p => p.type === 'trail');
                        return trailParticles.length > 0;
                    }
                    
                    // For fewer than 3 frames, we might not have spawned any trails yet
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: game-enhancements, Property 19: Explosion particle radiation**
     * For any explosion effect spawned, its particles should have velocities pointing outward from the spawn point
     * **Validates: Requirements 5.2**
     */
    it('Property 19: Explosion particle radiation - particles radiate outward from spawn point', () => {
        fc.assert(
            fc.property(
                fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }), // spawn x
                fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }), // spawn y
                (spawnX, spawnY) => {
                    ParticleSystem.clear();
                    
                    // Create explosion at spawn point
                    ParticleSystem.createExplosion(spawnX, spawnY);
                    
                    // Get all explosion particles
                    const explosionParticles = ParticleSystem.particles.filter(p => p.type === 'explosion');
                    
                    // Property: All explosion particles should have non-zero velocity
                    // (they should be moving away from spawn point)
                    for (const particle of explosionParticles) {
                        const hasVelocity = particle.velocityX !== 0 || particle.velocityY !== 0;
                        if (!hasVelocity) {
                            return false;
                        }
                        
                        // Verify particle starts at spawn point
                        if (particle.x !== spawnX || particle.y !== spawnY) {
                            return false;
                        }
                    }
                    
                    // Property: Should spawn between 8-12 particles
                    if (explosionParticles.length < 8 || explosionParticles.length > 12) {
                        return false;
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests for Trail and Explosion Effects

    it('should spawn trail particles during movement', () => {
        ParticleSystem.clear();
        
        // Simulate moving for 3 frames (enough to spawn a trail)
        const velocityX = 5; // Above threshold
        let trailTimer = 0;
        const movementThreshold = 0.5;
        
        for (let i = 0; i < 3; i++) {
            if (Math.abs(velocityX) > movementThreshold) {
                trailTimer++;
                if (trailTimer >= 3) {
                    ParticleSystem.createTrail(100, 100);
                    trailTimer = 0;
                }
            }
        }
        
        const trailParticles = ParticleSystem.particles.filter(p => p.type === 'trail');
        expect(trailParticles.length).toBe(1);
        expect(trailParticles[0].x).toBe(100);
        expect(trailParticles[0].y).toBe(100);
        expect(trailParticles[0].color).toBe('#790ECB');
    });

    it('should not spawn trails when stationary', () => {
        ParticleSystem.clear();
        
        // Simulate being stationary
        const velocityX = 0;
        let trailTimer = 0;
        const movementThreshold = 0.5;
        
        for (let i = 0; i < 10; i++) {
            if (Math.abs(velocityX) > movementThreshold) {
                trailTimer++;
                if (trailTimer >= 3) {
                    ParticleSystem.createTrail(100, 100);
                    trailTimer = 0;
                }
            } else {
                trailTimer = 0;
            }
        }
        
        const trailParticles = ParticleSystem.particles.filter(p => p.type === 'trail');
        expect(trailParticles.length).toBe(0);
    });

    it('should spawn explosion on enemy collision', () => {
        ParticleSystem.clear();
        
        // Simulate explosion at collision point
        ParticleSystem.createExplosion(200, 300);
        
        const explosionParticles = ParticleSystem.particles.filter(p => p.type === 'explosion');
        
        // Should spawn 8-12 particles
        expect(explosionParticles.length).toBeGreaterThanOrEqual(8);
        expect(explosionParticles.length).toBeLessThanOrEqual(12);
        
        // All particles should start at explosion point
        for (const particle of explosionParticles) {
            expect(particle.x).toBe(200);
            expect(particle.y).toBe(300);
        }
    });

    it('should have explosion particles radiate outward', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createExplosion(150, 150);
        
        const explosionParticles = ParticleSystem.particles.filter(p => p.type === 'explosion');
        
        // All particles should have non-zero velocity
        for (const particle of explosionParticles) {
            const hasVelocity = particle.velocityX !== 0 || particle.velocityY !== 0;
            expect(hasVelocity).toBe(true);
        }
        
        // After one update, particles should have moved away from spawn point
        ParticleSystem.update();
        
        let movedCount = 0;
        for (const particle of explosionParticles) {
            if (particle.x !== 150 || particle.y !== 150) {
                movedCount++;
            }
        }
        
        // At least some particles should have moved
        expect(movedCount).toBeGreaterThan(0);
    });

    /**
     * **Feature: game-enhancements, Property 25: Sparkle count constraint**
     * For any collection event, the number of sparkle particles spawned should be between five and ten inclusive
     * **Validates: Requirements 6.4**
     */
    it('Property 25: Sparkle count constraint - spawns 5-10 particles', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 0, max: 1000, noNaN: true }), // spawn x
                fc.float({ min: 0, max: 1000, noNaN: true }), // spawn y
                (spawnX, spawnY) => {
                    ParticleSystem.clear();
                    
                    // Create sparkle effect
                    ParticleSystem.createSparkle(spawnX, spawnY);
                    
                    // Get all sparkle particles
                    const sparkleParticles = ParticleSystem.particles.filter(p => p.type === 'sparkle');
                    
                    // Property: Should spawn between 5-10 particles inclusive
                    return sparkleParticles.length >= 5 && sparkleParticles.length <= 10;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: game-enhancements, Property 30: Confetti count constraint**
     * For any new high score event, the number of confetti particles spawned should be between twenty and thirty inclusive
     * **Validates: Requirements 7.4**
     */
    it('Property 30: Confetti count constraint - spawns 20-30 particles', () => {
        fc.assert(
            fc.property(
                fc.constant(null), // No input needed, confetti spawns across screen
                () => {
                    ParticleSystem.clear();
                    
                    // Create confetti effect
                    ParticleSystem.createConfetti();
                    
                    // Get all confetti particles
                    const confettiParticles = ParticleSystem.particles.filter(p => p.type === 'confetti');
                    
                    // Property: Should spawn between 20-30 particles inclusive
                    return confettiParticles.length >= 20 && confettiParticles.length <= 30;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests for Sparkle and Confetti Effects

    it('should spawn sparkle particles on collection', () => {
        ParticleSystem.clear();
        
        // Simulate collecting a coin
        ParticleSystem.createSparkle(150, 200);
        
        const sparkleParticles = ParticleSystem.particles.filter(p => p.type === 'sparkle');
        
        // Should spawn sparkle particles
        expect(sparkleParticles.length).toBeGreaterThan(0);
        
        // All sparkles should start at collection point
        for (const particle of sparkleParticles) {
            expect(particle.x).toBe(150);
            expect(particle.y).toBe(200);
        }
    });

    it('should spawn sparkle count between 5-10', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createSparkle(100, 100);
        
        const sparkleParticles = ParticleSystem.particles.filter(p => p.type === 'sparkle');
        
        expect(sparkleParticles.length).toBeGreaterThanOrEqual(5);
        expect(sparkleParticles.length).toBeLessThanOrEqual(10);
    });

    it('should have sparkle particles with upward velocity', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createSparkle(100, 100);
        
        const sparkleParticles = ParticleSystem.particles.filter(p => p.type === 'sparkle');
        
        // Most sparkles should have upward (negative) velocity
        let upwardCount = 0;
        for (const particle of sparkleParticles) {
            if (particle.velocityY < 0) {
                upwardCount++;
            }
        }
        
        // At least half should be moving upward
        expect(upwardCount).toBeGreaterThan(sparkleParticles.length / 2);
    });

    it('should have sparkle particles with rotation', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createSparkle(100, 100);
        
        const sparkleParticles = ParticleSystem.particles.filter(p => p.type === 'sparkle');
        
        // All sparkles should have rotation speed
        for (const particle of sparkleParticles) {
            expect(particle.rotationSpeed).not.toBe(0);
        }
    });

    it('should spawn confetti on new high score', () => {
        ParticleSystem.clear();
        
        // Simulate new high score
        ParticleSystem.createConfetti();
        
        const confettiParticles = ParticleSystem.particles.filter(p => p.type === 'confetti');
        
        // Should spawn confetti particles
        expect(confettiParticles.length).toBeGreaterThan(0);
    });

    it('should spawn confetti count between 20-30', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createConfetti();
        
        const confettiParticles = ParticleSystem.particles.filter(p => p.type === 'confetti');
        
        expect(confettiParticles.length).toBeGreaterThanOrEqual(20);
        expect(confettiParticles.length).toBeLessThanOrEqual(30);
    });

    it('should have confetti with multiple colors', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createConfetti();
        
        const confettiParticles = ParticleSystem.particles.filter(p => p.type === 'confetti');
        
        // Collect unique colors
        const colors = new Set();
        for (const particle of confettiParticles) {
            colors.add(particle.color);
        }
        
        // Should have multiple different colors (at least 3)
        expect(colors.size).toBeGreaterThanOrEqual(3);
    });

    it('should have confetti with downward velocity', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createConfetti();
        
        const confettiParticles = ParticleSystem.particles.filter(p => p.type === 'confetti');
        
        // All confetti should have downward (positive) velocity
        for (const particle of confettiParticles) {
            expect(particle.velocityY).toBeGreaterThan(0);
        }
    });

    it('should have confetti with varying rotation speeds', () => {
        ParticleSystem.clear();
        
        ParticleSystem.createConfetti();
        
        const confettiParticles = ParticleSystem.particles.filter(p => p.type === 'confetti');
        
        // Collect unique rotation speeds
        const rotationSpeeds = new Set();
        for (const particle of confettiParticles) {
            rotationSpeeds.add(particle.rotationSpeed);
        }
        
        // Should have varying rotation speeds (at least 5 different values)
        expect(rotationSpeeds.size).toBeGreaterThanOrEqual(5);
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

// AnimationController implementation (copied from game.js for testing)
const AnimationController = {
    updateState(player) {
        if (player.velocityY < -1) {
            player.animationState = 'flying';
        } else if (player.velocityY > 1 && !player.onGround) {
            player.animationState = 'falling';
        } else if (Math.abs(player.velocityX) > 0.5) {
            player.animationState = 'running';
        } else {
            player.animationState = 'idle';
        }
    },
    
    applyFlyingPhysics(player) {
        if (player.onGround) {
            player.rotation = 0;
            return;
        }
        
        // Apex float effect - reduce gravity when near peak of jump
        if (Math.abs(player.velocityY) < 2) {
            player.velocityY += player.gravity * 0.3;
        } else if (player.velocityY > 0) {
            player.velocityY += player.gravity * 0.7;
        } else {
            player.velocityY += player.gravity;
        }
        
        // Calculate sprite rotation based on vertical velocity
        const maxRotation = Math.PI / 6;
        const rotationFactor = player.velocityY / 15;
        player.rotation = Math.max(-maxRotation, Math.min(maxRotation, rotationFactor));
    }
};

describe('AnimationController', () => {
    /**
     * **Feature: game-enhancements, Property 34: Reduced gravity on descent**
     * For any player state where vertical velocity is positive (descending) and not on ground,
     * the applied gravity should be less than the base gravity value
     * **Validates: Requirements 8.3**
     */
    it('Property 34: Reduced gravity on descent - gravity is reduced when descending', () => {
        fc.assert(
            fc.property(
                fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }), // base gravity
                fc.float({ min: Math.fround(0.1), max: Math.fround(20), noNaN: true }), // initial descending velocity (positive)
                (baseGravity, initialVelocityY) => {
                    // Create player in descending state (not at apex)
                    const player = {
                        velocityY: initialVelocityY,
                        gravity: baseGravity,
                        onGround: false,
                        rotation: 0
                    };
                    
                    const velocityBefore = player.velocityY;
                    
                    // Apply flying physics
                    AnimationController.applyFlyingPhysics(player);
                    
                    const velocityAfter = player.velocityY;
                    const gravityApplied = velocityAfter - velocityBefore;
                    
                    // Property: When descending (velocityY > 0 and not at apex),
                    // applied gravity should be less than base gravity
                    if (initialVelocityY >= 2) {
                        // Not at apex, should apply reduced gravity (70%)
                        const expectedGravity = baseGravity * 0.7;
                        return Math.abs(gravityApplied - expectedGravity) < 0.001;
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: game-enhancements, Property 35: Sprite rotation based on velocity**
     * For any player state in flying mode, the sprite rotation should correspond to
     * the direction of vertical velocity
     * **Validates: Requirements 8.4**
     */
    it('Property 35: Sprite rotation based on velocity - rotation matches velocity direction', () => {
        fc.assert(
            fc.property(
                fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }), // base gravity
                fc.float({ min: Math.fround(-20), max: Math.fround(20), noNaN: true }), // vertical velocity
                (baseGravity, velocityY) => {
                    // Create player in airborne state
                    const player = {
                        velocityY: velocityY,
                        gravity: baseGravity,
                        onGround: false,
                        rotation: 0
                    };
                    
                    // Apply flying physics
                    AnimationController.applyFlyingPhysics(player);
                    
                    // Property: Rotation sign should match velocity direction
                    // Positive velocity (descending) -> positive rotation (tilt down)
                    // Negative velocity (ascending) -> negative rotation (tilt up)
                    // Zero velocity -> near zero rotation
                    
                    if (velocityY > 1) {
                        // Descending - rotation should be positive (or zero)
                        return player.rotation >= 0;
                    } else if (velocityY < -1) {
                        // Ascending - rotation should be negative (or zero)
                        return player.rotation <= 0;
                    } else {
                        // Near zero velocity - rotation should be small
                        return Math.abs(player.rotation) < Math.PI / 6;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests

    it('should set flying state when ascending', () => {
        const player = {
            velocityY: -5,
            velocityX: 0,
            onGround: false,
            animationState: 'idle'
        };

        AnimationController.updateState(player);

        expect(player.animationState).toBe('flying');
    });

    it('should set falling state when descending', () => {
        const player = {
            velocityY: 5,
            velocityX: 0,
            onGround: false,
            animationState: 'idle'
        };

        AnimationController.updateState(player);

        expect(player.animationState).toBe('falling');
    });

    it('should set running state when moving horizontally', () => {
        const player = {
            velocityY: 0,
            velocityX: 3,
            onGround: true,
            animationState: 'idle'
        };

        AnimationController.updateState(player);

        expect(player.animationState).toBe('running');
    });

    it('should set idle state when stationary', () => {
        const player = {
            velocityY: 0,
            velocityX: 0,
            onGround: true,
            animationState: 'running'
        };

        AnimationController.updateState(player);

        expect(player.animationState).toBe('idle');
    });

    it('should reduce gravity at jump apex', () => {
        const player = {
            velocityY: 1, // Near zero (at apex)
            gravity: 0.5,
            onGround: false,
            rotation: 0
        };

        const velocityBefore = player.velocityY;
        AnimationController.applyFlyingPhysics(player);
        const gravityApplied = player.velocityY - velocityBefore;

        // Should apply 30% of normal gravity
        expect(gravityApplied).toBeCloseTo(0.5 * 0.3, 2);
    });

    it('should reduce gravity during descent', () => {
        const player = {
            velocityY: 5, // Descending
            gravity: 0.5,
            onGround: false,
            rotation: 0
        };

        const velocityBefore = player.velocityY;
        AnimationController.applyFlyingPhysics(player);
        const gravityApplied = player.velocityY - velocityBefore;

        // Should apply 70% of normal gravity
        expect(gravityApplied).toBeCloseTo(0.5 * 0.7, 2);
    });

    it('should apply normal gravity when ascending', () => {
        const player = {
            velocityY: -5, // Ascending
            gravity: 0.5,
            onGround: false,
            rotation: 0
        };

        const velocityBefore = player.velocityY;
        AnimationController.applyFlyingPhysics(player);
        const gravityApplied = player.velocityY - velocityBefore;

        // Should apply full gravity
        expect(gravityApplied).toBeCloseTo(0.5, 2);
    });

    it('should calculate sprite rotation based on velocity', () => {
        const player = {
            velocityY: 15, // Descending fast
            gravity: 0.5,
            onGround: false,
            rotation: 0
        };

        AnimationController.applyFlyingPhysics(player);

        // Rotation should be positive (tilting down) and within max rotation
        expect(player.rotation).toBeGreaterThan(0);
        expect(player.rotation).toBeLessThanOrEqual(Math.PI / 6);
    });

    it('should reset rotation when on ground', () => {
        const player = {
            velocityY: 5,
            gravity: 0.5,
            onGround: true,
            rotation: 0.5 // Some rotation from being airborne
        };

        AnimationController.applyFlyingPhysics(player);

        // Rotation should be reset to 0
        expect(player.rotation).toBe(0);
    });

    it('should clamp rotation to max rotation', () => {
        const player = {
            velocityY: 100, // Very high velocity
            gravity: 0.5,
            onGround: false,
            rotation: 0
        };

        AnimationController.applyFlyingPhysics(player);

        // Rotation should not exceed max rotation (PI/6)
        expect(Math.abs(player.rotation)).toBeLessThanOrEqual(Math.PI / 6);
    });
});

// LevelGenerator implementation (copied from game.js for testing)
const LevelGenerator = {
    createSeededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    },
    
    getDifficultyMultiplier(levelNumber) {
        const minDifficulty = 1.0;
        const maxDifficulty = 2.0;
        const maxLevel = 8;
        
        return minDifficulty + ((levelNumber - 1) / (maxLevel - 1)) * (maxDifficulty - minDifficulty);
    },
    
    generateLevel(levelNumber) {
        if (levelNumber < 1 || levelNumber > 8) {
            console.warn(`Invalid level number ${levelNumber}, defaulting to 1`);
            levelNumber = 1;
        }
        
        const random = this.createSeededRandom(levelNumber * 1000);
        const difficulty = this.getDifficultyMultiplier(levelNumber);
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
    
    generatePlatforms(levelNumber, difficulty, random) {
        const platforms = [];
        const baseGapSize = 100;
        const gapIncrease = 50 * (difficulty - 1);
        const platformCount = 12 - Math.floor(difficulty * 2);
        const levelLength = 3000;
        
        let currentX = 0;
        
        for (let i = 0; i < platformCount; i++) {
            const platformWidth = 150 + random() * 250;
            const isRaised = random() > 0.6;
            const platformY = isRaised ? 400 - random() * 150 : 550;
            const platformHeight = isRaised ? 20 : 50;
            
            platforms.push({
                x: currentX,
                y: platformY,
                width: platformWidth,
                height: platformHeight
            });
            
            const gapSize = baseGapSize + gapIncrease + random() * 30;
            currentX += platformWidth + gapSize;
        }
        
        platforms.push({
            x: currentX,
            y: 550,
            width: 300,
            height: 50
        });
        
        return platforms;
    },
    
    generateCollectibles(levelNumber, platforms, random) {
        const collectibles = [];
        
        platforms.forEach((platform, index) => {
            const skipChance = 0.1 * (this.getDifficultyMultiplier(levelNumber) - 1);
            if (random() < skipChance) return;
            
            const coinCount = Math.floor(1 + random() * 3);
            
            for (let i = 0; i < coinCount; i++) {
                const coinX = platform.x + (platform.width / (coinCount + 1)) * (i + 1);
                const coinY = platform.y - 50;
                
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
        
        const extraLifeCount = levelNumber <= 3 ? 2 : 1;
        for (let i = 0; i < extraLifeCount; i++) {
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
    
    generateEnemies(levelNumber, difficulty, platforms, random) {
        const enemies = [];
        const baseEnemyCount = 2;
        const enemyCount = Math.floor(baseEnemyCount + (difficulty - 1) * 3);
        
        const validPlatforms = platforms.filter((p, idx) => 
            idx < platforms.length - 1 && p.width > 100
        );
        
        if (validPlatforms.length === 0) return enemies;
        
        const enemyTypes = ['ground', 'plasma', 'jumping'];
        
        for (let i = 0; i < enemyCount; i++) {
            const platformIndex = Math.floor(random() * validPlatforms.length);
            const platform = validPlatforms[platformIndex];
            
            let enemyType;
            if (difficulty < 1.3) {
                enemyType = random() < 0.8 ? 'ground' : 'jumping';
            } else if (difficulty < 1.6) {
                const typeIndex = Math.floor(random() * 3);
                enemyType = enemyTypes[typeIndex];
            } else {
                enemyType = random() < 0.4 ? 'ground' : (random() < 0.5 ? 'plasma' : 'jumping');
            }
            
            if (enemyType === 'ground') {
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
                enemies.push({
                    type: 'plasma',
                    x: platform.x + platform.width / 2,
                    y: platform.y - 35,
                    width: 35,
                    height: 35,
                    range: 300 + random() * 200,
                    fireRate: 120 - Math.floor(difficulty * 20),
                    fireTimer: Math.floor(random() * 60),
                    alive: true
                });
            } else if (enemyType === 'jumping') {
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
    
    generateEndFlag(platforms) {
        const lastPlatform = platforms[platforms.length - 1];
        
        return {
            x: lastPlatform.x + lastPlatform.width - 100,
            y: lastPlatform.y - 80,
            width: 40,
            height: 80
        };
    }
};

describe('LevelGenerator', () => {
    let consoleWarnSpy;

    beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    /**
     * **Feature: multi-level-world, Property 6: Level replay determinism**
     * For any level number, generating the level multiple times should produce identical results
     * **Validates: Requirements 2.2**
     */
    it('Property 6: Level replay determinism - same level number produces same configuration', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }), // Level number
                (levelNumber) => {
                    // Generate level twice
                    const level1 = LevelGenerator.generateLevel(levelNumber);
                    const level2 = LevelGenerator.generateLevel(levelNumber);
                    
                    // Property: Both generations should be identical
                    
                    // Check level number
                    if (level1.levelNumber !== level2.levelNumber) return false;
                    
                    // Check platform count
                    if (level1.platforms.length !== level2.platforms.length) return false;
                    
                    // Check each platform
                    for (let i = 0; i < level1.platforms.length; i++) {
                        const p1 = level1.platforms[i];
                        const p2 = level2.platforms[i];
                        
                        if (p1.x !== p2.x) return false;
                        if (p1.y !== p2.y) return false;
                        if (p1.width !== p2.width) return false;
                        if (p1.height !== p2.height) return false;
                    }
                    
                    // Check collectible count
                    if (level1.collectibles.length !== level2.collectibles.length) return false;
                    
                    // Check each collectible
                    for (let i = 0; i < level1.collectibles.length; i++) {
                        const c1 = level1.collectibles[i];
                        const c2 = level2.collectibles[i];
                        
                        if (c1.type !== c2.type) return false;
                        if (c1.x !== c2.x) return false;
                        if (c1.y !== c2.y) return false;
                        if (c1.width !== c2.width) return false;
                        if (c1.height !== c2.height) return false;
                    }
                    
                    // Check end flag
                    if (level1.endFlag.x !== level2.endFlag.x) return false;
                    if (level1.endFlag.y !== level2.endFlag.y) return false;
                    if (level1.endFlag.width !== level2.endFlag.width) return false;
                    if (level1.endFlag.height !== level2.endFlag.height) return false;
                    
                    // Check background seed
                    if (level1.backgroundSeed !== level2.backgroundSeed) return false;
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: multi-level-world, Property 10: Platform gap scaling**
     * For any two levels where level A has a higher number than level B,
     * level A should have larger average platform gaps than level B
     * **Validates: Requirements 3.1**
     */
    it('Property 10: Platform gap scaling - higher levels have larger gaps', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 7 }), // Level A (not the last level)
                fc.integer({ min: 1, max: 7 }), // Level B (not the last level)
                (levelA, levelB) => {
                    // Skip if levels are the same
                    if (levelA === levelB) return true;
                    
                    // Ensure levelA > levelB
                    if (levelA < levelB) {
                        [levelA, levelB] = [levelB, levelA];
                    }
                    
                    // Generate both levels
                    const configA = LevelGenerator.generateLevel(levelA);
                    const configB = LevelGenerator.generateLevel(levelB);
                    
                    // Calculate average gap for each level
                    const calculateAverageGap = (platforms) => {
                        if (platforms.length < 2) return 0;
                        
                        let totalGap = 0;
                        for (let i = 0; i < platforms.length - 1; i++) {
                            const gap = platforms[i + 1].x - (platforms[i].x + platforms[i].width);
                            totalGap += gap;
                        }
                        
                        return totalGap / (platforms.length - 1);
                    };
                    
                    const avgGapA = calculateAverageGap(configA.platforms);
                    const avgGapB = calculateAverageGap(configB.platforms);
                    
                    // Property: Higher level should have larger average gap
                    return avgGapA > avgGapB;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: multi-level-world, Property 12: Safe platform reduction**
     * For any two levels where level A has a higher number than level B,
     * level A should have fewer safe platforms (platforms with no enemies) than level B
     * Note: Since enemies aren't generated yet, we test platform count reduction as a proxy
     * **Validates: Requirements 3.4**
     */
    it('Property 12: Safe platform reduction - higher levels have fewer platforms', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 7 }), // Level A (not the last level)
                fc.integer({ min: 1, max: 7 }), // Level B (not the last level)
                (levelA, levelB) => {
                    // Skip if levels are the same
                    if (levelA === levelB) return true;
                    
                    // Ensure levelA > levelB
                    if (levelA < levelB) {
                        [levelA, levelB] = [levelB, levelA];
                    }
                    
                    // Generate both levels
                    const configA = LevelGenerator.generateLevel(levelA);
                    const configB = LevelGenerator.generateLevel(levelB);
                    
                    // Property: Higher level should have fewer or equal platforms
                    // (Fewer platforms means fewer safe platforms)
                    return configA.platforms.length <= configB.platforms.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests

    it('should generate a valid level configuration', () => {
        const level = LevelGenerator.generateLevel(1);
        
        expect(level.levelNumber).toBe(1);
        expect(level.platforms).toBeDefined();
        expect(level.platforms.length).toBeGreaterThan(0);
        expect(level.collectibles).toBeDefined();
        expect(level.endFlag).toBeDefined();
        expect(level.backgroundSeed).toBe(1);
    });

    it('should generate platforms with valid properties', () => {
        const level = LevelGenerator.generateLevel(1);
        
        level.platforms.forEach(platform => {
            expect(platform.x).toBeGreaterThanOrEqual(0);
            expect(platform.y).toBeGreaterThan(0);
            expect(platform.width).toBeGreaterThan(0);
            expect(platform.height).toBeGreaterThan(0);
        });
    });

    it('should generate collectibles with valid properties', () => {
        const level = LevelGenerator.generateLevel(1);
        
        level.collectibles.forEach(collectible => {
            expect(['coin', 'extraLife']).toContain(collectible.type);
            expect(collectible.x).toBeGreaterThanOrEqual(0);
            expect(collectible.y).toBeGreaterThan(0);
            expect(collectible.width).toBeGreaterThan(0);
            expect(collectible.height).toBeGreaterThan(0);
            expect(collectible.collected).toBe(false);
        });
    });

    it('should place end flag on last platform', () => {
        const level = LevelGenerator.generateLevel(1);
        const lastPlatform = level.platforms[level.platforms.length - 1];
        
        expect(level.endFlag.x).toBeGreaterThanOrEqual(lastPlatform.x);
        expect(level.endFlag.x).toBeLessThanOrEqual(lastPlatform.x + lastPlatform.width);
        expect(level.endFlag.y).toBeLessThan(lastPlatform.y);
    });

    it('should calculate difficulty multiplier correctly', () => {
        expect(LevelGenerator.getDifficultyMultiplier(1)).toBeCloseTo(1.0, 2);
        expect(LevelGenerator.getDifficultyMultiplier(8)).toBeCloseTo(2.0, 2);
        expect(LevelGenerator.getDifficultyMultiplier(4)).toBeCloseTo(1.43, 2);
    });

    it('should handle invalid level numbers', () => {
        const level = LevelGenerator.generateLevel(0);
        expect(level.levelNumber).toBe(1);
        
        const level2 = LevelGenerator.generateLevel(10);
        expect(level2.levelNumber).toBe(1);
    });

    it('should generate more extra lives in early levels', () => {
        const level1 = LevelGenerator.generateLevel(1);
        const level8 = LevelGenerator.generateLevel(8);
        
        const extraLives1 = level1.collectibles.filter(c => c.type === 'extraLife').length;
        const extraLives8 = level8.collectibles.filter(c => c.type === 'extraLife').length;
        
        expect(extraLives1).toBeGreaterThanOrEqual(extraLives8);
    });

    it('should create seeded random function that is deterministic', () => {
        const random1 = LevelGenerator.createSeededRandom(12345);
        const random2 = LevelGenerator.createSeededRandom(12345);
        
        // Generate same sequence
        for (let i = 0; i < 10; i++) {
            expect(random1()).toBe(random2());
        }
    });

    it('should create seeded random function that produces different sequences for different seeds', () => {
        const random1 = LevelGenerator.createSeededRandom(12345);
        const random2 = LevelGenerator.createSeededRandom(54321);
        
        // Should produce different values
        expect(random1()).not.toBe(random2());
    });

    /**
     * **Feature: multi-level-world, Property 11: Enemy count scaling**
     * For any two levels where level A has a higher number than level B,
     * level A should have more enemies than level B
     * **Validates: Requirements 3.2**
     */
    it('Property 11: Enemy count scaling - higher levels have more enemies', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 7 }), // Level A (not the last level)
                fc.integer({ min: 1, max: 7 }), // Level B (not the last level)
                (levelA, levelB) => {
                    // Skip if levels are the same
                    if (levelA === levelB) return true;
                    
                    // Ensure levelA > levelB
                    if (levelA < levelB) {
                        [levelA, levelB] = [levelB, levelA];
                    }
                    
                    // Generate both levels
                    const configA = LevelGenerator.generateLevel(levelA);
                    const configB = LevelGenerator.generateLevel(levelB);
                    
                    // Property: Higher level should have more or equal enemies
                    return configA.enemies.length >= configB.enemies.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should generate enemies with valid properties', () => {
        const level = LevelGenerator.generateLevel(3);
        
        expect(level.enemies.length).toBeGreaterThan(0);
        
        level.enemies.forEach(enemy => {
            expect(['ground', 'plasma', 'jumping']).toContain(enemy.type);
            expect(enemy.x).toBeGreaterThanOrEqual(0);
            expect(enemy.y).toBeGreaterThan(0);
            expect(enemy.width).toBeGreaterThan(0);
            expect(enemy.height).toBeGreaterThan(0);
            expect(enemy.alive).toBe(true);
            
            if (enemy.type === 'ground') {
                expect(enemy.patrolStart).toBeDefined();
                expect(enemy.patrolEnd).toBeDefined();
                expect(enemy.speed).toBeGreaterThan(0);
                expect(enemy.direction).toBeDefined();
            } else if (enemy.type === 'plasma') {
                expect(enemy.range).toBeGreaterThan(0);
                expect(enemy.fireRate).toBeGreaterThan(0);
                expect(enemy.fireTimer).toBeDefined();
            } else if (enemy.type === 'jumping') {
                expect(enemy.jumpInterval).toBeDefined();
                expect(enemy.jumpInterval.length).toBe(2);
                expect(enemy.jumpTimer).toBeGreaterThanOrEqual(0);
            }
        });
    });

    it('should generate more enemies at higher difficulty levels', () => {
        const level1 = LevelGenerator.generateLevel(1);
        const level8 = LevelGenerator.generateLevel(8);
        
        expect(level8.enemies.length).toBeGreaterThan(level1.enemies.length);
    });

    it('should mix enemy types at higher difficulties', () => {
        const level5 = LevelGenerator.generateLevel(5);
        
        const enemyTypes = new Set(level5.enemies.map(e => e.type));
        
        // Should have at least 2 different enemy types at level 5
        expect(enemyTypes.size).toBeGreaterThanOrEqual(2);
    });
});
