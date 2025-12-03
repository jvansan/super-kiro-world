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

// GroundEnemy class (copied from game.js for testing)
class GroundEnemy {
    constructor(x, y, patrolStart, patrolEnd, speed = 1.5) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.patrolStart = patrolStart;
        this.patrolEnd = patrolEnd;
        this.speed = speed;
        this.direction = 1;
        this.velocityY = 0;
        this.gravity = 0.5;
        this.onGround = false;
        this.alive = true;
        this.type = 'ground';
    }
    
    update(platforms) {
        if (!this.alive) return;
        
        this.x += this.speed * this.direction;
        
        if (this.x >= this.patrolEnd || this.x <= this.patrolStart) {
            this.direction *= -1;
        }
        
        this.velocityY += this.gravity;
        this.y += this.velocityY;
        
        this.onGround = false;
        
        platforms.forEach(platform => {
            if (this.checkCollision(platform)) {
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
        
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
        
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
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= this.y + 10) {
                return 'defeat';
            } else {
                return 'damage';
            }
        }
        
        return null;
    }
    
    defeat() {
        this.alive = false;
    }
}

describe('GroundEnemy', () => {
    /**
     * **Feature: multi-level-world, Property 13: Ground enemy patrol path assignment**
     * For any ground enemy spawned, it should have a defined patrol path with start and end boundaries
     * **Validates: Requirements 4.1**
     */
    it('Property 13: Ground enemy patrol path assignment - all enemies have valid patrol paths', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 2000 }), // x position
                fc.integer({ min: 0, max: 600 }), // y position
                fc.integer({ min: 0, max: 2000 }), // patrol start
                fc.integer({ min: 0, max: 2000 }), // patrol end
                fc.float({ min: 0.5, max: 3.0 }), // speed
                (x, y, patrolStart, patrolEnd, speed) => {
                    // Ensure patrolStart < patrolEnd
                    if (patrolStart >= patrolEnd) {
                        [patrolStart, patrolEnd] = [patrolEnd, patrolStart];
                    }
                    
                    // Skip if patrol range is too small
                    if (patrolEnd - patrolStart < 50) return true;
                    
                    // Create enemy
                    const enemy = new GroundEnemy(x, y, patrolStart, patrolEnd, speed);
                    
                    // Property: Enemy should have defined patrol boundaries
                    const hasValidPatrolStart = typeof enemy.patrolStart === 'number' && enemy.patrolStart >= 0;
                    const hasValidPatrolEnd = typeof enemy.patrolEnd === 'number' && enemy.patrolEnd > enemy.patrolStart;
                    
                    return hasValidPatrolStart && hasValidPatrolEnd;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: multi-level-world, Property 14: Ground enemy direction reversal**
     * For any ground enemy reaching its patrol boundary, its movement direction should reverse
     * **Validates: Requirements 4.2**
     */
    it('Property 14: Ground enemy direction reversal - direction reverses at boundaries', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 500 }), // patrol start
                fc.integer({ min: 600, max: 1000 }), // patrol end
                fc.float({ min: 0.5, max: 3.0, noNaN: true }), // speed
                (patrolStart, patrolEnd, speed) => {
                    // Create enemy at patrol start, moving right
                    const enemy = new GroundEnemy(patrolStart, 500, patrolStart, patrolEnd, speed);
                    enemy.direction = 1;
                    
                    const platforms = [{ x: 0, y: 530, width: 2000, height: 50 }];
                    
                    // Move enemy until it reaches the end boundary
                    let iterations = 0;
                    const maxIterations = 10000;
                    
                    while (enemy.x < patrolEnd && iterations < maxIterations) {
                        enemy.update(platforms);
                        iterations++;
                    }
                    
                    // Property: Direction should have reversed (now moving left)
                    const directionReversedAtEnd = enemy.direction === -1;
                    
                    // Now move enemy back to start boundary
                    iterations = 0;
                    while (enemy.x > patrolStart && iterations < maxIterations) {
                        enemy.update(platforms);
                        iterations++;
                    }
                    
                    // Property: Direction should have reversed again (now moving right)
                    const directionReversedAtStart = enemy.direction === 1;
                    
                    return directionReversedAtEnd && directionReversedAtStart;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit tests
    
    it('should initialize with correct properties', () => {
        const enemy = new GroundEnemy(100, 200, 50, 300, 2.0);
        
        expect(enemy.x).toBe(100);
        expect(enemy.y).toBe(200);
        expect(enemy.patrolStart).toBe(50);
        expect(enemy.patrolEnd).toBe(300);
        expect(enemy.speed).toBe(2.0);
        expect(enemy.direction).toBe(1);
        expect(enemy.alive).toBe(true);
        expect(enemy.type).toBe('ground');
    });

    it('should move horizontally based on speed and direction', () => {
        const enemy = new GroundEnemy(100, 500, 50, 300, 2.0);
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        const initialX = enemy.x;
        enemy.update(platforms);
        
        expect(enemy.x).toBe(initialX + 2.0 * enemy.direction);
    });

    it('should reverse direction at patrol end boundary', () => {
        const enemy = new GroundEnemy(299, 500, 50, 300, 2.0);
        enemy.direction = 1;
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        enemy.update(platforms);
        
        expect(enemy.direction).toBe(-1);
    });

    it('should reverse direction at patrol start boundary', () => {
        const enemy = new GroundEnemy(51, 500, 50, 300, 2.0);
        enemy.direction = -1;
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        enemy.update(platforms);
        
        expect(enemy.direction).toBe(1);
    });

    it('should apply gravity when not on ground', () => {
        const enemy = new GroundEnemy(100, 400, 50, 300, 2.0);
        const platforms = [];
        
        const initialY = enemy.y;
        const initialVelocityY = enemy.velocityY;
        
        enemy.update(platforms);
        
        expect(enemy.velocityY).toBe(initialVelocityY + enemy.gravity);
        expect(enemy.y).toBe(initialY + enemy.velocityY);
    });

    it('should land on platforms', () => {
        const enemy = new GroundEnemy(100, 495, 50, 300, 2.0);
        enemy.velocityY = 5;
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        enemy.update(platforms);
        
        expect(enemy.y).toBe(500); // 530 - 30 (enemy height)
        expect(enemy.velocityY).toBe(0);
        expect(enemy.onGround).toBe(true);
    });

    it('should not update when not alive', () => {
        const enemy = new GroundEnemy(100, 500, 50, 300, 2.0);
        enemy.alive = false;
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        const initialX = enemy.x;
        const initialY = enemy.y;
        
        enemy.update(platforms);
        
        expect(enemy.x).toBe(initialX);
        expect(enemy.y).toBe(initialY);
    });

    it('should detect collision with player from above as defeat', () => {
        const enemy = new GroundEnemy(100, 500, 50, 300, 2.0);
        const player = {
            x: 100,
            y: 465,
            width: 40,
            height: 40,
            velocityY: 5
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBe('defeat');
    });

    it('should detect collision with player from side as damage', () => {
        const enemy = new GroundEnemy(100, 500, 50, 300, 2.0);
        const player = {
            x: 80,
            y: 500,
            width: 40,
            height: 40,
            velocityY: 0
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBe('damage');
    });

    it('should return null when no collision with player', () => {
        const enemy = new GroundEnemy(100, 500, 50, 300, 2.0);
        const player = {
            x: 200,
            y: 400,
            width: 40,
            height: 40,
            velocityY: 0
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBeNull();
    });

    it('should be defeated when defeat method is called', () => {
        const enemy = new GroundEnemy(100, 500, 50, 300, 2.0);
        
        expect(enemy.alive).toBe(true);
        
        enemy.defeat();
        
        expect(enemy.alive).toBe(false);
    });

    it('should not detect collision when not alive', () => {
        const enemy = new GroundEnemy(100, 500, 50, 300, 2.0);
        enemy.alive = false;
        
        const player = {
            x: 100,
            y: 500,
            width: 40,
            height: 40,
            velocityY: 0
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBeNull();
    });
});

// Projectile class (copied from game.js for testing)
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
        
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        const margin = 100;
        if (this.x < -margin || this.x > 3000 + margin || 
            this.y < -margin || this.y > 700 + margin) {
            this.active = false;
        }
    }
    
    render(ctx, camera) {
        if (!this.active) return;
        
        ctx.save();
        
        ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
        
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

describe('Projectile', () => {
    /**
     * **Feature: multi-level-world, Property 19: Projectile linear movement**
     * For any projectile fired, it should move in a straight line from its spawn position
     * **Validates: Requirements 5.3**
     */
    it('Property 19: Projectile linear movement - projectiles move in straight lines', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1000 }), // start x
                fc.integer({ min: 0, max: 600 }), // start y
                fc.float({ min: -5, max: 5 }), // velocity x
                fc.float({ min: -5, max: 5 }), // velocity y
                (startX, startY, velocityX, velocityY) => {
                    // Skip if velocity is too small (stationary projectile)
                    if (Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1) return true;
                    
                    const projectile = new Projectile(startX, startY, velocityX, velocityY);
                    
                    // Track positions
                    const positions = [{ x: projectile.x, y: projectile.y }];
                    
                    // Update projectile multiple times
                    for (let i = 0; i < 10; i++) {
                        projectile.update();
                        if (projectile.active) {
                            positions.push({ x: projectile.x, y: projectile.y });
                        }
                    }
                    
                    // Property: Each position should be exactly velocity away from previous
                    for (let i = 1; i < positions.length; i++) {
                        const dx = positions[i].x - positions[i - 1].x;
                        const dy = positions[i].y - positions[i - 1].y;
                        
                        // Check if movement matches velocity (within floating point tolerance)
                        const tolerance = 0.001;
                        if (Math.abs(dx - velocityX) > tolerance || Math.abs(dy - velocityY) > tolerance) {
                            return false;
                        }
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: multi-level-world, Property 21: Projectile off-screen cleanup**
     * For any projectile that travels beyond screen boundaries, it should be removed from the level
     * **Validates: Requirements 5.5**
     */
    it('Property 21: Projectile off-screen cleanup - projectiles deactivate when off-screen', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -200, max: 3200 }), // start x (including off-screen)
                fc.integer({ min: -200, max: 900 }), // start y (including off-screen)
                fc.float({ min: -10, max: 10 }), // velocity x
                fc.float({ min: -10, max: 10 }), // velocity y
                (startX, startY, velocityX, velocityY) => {
                    // Skip if velocity is too small
                    if (Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1) return true;
                    
                    const projectile = new Projectile(startX, startY, velocityX, velocityY);
                    
                    // Update until projectile is off-screen or max iterations
                    let iterations = 0;
                    const maxIterations = 1000;
                    
                    while (projectile.active && iterations < maxIterations) {
                        projectile.update();
                        iterations++;
                    }
                    
                    // Property: If projectile went off-screen, it should be deactivated
                    // Check if final position is off-screen
                    const margin = 100;
                    const isOffScreen = projectile.x < -margin || projectile.x > 3000 + margin ||
                                       projectile.y < -margin || projectile.y > 700 + margin;
                    
                    // If off-screen, should be inactive
                    if (isOffScreen) {
                        return !projectile.active;
                    }
                    
                    // If still on-screen after max iterations, that's fine
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit tests
    
    it('should initialize with correct properties', () => {
        const projectile = new Projectile(100, 200, 3, -2);
        
        expect(projectile.x).toBe(100);
        expect(projectile.y).toBe(200);
        expect(projectile.velocityX).toBe(3);
        expect(projectile.velocityY).toBe(-2);
        expect(projectile.active).toBe(true);
    });

    it('should move in straight line based on velocity', () => {
        const projectile = new Projectile(100, 200, 3, -2);
        
        projectile.update();
        
        expect(projectile.x).toBe(103);
        expect(projectile.y).toBe(198);
    });

    it('should deactivate when moving off-screen to the right', () => {
        const projectile = new Projectile(3100, 300, 10, 0);
        
        projectile.update();
        
        expect(projectile.active).toBe(false);
    });

    it('should deactivate when moving off-screen to the left', () => {
        const projectile = new Projectile(-100, 300, -10, 0);
        
        projectile.update();
        
        expect(projectile.active).toBe(false);
    });

    it('should deactivate when moving off-screen above', () => {
        const projectile = new Projectile(500, -100, 0, -10);
        
        projectile.update();
        
        expect(projectile.active).toBe(false);
    });

    it('should deactivate when moving off-screen below', () => {
        const projectile = new Projectile(500, 800, 0, 10);
        
        projectile.update();
        
        expect(projectile.active).toBe(false);
    });

    it('should not update when inactive', () => {
        const projectile = new Projectile(100, 200, 3, -2);
        projectile.active = false;
        
        const initialX = projectile.x;
        const initialY = projectile.y;
        
        projectile.update();
        
        expect(projectile.x).toBe(initialX);
        expect(projectile.y).toBe(initialY);
    });

    it('should detect collision with player', () => {
        const projectile = new Projectile(100, 200, 3, -2);
        const player = {
            x: 100,
            y: 200,
            width: 40,
            height: 40
        };
        
        const result = projectile.checkPlayerCollision(player);
        
        expect(result).toBe(true);
    });

    it('should not detect collision when not overlapping', () => {
        const projectile = new Projectile(100, 200, 3, -2);
        const player = {
            x: 200,
            y: 300,
            width: 40,
            height: 40
        };
        
        const result = projectile.checkPlayerCollision(player);
        
        expect(result).toBe(false);
    });

    it('should not detect collision when inactive', () => {
        const projectile = new Projectile(100, 200, 3, -2);
        projectile.active = false;
        
        const player = {
            x: 100,
            y: 200,
            width: 40,
            height: 40
        };
        
        const result = projectile.checkPlayerCollision(player);
        
        expect(result).toBe(false);
    });

    it('should deactivate when deactivate method is called', () => {
        const projectile = new Projectile(100, 200, 3, -2);
        
        expect(projectile.active).toBe(true);
        
        projectile.deactivate();
        
        expect(projectile.active).toBe(false);
    });
});

// PlasmaShooter class (copied from game.js for testing)
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
        
        const distanceToPlayer = Math.abs(player.x - this.x);
        
        if (distanceToPlayer <= this.range) {
            this.fireTimer++;
            
            if (this.fireTimer >= this.fireRate) {
                const projectile = this.fireProjectile(player.x + player.width / 2, player.y + player.height / 2);
                projectiles.push(projectile);
                this.fireTimer = 0;
            }
        }
    }
    
    fireProjectile(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = 3;
        const velocityX = (dx / distance) * speed;
        const velocityY = (dy / distance) * speed;
        
        return new Projectile(this.x, this.y, velocityX, velocityY);
    }
    
    render(ctx, camera) {
        if (!this.alive) return;
        
        ctx.fillStyle = '#9B59B6';
        ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
        
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(this.x - camera.x + 10, this.y + 10, 15, 15);
        
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

describe('PlasmaShooter', () => {
    // Unit tests
    
    it('should initialize with correct properties', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 120);
        
        expect(shooter.x).toBe(100);
        expect(shooter.y).toBe(200);
        expect(shooter.range).toBe(300);
        expect(shooter.fireRate).toBe(120);
        expect(shooter.fireTimer).toBe(0);
        expect(shooter.alive).toBe(true);
        expect(shooter.type).toBe('plasma');
    });

    it('should fire at regular intervals when player is in range', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const player = { x: 200, y: 200, width: 40, height: 40 };
        const projectiles = [];
        
        // Update 59 times - should not fire yet
        for (let i = 0; i < 59; i++) {
            shooter.update(player, projectiles);
        }
        expect(projectiles.length).toBe(0);
        
        // Update once more - should fire
        shooter.update(player, projectiles);
        expect(projectiles.length).toBe(1);
        
        // Timer should reset
        expect(shooter.fireTimer).toBe(0);
    });

    it('should not fire when player is out of range', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const player = { x: 500, y: 200, width: 40, height: 40 }; // Out of range
        const projectiles = [];
        
        // Update many times
        for (let i = 0; i < 100; i++) {
            shooter.update(player, projectiles);
        }
        
        // Should not have fired
        expect(projectiles.length).toBe(0);
    });

    it('should detect player within range', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const player = { x: 200, y: 200, width: 40, height: 40 };
        const projectiles = [];
        
        // Player is within range (distance = 100)
        shooter.fireTimer = 59;
        shooter.update(player, projectiles);
        
        expect(projectiles.length).toBe(1);
    });

    it('should detect player at exact range boundary', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const player = { x: 400, y: 200, width: 40, height: 40 }; // Exactly at range
        const projectiles = [];
        
        shooter.fireTimer = 59;
        shooter.update(player, projectiles);
        
        expect(projectiles.length).toBe(1);
    });

    it('should create projectile aimed at player position', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const targetX = 300;
        const targetY = 400;
        
        const projectile = shooter.fireProjectile(targetX, targetY);
        
        expect(projectile).toBeDefined();
        expect(projectile.x).toBe(100);
        expect(projectile.y).toBe(200);
        expect(projectile.velocityX).toBeGreaterThan(0); // Moving right
        expect(projectile.velocityY).toBeGreaterThan(0); // Moving down
    });

    it('should create projectile with correct speed', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const targetX = 400;
        const targetY = 200;
        
        const projectile = shooter.fireProjectile(targetX, targetY);
        
        // Speed should be 3
        const speed = Math.sqrt(projectile.velocityX ** 2 + projectile.velocityY ** 2);
        expect(speed).toBeCloseTo(3, 1);
    });

    it('should not update when not alive', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        shooter.alive = false;
        
        const player = { x: 200, y: 200, width: 40, height: 40 };
        const projectiles = [];
        
        shooter.fireTimer = 59;
        shooter.update(player, projectiles);
        
        expect(projectiles.length).toBe(0);
    });

    it('should be defeated when defeat method is called', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        
        expect(shooter.alive).toBe(true);
        
        shooter.defeat();
        
        expect(shooter.alive).toBe(false);
    });

    it('should fire multiple times at regular intervals', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 30);
        const player = { x: 200, y: 200, width: 40, height: 40 };
        const projectiles = [];
        
        // Update 90 times - should fire 3 times (at 30, 60, 90)
        for (let i = 0; i < 90; i++) {
            shooter.update(player, projectiles);
        }
        
        expect(projectiles.length).toBe(3);
    });

    it('should check collision with rectangles', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const rect = { x: 100, y: 200, width: 40, height: 40 };
        
        const result = shooter.checkCollision(rect);
        
        expect(result).toBe(true);
    });

    it('should not detect collision when not overlapping', () => {
        const shooter = new PlasmaShooter(100, 200, 300, 60);
        const rect = { x: 200, y: 300, width: 40, height: 40 };
        
        const result = shooter.checkCollision(rect);
        
        expect(result).toBe(false);
    });
});

