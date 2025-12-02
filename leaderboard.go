package main

import (
	"encoding/json"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ScoreEntry represents a single leaderboard entry
type ScoreEntry struct {
	ID         string    `json:"id"`
	Score      int       `json:"score"`
	PlayerName string    `json:"playerName"`
	Timestamp  time.Time `json:"timestamp"`
}

// ScoreStore manages leaderboard entries with thread-safe operations
type ScoreStore struct {
	entries []ScoreEntry
	mu      sync.RWMutex
}

// NewScoreStore creates a new ScoreStore instance
func NewScoreStore() *ScoreStore {
	return &ScoreStore{
		entries: make([]ScoreEntry, 0),
	}
}

// AddScore adds a new score entry to the store
func (s *ScoreStore) AddScore(score int, playerName string) ScoreEntry {
	s.mu.Lock()
	defer s.mu.Unlock()

	entry := ScoreEntry{
		ID:         uuid.New().String(),
		Score:      score,
		PlayerName: playerName,
		Timestamp:  time.Now(),
	}

	s.entries = append(s.entries, entry)
	return entry
}

// GetTopScores returns the top N scores sorted by score descending
func (s *ScoreStore) GetTopScores(limit int) []ScoreEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Create a copy to avoid modifying the original slice
	entriesCopy := make([]ScoreEntry, len(s.entries))
	copy(entriesCopy, s.entries)

	// Sort by score descending
	sort.Slice(entriesCopy, func(i, j int) bool {
		return entriesCopy[i].Score > entriesCopy[j].Score
	})

	// Limit the results
	if limit > 0 && limit < len(entriesCopy) {
		entriesCopy = entriesCopy[:limit]
	}

	return entriesCopy
}

// SaveToFile persists the leaderboard to a JSON file
func (s *ScoreStore) SaveToFile(filename string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := json.MarshalIndent(s.entries, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

// LoadFromFile loads the leaderboard from a JSON file
func (s *ScoreStore) LoadFromFile(filename string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(filename)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist yet, start with empty entries
			s.entries = make([]ScoreEntry, 0)
			return nil
		}
		return err
	}

	return json.Unmarshal(data, &s.entries)
}
