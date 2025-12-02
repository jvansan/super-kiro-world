package main

import (
	"math/rand"
	"testing"
	"testing/quick"
)

// **Feature: game-enhancements, Property 6: Leaderboard ordering**
// For any leaderboard with more than ten entries, only the top ten scores
// should be displayed in descending order
// **Validates: Requirements 2.4**
func TestLeaderboardOrdering(t *testing.T) {
	config := &quick.Config{MaxCount: 100}

	property := func(scores []int) bool {
		// Skip empty or single-element cases
		if len(scores) == 0 {
			return true
		}

		// Create a new store
		store := NewScoreStore()

		// Add all scores with random player names
		for i, score := range scores {
			// Ensure non-negative scores
			if score < 0 {
				score = -score
			}
			playerName := "Player" + string(rune('A'+i%26))
			store.AddScore(score, playerName)
		}

		// Get top scores (no limit to check full ordering)
		topScores := store.GetTopScores(0)

		// Verify descending order
		for i := 1; i < len(topScores); i++ {
			if topScores[i-1].Score < topScores[i].Score {
				return false
			}
		}

		return true
	}

	if err := quick.Check(property, config); err != nil {
		t.Error(err)
	}
}

// Generate random scores for property testing
func generateScores(rand *rand.Rand, size int) []int {
	scores := make([]int, size)
	for i := 0; i < size; i++ {
		scores[i] = rand.Intn(10000)
	}
	return scores
}

// **Feature: game-enhancements, Property 4: Leaderboard limit enforcement**
// For any leaderboard query with a limit, the returned results should never
// exceed that limit
// **Validates: Requirements 2.4**
func TestLeaderboardLimitEnforcement(t *testing.T) {
	config := &quick.Config{MaxCount: 100}

	property := func(scores []int, limit uint8) bool {
		// Convert limit to int and ensure it's reasonable (1-100)
		limitInt := int(limit)
		if limitInt == 0 {
			limitInt = 1
		}
		if limitInt > 100 {
			limitInt = 100
		}

		// Skip if no scores
		if len(scores) == 0 {
			return true
		}

		// Create a new store
		store := NewScoreStore()

		// Add all scores with random player names
		for i, score := range scores {
			// Ensure non-negative scores
			if score < 0 {
				score = -score
			}
			playerName := "Player" + string(rune('A'+i%26))
			store.AddScore(score, playerName)
		}

		// Get top scores with limit
		topScores := store.GetTopScores(limitInt)

		// Verify the returned count doesn't exceed the limit
		if len(topScores) > limitInt {
			return false
		}

		// Also verify we get the expected count (min of limit and total entries)
		expectedCount := limitInt
		if len(scores) < limitInt {
			expectedCount = len(scores)
		}

		return len(topScores) == expectedCount
	}

	if err := quick.Check(property, config); err != nil {
		t.Error(err)
	}
}