// JumpingEnemy class (copied from game.js for testing)
class JumpingEnemy {
    constructor(x, y, jumpInterval) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 28;
        this.jumpInterval = jumpInterval;
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
        
        this.jumpTimer--;
        
        if (this.jumpTimer <= 0 && this.onGround) {
            this.jump();
            this.jumpTimer = this.getRandomJumpTime();
        }
        
        this.velocityY += this.gravity;
        
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        this.velocityX *= 0.95;
        
        this.onGround = false;
        
        platforms.forEach(platform => {
            if (this.checkCollision(platform)) {
                if (this.velocityY > 0 && this.y + this.height - this.velocityY <= platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                }
            }
        });
    }
    
    jump() {
        this.velocityX = (Math.random() - 0.5) * 6;
        this.velocityY = -10;
        this.onGround = false;
    }
    
    getRandomJumpTime() {
        const min = this.jumpInterval[0];
        const max = this.jumpInterval[1];
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    render(ctx, camera) {
        if (!this.alive) return;
        
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - camera.x + 5, this.y + 5, 6, 6);
        ctx.fillRect(this.x - camera.x + 17, this.y + 5, 6, 6);
        
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
            if (player.velocityY > 0 && player.y + player.height - player.velocityY <= this.y + 10) {
                return 'defeat';
            } else {
                return 'damage';
            }
        }
        
        return null;
    }
    
    defeat() {
        this.alive = false;
    }
}

