package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"raaga/backend/protocol"
)

func setupTestServer() *httptest.Server {
	createLimiter = newIPRateLimiter(time.Minute, 1000, 1000)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", handleRoot)
	mux.HandleFunc("GET /healthz", handleHealthz)
	mux.HandleFunc("GET /api/time", handleTime)
	mux.HandleFunc("POST /api/parties", handleCreateParty)
	mux.HandleFunc("POST /api/parties/{code}/join", handleJoinParty)
	mux.HandleFunc("GET /api/parties/{code}", handleGetParty)
	mux.HandleFunc("GET /api/parties/{code}/preview", handlePreviewParty)
	mux.HandleFunc("POST /api/parties/{code}/leave", handleLeaveParty)
	mux.HandleFunc("GET /invite/{code}", handleInviteLanding)
	mux.HandleFunc("GET /ws/parties/{code}", handleWebSocket)

	return httptest.NewServer(corsMiddleware(mux))
}

func TestRESTEndpoints(t *testing.T) {
	ts := setupTestServer()
	defer ts.Close()

	// 1. Health check
	res, err := http.Get(ts.URL + "/healthz")
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("GET /healthz failed: status %v, err %v", res.StatusCode, err)
	}
	var health map[string]interface{}
	_ = json.NewDecoder(res.Body).Decode(&health)
	if health["ok"] != true {
		t.Fatalf("Expected ok: true in healthz")
	}

	// 1b. Non-existent subpaths must return 404, not root 200
	resBogusHealth, err := http.Get(ts.URL + "/1324/healthz")
	if err != nil || resBogusHealth.StatusCode != http.StatusNotFound {
		t.Fatalf("Expected 404 for /1324/healthz, got %v, err %v", resBogusHealth.StatusCode, err)
	}
	resBogusPath, err := http.Get(ts.URL + "/1324")
	if err != nil || resBogusPath.StatusCode != http.StatusNotFound {
		t.Fatalf("Expected 404 for /1324, got %v, err %v", resBogusPath.StatusCode, err)
	}

	// 2. Server time
	resTime, err := http.Get(ts.URL + "/api/time")
	if err != nil || resTime.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/time failed: status %v, err %v", resTime.StatusCode, err)
	}
	var timeResp map[string]interface{}
	_ = json.NewDecoder(resTime.Body).Decode(&timeResp)
	if _, ok := timeResp["serverMs"].(float64); !ok {
		t.Fatalf("Expected numeric serverMs")
	}

	// 3. Create Party
	createBody := map[string]string{
		"userId":      "u_alice",
		"deviceId":    "d_alice",
		"displayName": "Alice",
	}
	b, _ := json.Marshal(createBody)
	createRes, err := http.Post(ts.URL+"/api/parties", "application/json", bytes.NewReader(b))
	if err != nil || createRes.StatusCode != http.StatusCreated {
		t.Fatalf("POST /api/parties failed: status %v, err %v", createRes.StatusCode, err)
	}
	var partyResp map[string]interface{}
	_ = json.NewDecoder(createRes.Body).Decode(&partyResp)

	code, _ := partyResp["code"].(string)
	token, _ := partyResp["token"].(string)
	if code == "" || token == "" {
		t.Fatalf("Expected code and token in response")
	}

	// 4. Join Party
	joinBody := map[string]string{
		"userId":      "u_bob",
		"deviceId":    "d_bob",
		"displayName": "Bob",
	}
	jb, _ := json.Marshal(joinBody)
	joinRes, err := http.Post(fmt.Sprintf("%s/api/parties/%s/join", ts.URL, code), "application/json", bytes.NewReader(jb))
	if err != nil || joinRes.StatusCode != http.StatusOK {
		t.Fatalf("POST /api/parties/%s/join failed: status %v", code, joinRes.StatusCode)
	}

	// 5. Get Party with token
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/parties/%s", ts.URL, code), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	getRes, err := http.DefaultClient.Do(req)
	if err != nil || getRes.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/parties/%s failed with token: status %v", code, getRes.StatusCode)
	}

	// 6. Get Party without token should be 401
	unauthReq, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/parties/%s", ts.URL, code), nil)
	unauthRes, err := http.DefaultClient.Do(unauthReq)
	if err != nil || unauthRes.StatusCode != http.StatusUnauthorized {
		t.Fatalf("Expected 401 Unauthorized, got %v", unauthRes.StatusCode)
	}
}

