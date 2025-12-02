package main

import (
	"log"
	"net/http"
)

func main() {
	// Initialize leaderboard store
	store := NewScoreStore()

	// Load existing leaderboard data if available
	if err := store.LoadFromFile("leaderboard.json"); err != nil {
		log.Printf("Warning: Could not load leaderboard data: %v", err)
	}

	// Create leaderboard handler
	leaderboardHandler := NewLeaderboardHandler(store)

	// Static file server
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// Main page
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	// Kiro logo
	http.HandleFunc("/kiro-logo.png", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./kiro-logo.png")
	})

	// Leaderboard API endpoints
	http.HandleFunc("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" || r.Method == "OPTIONS" {
			leaderboardHandler.SubmitScore(w, r)
		} else if r.Method == "GET" {
			leaderboardHandler.GetLeaderboard(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	log.Println("Server starting on http://localhost:3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}