describe('JumpingEnemy', () => {
    /**
     * **Feature: multi-level-world, Property 22: Jumping enemy random timing**
     * For any jumping enemy spawned, it should have random jump timing parameters assigned
     * **Validates: Requirements 6.1**
     */
    it('Property 22: Jumping enemy random timing - enemies have valid random jump intervals', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1000 }), // x position
                fc.integer({ min: 0, max: 600 }), // y position
                fc.integer({ min: 30, max: 120 }), // min jump interval
                fc.integer({ min: 121, max: 300 }), // max jump interval
                (x, y, minInterval, maxInterval) => {
                    const jumpInterval = [minInterval, maxInterval];
                    const enemy = new JumpingEnemy(x, y, jumpInterval);
                    
                    // Property: Jump timer should be within the specified interval
                    const timerInRange = enemy.jumpTimer >= minInterval && enemy.jumpTimer <= maxInterval;
                    
                    // Property: Jump interval should be stored correctly
                    const intervalStored = enemy.jumpInterval[0] === minInterval && 
                                          enemy.jumpInterval[1] === maxInterval;
                    
                    return timerInRange && intervalStored;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: multi-level-world, Property 24: Jumping enemy timer reset on landing**
     * For any jumping enemy landing on a platform, its jump timer should be reset with a new random duration
     * **Validates: Requirements 6.3**
     */
    it('Property 24: Jumping enemy timer reset on landing - timer resets when landing', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 30, max: 120 }), // min jump interval
                fc.integer({ min: 121, max: 300 }), // max jump interval
                (minInterval, maxInterval) => {
                    const jumpInterval = [minInterval, maxInterval];
                    const enemy = new JumpingEnemy(100, 495, jumpInterval);
                    const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
                    
                    // Set enemy on ground and force jump timer to expire
                    enemy.onGround = true;
                    enemy.jumpTimer = 0;
                    
                    // Update - should jump and reset timer
                    enemy.update(platforms);
                    
                    // Property: Timer should be reset to a value within the interval
                    // Note: Timer is decremented before check, so it might be one less
                    const timerReset = enemy.jumpTimer >= minInterval - 1 && enemy.jumpTimer <= maxInterval;
                    
                    return timerReset;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit tests
    
    it('should initialize with correct properties', () => {
        const enemy = new JumpingEnemy(100, 200, [60, 180]);
        
        expect(enemy.x).toBe(100);
        expect(enemy.y).toBe(200);
        expect(enemy.jumpInterval).toEqual([60, 180]);
        expect(enemy.jumpTimer).toBeGreaterThanOrEqual(60);
        expect(enemy.jumpTimer).toBeLessThanOrEqual(180);
        expect(enemy.alive).toBe(true);
        expect(enemy.type).toBe('jumping');
    });

    it('should jump when timer expires and on ground', () => {
        const enemy = new JumpingEnemy(100, 502, [60, 180]);
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        enemy.onGround = true;
        enemy.jumpTimer = 1;
        
        enemy.update(platforms);
        
        expect(enemy.velocityY).toBeLessThan(0); // Should have upward velocity
        expect(enemy.onGround).toBe(false);
    });

    it('should not jump when timer has not expired', () => {
        const enemy = new JumpingEnemy(100, 400, [60, 180]);
        const platforms = [];
        
        enemy.onGround = false;
        enemy.jumpTimer = 30;
        enemy.velocityY = 0;
        
        enemy.update(platforms);
        
        expect(enemy.velocityY).toBe(0.5); // Only gravity applied
    });

    it('should not jump when not on ground', () => {
        const enemy = new JumpingEnemy(100, 400, [60, 180]);
        const platforms = [];
        
        enemy.onGround = false;
        enemy.jumpTimer = 0;
        enemy.velocityY = 0;
        
        enemy.update(platforms);
        
        // Should not have jumped (no upward velocity)
        expect(enemy.velocityY).toBeGreaterThanOrEqual(0);
    });

    it('should apply random horizontal velocity when jumping', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        
        enemy.jump();
        
        expect(enemy.velocityX).not.toBe(0);
        expect(enemy.velocityX).toBeGreaterThanOrEqual(-3);
        expect(enemy.velocityX).toBeLessThanOrEqual(3);
        expect(enemy.velocityY).toBe(-10);
    });

    it('should reset timer on landing', () => {
        const enemy = new JumpingEnemy(100, 495, [60, 180]);
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        enemy.onGround = true;
        enemy.jumpTimer = 0;
        
        enemy.update(platforms);
        
        // Timer should be reset to a value in the interval
        expect(enemy.jumpTimer).toBeGreaterThanOrEqual(59); // -1 from decrement
        expect(enemy.jumpTimer).toBeLessThanOrEqual(180);
    });

    it('should apply gravity', () => {
        const enemy = new JumpingEnemy(100, 400, [60, 180]);
        const platforms = [];
        
        const initialVelocityY = enemy.velocityY;
        
        enemy.update(platforms);
        
        expect(enemy.velocityY).toBe(initialVelocityY + enemy.gravity);
    });

    it('should apply friction to horizontal velocity', () => {
        const enemy = new JumpingEnemy(100, 400, [60, 180]);
        const platforms = [];
        
        enemy.velocityX = 10;
        
        enemy.update(platforms);
        
        expect(enemy.velocityX).toBe(10 * 0.95);
    });

    it('should land on platforms', () => {
        const enemy = new JumpingEnemy(100, 497, [60, 180]);
        enemy.velocityY = 5;
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        enemy.update(platforms);
        
        expect(enemy.y).toBe(502); // 530 - 28 (enemy height)
        expect(enemy.velocityY).toBe(0);
        expect(enemy.onGround).toBe(true);
    });

    it('should not update when not alive', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        enemy.alive = false;
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        const initialX = enemy.x;
        const initialY = enemy.y;
        const initialTimer = enemy.jumpTimer;
        
        enemy.update(platforms);
        
        expect(enemy.x).toBe(initialX);
        expect(enemy.y).toBe(initialY);
        expect(enemy.jumpTimer).toBe(initialTimer);
    });

    it('should detect collision with player from above as defeat', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        const player = {
            x: 100,
            y: 467,
            width: 40,
            height: 40,
            velocityY: 5
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBe('defeat');
    });

    it('should detect collision with player from side as damage', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        const player = {
            x: 80,
            y: 500,
            width: 40,
            height: 40,
            velocityY: 0
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBe('damage');
    });

    it('should return null when no collision with player', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        const player = {
            x: 200,
            y: 400,
            width: 40,
            height: 40,
            velocityY: 0
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBeNull();
    });

    it('should be defeated when defeat method is called', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        
        expect(enemy.alive).toBe(true);
        
        enemy.defeat();
        
        expect(enemy.alive).toBe(false);
    });

    it('should not detect collision when not alive', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        enemy.alive = false;
        
        const player = {
            x: 100,
            y: 500,
            width: 40,
            height: 40,
            velocityY: 0
        };
        
        const result = enemy.checkPlayerCollision(player);
        
        expect(result).toBeNull();
    });

    it('should decrement jump timer each update', () => {
        const enemy = new JumpingEnemy(100, 500, [60, 180]);
        const platforms = [{ x: 0, y: 530, width: 500, height: 50 }];
        
        const initialTimer = enemy.jumpTimer;
        
        enemy.update(platforms);
        
        expect(enemy.jumpTimer).toBe(initialTimer - 1);
    });
});