func TestWebSocketFlow(t *testing.T) {
	ts := setupTestServer()
	defer ts.Close()

	// Create Party
	createBody := map[string]string{
		"userId":      "u1",
		"deviceId":    "d1",
		"displayName": "Host",
	}
	b, _ := json.Marshal(createBody)
	res, _ := http.Post(ts.URL+"/api/parties", "application/json", bytes.NewReader(b))
	var pResp map[string]interface{}
	_ = json.NewDecoder(res.Body).Decode(&pResp)
	code := pResp["code"].(string)
	token := pResp["token"].(string)

	// Connect WebSocket
	u, _ := url.Parse(ts.URL)
	u.Scheme = "ws"
	u.Path = fmt.Sprintf("/ws/parties/%s", code)
	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+token)
	ws, _, err := websocket.DefaultDialer.Dial(u.String(), headers)
	if err != nil {
		t.Fatalf("WebSocket connection failed: %v", err)
	}
	defer ws.Close()

	// 1. Should receive welcome frame
	var welcome map[string]interface{}
	_ = ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	if err := ws.ReadJSON(&welcome); err != nil {
		t.Fatalf("Failed to read welcome frame: %v", err)
	}
	if welcome["type"] != protocol.FrameWelcome {
		t.Fatalf("Expected welcome frame, got: %v", welcome["type"])
	}

	// 2. May receive members frame from broadcast
	_ = ws.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	var nextFrame map[string]interface{}
	if err := ws.ReadJSON(&nextFrame); err == nil {
		if nextFrame["type"] != protocol.FrameMembers && nextFrame["type"] != protocol.FrameState {
			t.Logf("Received broadcast frame: %v", nextFrame["type"])
		}
	}

	// 3. Send Ping, expect Pong
	ping := map[string]interface{}{
		"type":     protocol.FramePing,
		"clientMs": 123456789,
	}
	if err := ws.WriteJSON(ping); err != nil {
		t.Fatalf("Failed to write ping: %v", err)
	}

	var pong map[string]interface{}
	for {
		_ = ws.SetReadDeadline(time.Now().Add(2 * time.Second))
		if err := ws.ReadJSON(&pong); err != nil {
			t.Fatalf("Failed to read pong: %v", err)
		}
		if pong["type"] == protocol.FramePong {
			break
		}
	}
	if pong["clientMs"] != float64(123456789) {
		t.Errorf("Expected pong clientMs to match, got %v", pong["clientMs"])
	}

	// 4. Send queueAdd control
	addControl := map[string]interface{}{
		"type":   protocol.FrameControl,
		"action": protocol.ActionQueueAdd,
		"track": map[string]interface{}{
			"videoId": "abc_song",
			"title":   "Test Song",
			"artist":  "Artist",
		},
	}
	if err := ws.WriteJSON(addControl); err != nil {
		t.Fatalf("Failed to send queueAdd: %v", err)
	}

	// Read until queue frame or state frame received
	var receivedQueue bool
	for i := 0; i < 5; i++ {
		_ = ws.SetReadDeadline(time.Now().Add(2 * time.Second))
		var f map[string]interface{}
		if err := ws.ReadJSON(&f); err != nil {
			break
		}
		if f["type"] == protocol.FrameQueue {
			receivedQueue = true
			qData, _ := f["queue"].(map[string]interface{})
			items, _ := qData["items"].([]interface{})
			if len(items) != 1 {
				t.Errorf("Expected 1 item in queue, got %d", len(items))
			}
			break
		}
	}
	if !receivedQueue {
		t.Fatalf("Expected queue broadcast after queueAdd")
	}
}

func TestCreateRateLimiter(t *testing.T) {
	limiter := newIPRateLimiter(time.Minute, 2, 100)
	if !limiter.Allow("203.0.113.10") || !limiter.Allow("203.0.113.10") {
		t.Fatal("expected the first two creations from an IP to be allowed")
	}
	if limiter.Allow("203.0.113.10") {
		t.Fatal("expected the third creation from an IP to be rate limited")
	}
	if !limiter.Allow("203.0.113.11") {
		t.Fatal("expected a separate IP to have its own allowance")
	}
}

