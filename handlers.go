package main

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// LeaderboardHandler handles HTTP requests for leaderboard operations
type LeaderboardHandler struct {
	store *ScoreStore
}

// NewLeaderboardHandler creates a new LeaderboardHandler
func NewLeaderboardHandler(store *ScoreStore) *LeaderboardHandler {
	return &LeaderboardHandler{
		store: store,
	}
}

// SubmitScore handles POST /api/leaderboard
func (h *LeaderboardHandler) SubmitScore(w http.ResponseWriter, r *http.Request) {
	// Add CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	// Handle preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only accept POST requests
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req struct {
		Score      int    `json:"score"`
		PlayerName string `json:"playerName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.PlayerName == "" {
		http.Error(w, "Player name is required", http.StatusBadRequest)
		return
	}

	if req.Score < 0 {
		http.Error(w, "Score must be non-negative", http.StatusBadRequest)
		return
	}

	// Add score to store
	entry := h.store.AddScore(req.Score, req.PlayerName)

	// Save to file (async to not block response)
	go h.store.SaveToFile("leaderboard.json")

	// Return the created entry
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(entry)
}

// GetLeaderboard handles GET /api/leaderboard
func (h *LeaderboardHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	// Add CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	// Handle preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only accept GET requests
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse limit query parameter (default to 10)
	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	// Get top scores
	scores := h.store.GetTopScores(limit)

	// Return scores
	json.NewEncoder(w).Encode(scores)
}