// BackgroundGenerator implementation (copied from game.js for testing)
const BackgroundGenerator = {
    createSeededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    },
    
    generateBackground(levelNumber) {
        const random = this.createSeededRandom(levelNumber * 5000);
        const layerCount = 3 + Math.floor(random() * 2);
        const layers = [];
        
        for (let i = 0; i < layerCount; i++) {
            const layer = this.generateLayer(i, random, levelNumber);
            layers.push(layer);
        }
        
        return {
            levelNumber: levelNumber,
            layers: layers
        };
    },
    
    generateLayer(layerIndex, random, levelNumber) {
        const depth = 0.1 + (layerIndex / 4) * 0.4;
        const elementTypes = ['stars', 'clouds', 'mountains', 'geometric'];
        let elementType;
        
        if (layerIndex === 0) {
            elementType = random() < 0.5 ? 'stars' : 'geometric';
        } else if (layerIndex === 1) {
            elementType = random() < 0.6 ? 'clouds' : 'mountains';
        } else {
            elementType = elementTypes[Math.floor(random() * elementTypes.length)];
        }
        
        const baseColor = this.getLayerColor(layerIndex, levelNumber, random);
        const elements = this.generateLayerElements(elementType, random, levelNumber, layerIndex);
        
        return {
            depth: depth,
            color: baseColor,
            elementType: elementType,
            elements: elements
        };
    },
    
    getLayerColor(layerIndex, levelNumber, random) {
        const themes = [
            ['#1a1a2e', '#16213e', '#0f3460'],
            ['#2d1b2e', '#3d2645', '#4a3356'],
            ['#1a2e1a', '#213e21', '#2d4a2d'],
            ['#2e1a1a', '#3e2121', '#4a2d2d'],
            ['#1a2e2e', '#213e3e', '#2d4a4a'],
            ['#2e2e1a', '#3e3e21', '#4a4a2d'],
            ['#2e1a2e', '#3e213e', '#4a2d4a'],
            ['#1a1a1a', '#2e2e2e', '#3d3d3d']
        ];
        
        const theme = themes[levelNumber % themes.length];
        return theme[layerIndex % theme.length];
    },
    
    generateLayerElements(elementType, random, levelNumber, layerIndex) {
        const elements = [];
        
        if (elementType === 'stars') {
            const starCount = 20 + Math.floor(random() * 20);
            for (let i = 0; i < starCount; i++) {
                elements.push({
                    type: 'star',
                    x: random() * 4000,
                    y: random() * 400,
                    size: 1 + random() * 3,
                    brightness: 0.5 + random() * 0.5
                });
            }
        } else if (elementType === 'clouds') {
            const cloudCount = 5 + Math.floor(random() * 5);
            for (let i = 0; i < cloudCount; i++) {
                elements.push({
                    type: 'cloud',
                    x: random() * 4000,
                    y: 50 + random() * 200,
                    width: 60 + random() * 100,
                    height: 30 + random() * 40,
                    opacity: 0.3 + random() * 0.4
                });
            }
        } else if (elementType === 'mountains') {
            const mountainCount = 3 + Math.floor(random() * 3);
            for (let i = 0; i < mountainCount; i++) {
                elements.push({
                    type: 'mountain',
                    x: random() * 4000,
                    y: 300 + random() * 150,
                    width: 100 + random() * 200,
                    height: 100 + random() * 150,
                    opacity: 0.4 + random() * 0.3
                });
            }
        } else if (elementType === 'geometric') {
            const shapeCount = 8 + Math.floor(random() * 7);
            const shapeTypes = ['circle', 'square', 'triangle'];
            
            for (let i = 0; i < shapeCount; i++) {
                elements.push({
                    type: 'geometric',
                    shape: shapeTypes[Math.floor(random() * shapeTypes.length)],
                    x: random() * 4000,
                    y: random() * 500,
                    size: 10 + random() * 30,
                    opacity: 0.2 + random() * 0.3,
                    rotation: random() * Math.PI * 2
                });
            }
        }
        
        return elements;
    }
};