func TestInviteLanding(t *testing.T) {
	ts := setupTestServer()
	defer ts.Close()

	// 1. Non-existent party
	res, err := http.Get(ts.URL + "/invite/ZZZZZZ")
	if err != nil {
		t.Fatalf("GET /invite/ZZZZZZ failed: %v", err)
	}
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404 for non-existent party, got %d", res.StatusCode)
	}

	// 2. Create an active party directly in store
	p, err := store.Create()
	if err != nil {
		t.Fatalf("Party creation failed: %v", err)
	}
	code := p.Code

	// 3. Active party landing page
	resActive, err := http.Get(ts.URL + "/invite/" + code)
	if err != nil {
		t.Fatalf("GET /invite/%s failed: %v", code, err)
	}
	if resActive.StatusCode != http.StatusOK {
		t.Errorf("Expected 200 for active party invite, got %d", resActive.StatusCode)
	}
	buf := new(bytes.Buffer)
	_, _ = buf.ReadFrom(resActive.Body)
	content := buf.String()

	expectedDeepLinkPrefix := "raaga://party/" + code
	if !strings.Contains(content, expectedDeepLinkPrefix) {
		t.Errorf("Expected HTML content to contain deep link %s", expectedDeepLinkPrefix)
	}
	if !strings.Contains(content, code) {
		t.Errorf("Expected HTML content to contain party code %s", code)
	}
}

func TestControlFramesDeadlockRegression(t *testing.T) {
	ts := setupTestServer()
	defer ts.Close()

	// 1. Create party
	createBody, _ := json.Marshal(map[string]interface{}{
		"userId":      "u1",
		"deviceId":    "d1",
		"displayName": "HostUser",
	})
	res, err := http.Post(ts.URL+"/api/parties", "application/json", bytes.NewReader(createBody))
	if err != nil {
		t.Fatalf("Party creation failed: %v", err)
	}
	var created map[string]interface{}
	_ = json.NewDecoder(res.Body).Decode(&created)
	code := created["code"].(string)
	hostToken := created["token"].(string)

	// 2. Member B joins via REST
	joinBody, _ := json.Marshal(map[string]interface{}{
		"userId":      "u2",
		"deviceId":    "d2",
		"displayName": "GuestUser",
	})
	resJoin, err := http.Post(ts.URL+"/api/parties/"+code+"/join", "application/json", bytes.NewReader(joinBody))
	if err != nil {
		t.Fatalf("Join failed: %v", err)
	}
	var joined map[string]interface{}
	_ = json.NewDecoder(resJoin.Body).Decode(&joined)
	guestToken := joined["token"].(string)

	// 3. Connect Host and Guest over WebSockets
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/parties/" + code
	hHeaders := http.Header{"Authorization": []string{"Bearer " + hostToken}}
	hostWs, _, err := websocket.DefaultDialer.Dial(wsURL, hHeaders)
	if err != nil {
		t.Fatalf("Host WS connect failed: %v", err)
	}
	defer hostWs.Close()

	gHeaders := http.Header{"Authorization": []string{"Bearer " + guestToken}}
	guestWs, _, err := websocket.DefaultDialer.Dial(wsURL, gHeaders)
	if err != nil {
		t.Fatalf("Guest WS connect failed: %v", err)
	}
	defer guestWs.Close()

	// Read welcome frames
	var f map[string]interface{}
	_ = hostWs.ReadJSON(&f) // welcome
	_ = guestWs.ReadJSON(&f) // welcome

	// 4. Send multiple controls: play, pause, seek, setTrack
	controls := []map[string]interface{}{
		{
			"type":       protocol.FrameControl,
			"action":     protocol.ActionPlay,
			"positionMs": 1500.0,
		},
		{
			"type":       protocol.FrameControl,
			"action":     protocol.ActionPause,
			"positionMs": 2500.0,
		},
		{
			"type":       protocol.FrameControl,
			"action":     protocol.ActionSeek,
			"positionMs": 10000.0,
		},
	}

	for _, c := range controls {
		if err := hostWs.WriteJSON(c); err != nil {
			t.Fatalf("Failed to write control %v: %v", c["action"], err)
		}
	}

	// Guest should receive broadcast state frames without deadlock
	receivedStates := 0
	for i := 0; i < 10; i++ {
		_ = guestWs.SetReadDeadline(time.Now().Add(1 * time.Second))
		var gf map[string]interface{}
		if err := guestWs.ReadJSON(&gf); err != nil {
			break
		}
		if gf["type"] == protocol.FrameState {
			receivedStates++
			if receivedStates >= 3 {
				break
			}
		}
	}

	if receivedStates < 3 {
		t.Errorf("Expected at least 3 state frames received by guest without deadlock, got %d", receivedStates)
	}
}

