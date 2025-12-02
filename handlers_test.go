package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
)

// Test POST endpoint with valid data
func TestSubmitScoreValid(t *testing.T) {
	store := NewScoreStore()
	handler := NewLeaderboardHandler(store)

	reqBody := map[string]interface{}{
		"score":      1000,
		"playerName": "TestPlayer",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/leaderboard", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.SubmitScore(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}

	var response ScoreEntry
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response.Score != 1000 {
		t.Errorf("Expected score 1000, got %d", response.Score)
	}

	if response.PlayerName != "TestPlayer" {
		t.Errorf("Expected player name 'TestPlayer', got '%s'", response.PlayerName)
	}

	if response.ID == "" {
		t.Error("Expected non-empty ID")
	}
}

// Test POST endpoint with invalid data (400 response)
func TestSubmitScoreInvalid(t *testing.T) {
	store := NewScoreStore()
	handler := NewLeaderboardHandler(store)

	tests := []struct {
		name     string
		reqBody  map[string]interface{}
		wantCode int
	}{
		{
			name:     "missing player name",
			reqBody:  map[string]interface{}{"score": 1000},
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "empty player name",
			reqBody:  map[string]interface{}{"score": 1000, "playerName": ""},
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "negative score",
			reqBody:  map[string]interface{}{"score": -100, "playerName": "Test"},
			wantCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/leaderboard", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.SubmitScore(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("Expected status %d, got %d", tt.wantCode, w.Code)
			}
		})
	}
}

// Test GET endpoint returns sorted scores
func TestGetLeaderboardSorted(t *testing.T) {
	store := NewScoreStore()
	handler := NewLeaderboardHandler(store)

	// Add scores in random order
	store.AddScore(500, "Player1")
	store.AddScore(1000, "Player2")
	store.AddScore(250, "Player3")
	store.AddScore(750, "Player4")

	req := httptest.NewRequest("GET", "/api/leaderboard", nil)
	w := httptest.NewRecorder()

	handler.GetLeaderboard(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var scores []ScoreEntry
	if err := json.NewDecoder(w.Body).Decode(&scores); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Verify descending order
	for i := 1; i < len(scores); i++ {
		if scores[i-1].Score < scores[i].Score {
			t.Errorf("Scores not in descending order: %d < %d", scores[i-1].Score, scores[i].Score)
		}
	}

	// Verify expected order
	expectedScores := []int{1000, 750, 500, 250}
	for i, expected := range expectedScores {
		if scores[i].Score != expected {
			t.Errorf("Expected score %d at position %d, got %d", expected, i, scores[i].Score)
		}
	}
}

// Test GET endpoint respects limit parameter
func TestGetLeaderboardLimit(t *testing.T) {
	store := NewScoreStore()
	handler := NewLeaderboardHandler(store)

	// Add 15 scores
	for i := 0; i < 15; i++ {
		store.AddScore(i*100, "Player"+string(rune('A'+i)))
	}

	tests := []struct {
		name      string
		limit     string
		wantCount int
	}{
		{"default limit", "", 10},
		{"limit 5", "5", 5},
		{"limit 20", "20", 15}, // Only 15 entries exist
		{"limit 1", "1", 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/leaderboard"
			if tt.limit != "" {
				url += "?limit=" + tt.limit
			}

			req := httptest.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()

			handler.GetLeaderboard(w, req)

			var scores []ScoreEntry
			if err := json.NewDecoder(w.Body).Decode(&scores); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if len(scores) != tt.wantCount {
				t.Errorf("Expected %d scores, got %d", tt.wantCount, len(scores))
			}
		})
	}
}

// Test concurrent score submissions
func TestConcurrentSubmissions(t *testing.T) {
	store := NewScoreStore()

	var wg sync.WaitGroup
	numGoroutines := 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(score int) {
			defer wg.Done()
			store.AddScore(score, "Player")
		}(i)
	}

	wg.Wait()

	scores := store.GetTopScores(0)
	if len(scores) != numGoroutines {
		t.Errorf("Expected %d scores, got %d", numGoroutines, len(scores))
	}
}

// Test file persistence and loading
func TestFilePersistence(t *testing.T) {
	filename := "test_leaderboard.json"
	defer os.Remove(filename)

	// Create store and add scores
	store1 := NewScoreStore()
	store1.AddScore(1000, "Player1")
	store1.AddScore(500, "Player2")
	store1.AddScore(750, "Player3")

	// Save to file
	if err := store1.SaveToFile(filename); err != nil {
		t.Fatalf("Failed to save to file: %v", err)
	}

	// Create new store and load from file
	store2 := NewScoreStore()
	if err := store2.LoadFromFile(filename); err != nil {
		t.Fatalf("Failed to load from file: %v", err)
	}

	// Verify scores match
	scores1 := store1.GetTopScores(0)
	scores2 := store2.GetTopScores(0)

	if len(scores1) != len(scores2) {
		t.Errorf("Expected %d scores, got %d", len(scores1), len(scores2))
	}

	for i := range scores1 {
		if scores1[i].Score != scores2[i].Score {
			t.Errorf("Score mismatch at position %d: %d != %d", i, scores1[i].Score, scores2[i].Score)
		}
		if scores1[i].PlayerName != scores2[i].PlayerName {
			t.Errorf("Player name mismatch at position %d: %s != %s", i, scores1[i].PlayerName, scores2[i].PlayerName)
		}
	}
}