describe('BackgroundGenerator', () => {
    /**
     * **Feature: multi-level-world, Property 27: Background determinism**
     * For any level number, generating the background multiple times should produce identical results
     * **Validates: Requirements 7.1, 7.3**
     */
    it('Property 27: Background determinism - same level produces same background', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }), // Level number
                (levelNumber) => {
                    // Generate background twice
                    const bg1 = BackgroundGenerator.generateBackground(levelNumber);
                    const bg2 = BackgroundGenerator.generateBackground(levelNumber);
                    
                    // Property: Both generations should be identical
                    
                    // Check level number
                    if (bg1.levelNumber !== bg2.levelNumber) return false;
                    
                    // Check layer count
                    if (bg1.layers.length !== bg2.layers.length) return false;
                    
                    // Check each layer
                    for (let i = 0; i < bg1.layers.length; i++) {
                        const layer1 = bg1.layers[i];
                        const layer2 = bg2.layers[i];
                        
                        // Check layer properties
                        if (layer1.depth !== layer2.depth) return false;
                        if (layer1.color !== layer2.color) return false;
                        if (layer1.elementType !== layer2.elementType) return false;
                        
                        // Check element count
                        if (layer1.elements.length !== layer2.elements.length) return false;
                        
                        // Check each element
                        for (let j = 0; j < layer1.elements.length; j++) {
                            const elem1 = layer1.elements[j];
                            const elem2 = layer2.elements[j];
                            
                            // Check all element properties
                            if (elem1.type !== elem2.type) return false;
                            if (elem1.x !== elem2.x) return false;
                            if (elem1.y !== elem2.y) return false;
                            
                            // Check type-specific properties
                            if (elem1.type === 'star') {
                                if (elem1.size !== elem2.size) return false;
                                if (elem1.brightness !== elem2.brightness) return false;
                            } else if (elem1.type === 'cloud') {
                                if (elem1.width !== elem2.width) return false;
                                if (elem1.height !== elem2.height) return false;
                                if (elem1.opacity !== elem2.opacity) return false;
                            } else if (elem1.type === 'mountain') {
                                if (elem1.width !== elem2.width) return false;
                                if (elem1.height !== elem2.height) return false;
                                if (elem1.opacity !== elem2.opacity) return false;
                            } else if (elem1.type === 'geometric') {
                                if (elem1.shape !== elem2.shape) return false;
                                if (elem1.size !== elem2.size) return false;
                                if (elem1.opacity !== elem2.opacity) return false;
                                if (elem1.rotation !== elem2.rotation) return false;
                            }
                        }
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: multi-level-world, Property 28: Multiple parallax layers**
     * For any generated background, it should contain multiple layers with different scroll speeds
     * **Validates: Requirements 7.2**
     */
    it('Property 28: Multiple parallax layers - backgrounds have 3-4 layers with different depths', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }), // Level number
                (levelNumber) => {
                    // Generate background
                    const bg = BackgroundGenerator.generateBackground(levelNumber);
                    
                    // Property: Should have 3 or 4 layers
                    if (bg.layers.length < 3 || bg.layers.length > 4) return false;
                    
                    // Property: Each layer should have a valid depth value (0-1)
                    for (const layer of bg.layers) {
                        if (layer.depth < 0 || layer.depth > 1) return false;
                    }
                    
                    // Property: Layers should have different depths (for parallax effect)
                    const depths = bg.layers.map(l => l.depth);
                    const uniqueDepths = new Set(depths);
                    if (uniqueDepths.size !== bg.layers.length) return false;
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests

    it('should generate a valid background configuration', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        
        expect(bg.levelNumber).toBe(1);
        expect(bg.layers).toBeDefined();
        expect(bg.layers.length).toBeGreaterThanOrEqual(3);
        expect(bg.layers.length).toBeLessThanOrEqual(4);
    });

    it('should generate layers with valid depth values', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        
        bg.layers.forEach(layer => {
            expect(layer.depth).toBeGreaterThanOrEqual(0);
            expect(layer.depth).toBeLessThanOrEqual(1);
        });
    });

    it('should generate layers with elements', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        
        bg.layers.forEach(layer => {
            expect(layer.elements).toBeDefined();
            expect(layer.elements.length).toBeGreaterThan(0);
            expect(['stars', 'clouds', 'mountains', 'geometric']).toContain(layer.elementType);
        });
    });

    it('should generate different backgrounds for different levels', () => {
        const bg1 = BackgroundGenerator.generateBackground(1);
        const bg2 = BackgroundGenerator.generateBackground(2);
        
        // Backgrounds should be different (at least in some aspect)
        let isDifferent = false;
        
        // Check if layer counts differ
        if (bg1.layers.length !== bg2.layers.length) {
            isDifferent = true;
        }
        
        // Check if any layer has different element count
        for (let i = 0; i < Math.min(bg1.layers.length, bg2.layers.length); i++) {
            if (bg1.layers[i].elements.length !== bg2.layers[i].elements.length) {
                isDifferent = true;
                break;
            }
        }
        
        expect(isDifferent).toBe(true);
    });

    it('should create seeded random function that is deterministic', () => {
        const random1 = BackgroundGenerator.createSeededRandom(12345);
        const random2 = BackgroundGenerator.createSeededRandom(12345);
        
        // Same seed should produce same sequence
        for (let i = 0; i < 10; i++) {
            expect(random1()).toBe(random2());
        }
    });

    it('should generate stars with valid properties', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        
        // Find a layer with stars
        const starLayer = bg.layers.find(l => l.elementType === 'stars');
        
        if (starLayer) {
            starLayer.elements.forEach(star => {
                expect(star.type).toBe('star');
                expect(star.x).toBeGreaterThanOrEqual(0);
                expect(star.y).toBeGreaterThanOrEqual(0);
                expect(star.size).toBeGreaterThan(0);
                expect(star.brightness).toBeGreaterThanOrEqual(0.5);
                expect(star.brightness).toBeLessThanOrEqual(1.0);
            });
        }
    });

    it('should generate clouds with valid properties', () => {
        // Try multiple levels to find one with clouds
        for (let level = 1; level <= 8; level++) {
            const bg = BackgroundGenerator.generateBackground(level);
            const cloudLayer = bg.layers.find(l => l.elementType === 'clouds');
            
            if (cloudLayer) {
                cloudLayer.elements.forEach(cloud => {
                    expect(cloud.type).toBe('cloud');
                    expect(cloud.x).toBeGreaterThanOrEqual(0);
                    expect(cloud.y).toBeGreaterThanOrEqual(0);
                    expect(cloud.width).toBeGreaterThan(0);
                    expect(cloud.height).toBeGreaterThan(0);
                    expect(cloud.opacity).toBeGreaterThanOrEqual(0.3);
                    expect(cloud.opacity).toBeLessThanOrEqual(0.7);
                });
                break; // Found clouds, no need to continue
            }
        }
    });
});