func TestCrossDeviceCloudJoinAndControlFlow(t *testing.T) {
	ts := setupTestServer()
	defer ts.Close()

	// 1. Invalid room code produces a clear error (404)
	invRes, err := http.Get(ts.URL + "/api/parties/INVALID/preview")
	if err != nil || invRes.StatusCode != http.StatusNotFound {
		t.Fatalf("Expected 404 for invalid room code, got %v", invRes.StatusCode)
	}

	// 2. Android Phone A creates a cloud room
	createBody, _ := json.Marshal(map[string]interface{}{
		"userId":      "usr_phone_a",
		"deviceId":    "dev_phone_a",
		"displayName": "Phone A (Host)",
		"maxMembers":  5,
	})
	reqA, _ := http.NewRequest("POST", ts.URL+"/api/parties", bytes.NewReader(createBody))
	reqA.Header.Set("Content-Type", "application/json")
	reqA.Header.Set("X-Forwarded-For", "198.51.100.10") // Network A
	resA, err := http.DefaultClient.Do(reqA)
	if err != nil || resA.StatusCode != http.StatusCreated {
		t.Fatalf("Phone A create party failed: status %v, err %v", resA.StatusCode, err)
	}
	var createdA map[string]interface{}
	_ = json.NewDecoder(resA.Body).Decode(&createdA)
	code := createdA["code"].(string)
	tokenA := createdA["token"].(string)
	if code == "" || tokenA == "" {
		t.Fatalf("Invalid response for Phone A: %v", createdA)
	}

	// 3. Android Phone B joins using the same cloud server from a different network
	joinBody, _ := json.Marshal(map[string]interface{}{
		"userId":      "usr_phone_b",
		"deviceId":    "dev_phone_b",
		"displayName": "Phone B (Listener)",
	})
	reqB, _ := http.NewRequest("POST", ts.URL+"/api/parties/"+code+"/join", bytes.NewReader(joinBody))
	reqB.Header.Set("Content-Type", "application/json")
	reqB.Header.Set("X-Forwarded-For", "203.0.113.195") // Different Network B (cellular/remote Wi-Fi)
	resB, err := http.DefaultClient.Do(reqB)
	if err != nil || resB.StatusCode != http.StatusOK {
		t.Fatalf("Phone B join party failed: status %v, err %v", resB.StatusCode, err)
	}
	var joinedB map[string]interface{}
	_ = json.NewDecoder(resB.Body).Decode(&joinedB)
	tokenB := joinedB["token"].(string)
	if tokenB == "" {
		t.Fatalf("Invalid token for Phone B")
	}

	// 4. Both phones connect over WebSocket to the cloud server
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/parties/" + code
	wsA, _, err := websocket.DefaultDialer.Dial(wsURL, http.Header{"Authorization": []string{"Bearer " + tokenA}})
	if err != nil {
		t.Fatalf("Phone A WebSocket connect failed: %v", err)
	}
	defer wsA.Close()

	wsB, _, err := websocket.DefaultDialer.Dial(wsURL, http.Header{"Authorization": []string{"Bearer " + tokenB}})
	if err != nil {
		t.Fatalf("Phone B WebSocket connect failed: %v", err)
	}
	defer wsB.Close()

	// 5. Both phones receive the welcome frame
	var welcomeA map[string]interface{}
	if err := wsA.ReadJSON(&welcomeA); err != nil || welcomeA["type"] != protocol.FrameWelcome {
		t.Fatalf("Phone A did not receive welcome frame: %v, err: %v", welcomeA, err)
	}
	var welcomeB map[string]interface{}
	if err := wsB.ReadJSON(&welcomeB); err != nil || welcomeB["type"] != protocol.FrameWelcome {
		t.Fatalf("Phone B did not receive welcome frame: %v, err: %v", welcomeB, err)
	}

	// Drain any initial members broadcast frame
	_ = wsA.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	var dummyA map[string]interface{}
	_ = wsA.ReadJSON(&dummyA)
	_ = wsB.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	var dummyB map[string]interface{}
	_ = wsB.ReadJSON(&dummyB)

	// 6. Play, pause, seek, and next work:
	// A) Play control
	playControl := map[string]interface{}{
		"type":       protocol.FrameControl,
		"action":     protocol.ActionPlay,
		"positionMs": 5000.0,
	}
	if err := wsA.WriteJSON(playControl); err != nil {
		t.Fatalf("Failed to write play control: %v", err)
	}

	// Verify Phone B receives playback state update with isPlaying = true
	var statePlay map[string]interface{}
	for i := 0; i < 5; i++ {
		_ = wsB.SetReadDeadline(time.Now().Add(1 * time.Second))
		var f map[string]interface{}
		if err := wsB.ReadJSON(&f); err == nil {
			if f["type"] == protocol.FrameState {
				statePlay = f
				break
			}
		}
	}
	if statePlay == nil {
		t.Fatalf("Phone B did not receive state frame after play")
	}
	pbPlay, _ := statePlay["playback"].(map[string]interface{})
	if pbPlay["isPlaying"] != true {
		t.Errorf("Expected isPlaying == true after play, got %v", pbPlay["isPlaying"])
	}

	// B) Pause control
	pauseControl := map[string]interface{}{
		"type":       protocol.FrameControl,
		"action":     protocol.ActionPause,
		"positionMs": 12000.0,
	}
	if err := wsA.WriteJSON(pauseControl); err != nil {
		t.Fatalf("Failed to write pause control: %v", err)
	}
	var statePause map[string]interface{}
	for i := 0; i < 5; i++ {
		_ = wsB.SetReadDeadline(time.Now().Add(1 * time.Second))
		var f map[string]interface{}
		if err := wsB.ReadJSON(&f); err == nil {
			if f["type"] == protocol.FrameState {
				statePause = f
				break
			}
		}
	}
	if statePause == nil {
		t.Fatalf("Phone B did not receive state frame after pause")
	}
	pbPause, _ := statePause["playback"].(map[string]interface{})
	if pbPause["isPlaying"] != false {
		t.Errorf("Expected isPlaying == false after pause, got %v", pbPause["isPlaying"])
	}

	// C) Seek control
	seekControl := map[string]interface{}{
		"type":       protocol.FrameControl,
		"action":     protocol.ActionSeek,
		"positionMs": 45000.0,
	}
	if err := wsA.WriteJSON(seekControl); err != nil {
		t.Fatalf("Failed to write seek control: %v", err)
	}
	var stateSeek map[string]interface{}
	for i := 0; i < 5; i++ {
		_ = wsB.SetReadDeadline(time.Now().Add(1 * time.Second))
		var f map[string]interface{}
		if err := wsB.ReadJSON(&f); err == nil {
			if f["type"] == protocol.FrameState {
				stateSeek = f
				break
			}
		}
	}
	if stateSeek == nil {
		t.Fatalf("Phone B did not receive state frame after seek")
	}
	pbSeek, _ := stateSeek["playback"].(map[string]interface{})
	if pos, ok := pbSeek["positionMs"].(float64); !ok || pos != 45000.0 {
		t.Errorf("Expected positionMs == 45000 after seek, got %v", pbSeek["positionMs"])
	}

	// D) Next control (next)
	nextControl := map[string]interface{}{
		"type":   protocol.FrameControl,
		"action": protocol.ActionNext,
	}
	if err := wsA.WriteJSON(nextControl); err != nil {
		t.Fatalf("Failed to write next control: %v", err)
	}

	// 7. A WebSocket reconnect retains membership
	_ = wsB.Close()
	time.Sleep(50 * time.Millisecond)

	wsBReconnect, _, err := websocket.DefaultDialer.Dial(wsURL, http.Header{"Authorization": []string{"Bearer " + tokenB}})
	if err != nil {
		t.Fatalf("Phone B reconnect failed: %v", err)
	}
	defer wsBReconnect.Close()

	var welcomeReconnect map[string]interface{}
	_ = wsBReconnect.SetReadDeadline(time.Now().Add(2 * time.Second))
	if err := wsBReconnect.ReadJSON(&welcomeReconnect); err != nil || welcomeReconnect["type"] != protocol.FrameWelcome {
		t.Fatalf("Phone B did not receive welcome frame on reconnect: %v, err: %v", welcomeReconnect, err)
	}
	partyWire, _ := welcomeReconnect["party"].(map[string]interface{})
	membersList, _ := partyWire["members"].([]interface{})
	if len(membersList) != 2 {
		t.Errorf("Expected 2 members preserved after reconnect, got %d", len(membersList))
	}

	// 8. Backend restart behavior tested against persistence layer:
	pBeforeRestart, err := store.Get(code)
	if err != nil {
		t.Fatalf("Failed to get party from store: %v", err)
	}
	store.Save(pBeforeRestart)

	// Simulate server process restart: purge all in-memory parties
	store.ClearCacheForTest()

	// Reload party from persistence backend
	pAfterRestart, err := store.Get(code)
	if err != nil {
		t.Fatalf("Failed to reload party from persistence layer after simulated restart: %v", err)
	}
	if pAfterRestart.Code != code {
		t.Errorf("Reloaded party code mismatch: got %s, want %s", pAfterRestart.Code, code)
	}

	// Check that members and tokens survived restart
	pAfterRestart.Lock()
	memA, errA := pAfterRestart.Authenticate(tokenA)
	memB, errB := pAfterRestart.Authenticate(tokenB)
	pAfterRestart.Unlock()

	if errA != nil || memA == nil || !memA.IsHost {
		t.Errorf("Host A auth failed after restart: %v", errA)
	}
	if errB != nil || memB == nil {
		t.Errorf("Listener B auth failed after restart: %v", errB)
	}
}