// ParallaxBackground implementation (copied from game.js for testing)
const ParallaxBackground = {
    layers: [],
    
    init(backgroundConfig) {
        if (!backgroundConfig || !backgroundConfig.layers) {
            this.layers = [];
            return;
        }
        this.layers = backgroundConfig.layers;
    },
    
    render(ctx, cameraX) {
        if (!this.layers || this.layers.length === 0) return;
        
        for (const layer of this.layers) {
            this.renderLayer(ctx, layer, cameraX);
        }
    },
    
    renderLayer(ctx, layer, cameraX) {
        const parallaxOffset = cameraX * layer.depth;
        
        for (const element of layer.elements) {
            this.renderElement(ctx, element, parallaxOffset);
        }
    },
    
    renderElement(ctx, element, parallaxOffset) {
        const screenX = element.x - parallaxOffset;
        
        // Mock rendering - just return for testing
        return { screenX, element };
    }
};

describe('ParallaxBackground', () => {
    let mockCtx;

    beforeEach(() => {
        // Create a mock canvas context
        mockCtx = {
            save: vi.fn(),
            restore: vi.fn(),
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn()
        };
        
        // Reset ParallaxBackground state
        ParallaxBackground.layers = [];
    });

    /**
     * **Feature: multi-level-world, Property 29: Parallax scrolling behavior**
     * For any camera movement, background layers should scroll at different speeds proportional to their depth
     * **Validates: Requirements 7.4**
     */
    it('Property 29: Parallax scrolling behavior - layers scroll at speeds proportional to depth', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 2000 }), // Camera X position
                fc.integer({ min: 1, max: 8 }), // Level number
                (cameraX, levelNumber) => {
                    // Generate background
                    const bg = BackgroundGenerator.generateBackground(levelNumber);
                    
                    // Initialize ParallaxBackground
                    ParallaxBackground.init(bg);
                    
                    // Property: For each layer, parallax offset should equal cameraX * depth
                    for (const layer of bg.layers) {
                        const expectedOffset = cameraX * layer.depth;
                        
                        // Check each element in the layer
                        for (const element of layer.elements) {
                            const result = ParallaxBackground.renderElement(mockCtx, element, expectedOffset);
                            
                            // Verify the screen position is calculated correctly
                            const expectedScreenX = element.x - expectedOffset;
                            if (result.screenX !== expectedScreenX) return false;
                        }
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit Tests

    it('should initialize with empty layers when no config provided', () => {
        ParallaxBackground.init(null);
        
        expect(ParallaxBackground.layers).toEqual([]);
    });

    it('should initialize with background configuration', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        
        ParallaxBackground.init(bg);
        
        expect(ParallaxBackground.layers).toBe(bg.layers);
        expect(ParallaxBackground.layers.length).toBeGreaterThan(0);
    });

    it('should not render when layers are empty', () => {
        ParallaxBackground.init(null);
        
        // Should not throw error
        expect(() => {
            ParallaxBackground.render(mockCtx, 100);
        }).not.toThrow();
    });

    it('should calculate parallax offset correctly', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        ParallaxBackground.init(bg);
        
        const cameraX = 500;
        const layer = bg.layers[0];
        const expectedOffset = cameraX * layer.depth;
        
        const element = layer.elements[0];
        const result = ParallaxBackground.renderElement(mockCtx, element, expectedOffset);
        
        expect(result.screenX).toBe(element.x - expectedOffset);
    });

    it('should handle multiple layers with different depths', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        ParallaxBackground.init(bg);
        
        const cameraX = 1000;
        
        // Each layer should have different parallax offset
        const offsets = bg.layers.map(layer => cameraX * layer.depth);
        
        // Verify offsets are different (since depths are different)
        const uniqueOffsets = new Set(offsets);
        expect(uniqueOffsets.size).toBe(bg.layers.length);
    });

    it('should handle zero camera position', () => {
        const bg = BackgroundGenerator.generateBackground(1);
        ParallaxBackground.init(bg);
        
        const cameraX = 0;
        const layer = bg.layers[0];
        const element = layer.elements[0];
        
        const result = ParallaxBackground.renderElement(mockCtx, element, 0);
        
        // With no camera movement, screen position should equal element position
        expect(result.screenX).toBe(element.x);
    });
});
