package party

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"raaga/backend/config"
)

func TestPersistentStateRoundTrip(t *testing.T) {
	p := NewPartyWithMaxMembers("RDTRIP", 5)
	p.HostOnlyControl = true
	p.HostIP = "192.168.1.10"

	m1, err := p.Join("u1", "d1", "Host Alice", nil)
	if err != nil {
		t.Fatalf("Join failed: %v", err)
	}
	m2, err := p.Join("u2", "d2", "Guest Bob", nil)
	if err != nil {
		t.Fatalf("Join failed: %v", err)
	}

	track1 := &Track{
		VideoId: "vid1",
		Title:   "Song One",
		Artist:  "Artist One",
	}
	track2 := &Track{
		VideoId: "vid2",
		Title:   "Song Two",
		Artist:  "Artist Two",
	}

	p.Playback.SetTrack(&m1.MemberId, track1, 4500, true, nil, &m1.DisplayName)
	_, _ = p.Playback.AddUpcoming(&m1.MemberId, []*Track{track2}, false)

	// Convert to persistent
	persistent := p.ToPersistent()
	if persistent.Code != "RDTRIP" {
		t.Errorf("Code = %q, want RDTRIP", persistent.Code)
	}
	if len(persistent.Members) != 2 {
		t.Errorf("Members count = %d, want 2", len(persistent.Members))
	}
	if persistent.Playback.QueueSeq == 0 {
		t.Errorf("QueueSeq = %d, want > 0", persistent.Playback.QueueSeq)
	}
	if len(persistent.Playback.Queue) != 1 {
		t.Errorf("Queue length = %d, want 1", len(persistent.Playback.Queue))
	}
	if persistent.Members[m1.MemberId].Token == "" || persistent.Members[m2.MemberId].Token == "" {
		t.Errorf("Persistent members must preserve tokens")
	}

	// Rehydrate from persistent
	rehydrated := FromPersistent(persistent)
	if rehydrated.Code != "RDTRIP" {
		t.Errorf("Rehydrated code = %q, want RDTRIP", rehydrated.Code)
	}
	if rehydrated.MaxMembers != 5 {
		t.Errorf("Rehydrated MaxMembers = %d, want 5", rehydrated.MaxMembers)
	}
	if !rehydrated.HostOnlyControl {
		t.Errorf("Rehydrated HostOnlyControl = false, want true")
	}
	if len(rehydrated.Members) != 2 {
		t.Fatalf("Rehydrated members count = %d, want 2", len(rehydrated.Members))
	}
	rm1 := rehydrated.Members[m1.MemberId]
	if rm1.Token != m1.Token {
		t.Errorf("Token mismatch: got %q, want %q", rm1.Token, m1.Token)
	}
	if rm1.DeviceId != m1.DeviceId {
		t.Errorf("DeviceId mismatch: got %q, want %q", rm1.DeviceId, m1.DeviceId)
	}
	if !rm1.IsHost {
		t.Errorf("Host flag not preserved on rm1")
	}

	// Playback checks
	if rehydrated.Playback.Track == nil || rehydrated.Playback.Track.VideoId != "vid1" {
		t.Errorf("Playback track not preserved")
	}
	if len(rehydrated.Playback.Queue) != 1 || rehydrated.Playback.Queue[0].VideoId != "vid2" {
		t.Errorf("Playback queue not preserved")
	}
	if rehydrated.Playback.Seq != p.Playback.Seq {
		t.Errorf("Playback seq mismatch: got %d, want %d", rehydrated.Playback.Seq, p.Playback.Seq)
	}
}

func TestRedisStoreBackendWithMiniredis(t *testing.T) {
	// Start in-process Redis server
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisURL := "redis://" + s.Addr()
	rb1, err := NewRedisStoreBackend(redisURL)
	if err != nil {
		t.Fatalf("Failed to connect to miniredis: %v", err)
	}
	defer rb1.Close()

	// Server Instance 1
	store1 := NewPartyStoreWithBackend(rb1)
	p1, err := store1.CreateWithLimits(10, 5)
	if err != nil {
		t.Fatalf("Failed to create party on store1: %v", err)
	}
	code := p1.Code

	mHost, err := p1.Join("u_host", "d_host", "Host", nil)
	if err != nil {
		t.Fatalf("Host join failed: %v", err)
	}
	store1.Save(p1)

	// Server Instance 2 (simulating multi-instance or post-restart)
	rb2, err := NewRedisStoreBackend(redisURL)
	if err != nil {
		t.Fatalf("Failed to connect instance 2 to miniredis: %v", err)
	}
	defer rb2.Close()

	store2 := NewPartyStoreWithBackend(rb2)

	// Instance 2 should load the party from Redis even though its local RAM was empty
	p2, err := store2.Get(code)
	if err != nil {
		t.Fatalf("Instance 2 failed to load party from Redis: %v", err)
	}
	if p2.Code != code {
		t.Errorf("Instance 2 loaded code %q, want %q", p2.Code, code)
	}
	if len(p2.Members) != 1 {
		t.Errorf("Instance 2 loaded %d members, want 1", len(p2.Members))
	}

	// Verify token authentication works on Instance 2
	mAuth, err := p2.Authenticate(mHost.Token)
	if err != nil || mAuth.MemberId != mHost.MemberId {
		t.Fatalf("Instance 2 failed to authenticate host token from Redis: %v", err)
	}

	// Guest joins on Instance 2
	mGuest, err := p2.Join("u_guest", "d_guest", "Guest", nil)
	if err != nil {
		t.Fatalf("Guest join on instance 2 failed: %v", err)
	}
	store2.Save(p2)

	// Instance 3 (after a restart) loads updated party
	rb3, _ := NewRedisStoreBackend(redisURL)
	defer rb3.Close()
	store3 := NewPartyStoreWithBackend(rb3)
	p3, err := store3.Get(code)
	if err != nil {
		t.Fatalf("Instance 3 failed to load party: %v", err)
	}
	if len(p3.Members) != 2 {
		t.Errorf("Instance 3 expected 2 members after join, got %d", len(p3.Members))
	}
	mGuestAuth, err := p3.Authenticate(mGuest.Token)
	if err != nil || mGuestAuth.MemberId != mGuest.MemberId {
		t.Fatalf("Guest authentication on instance 3 failed: %v", err)
	}

	// Test Drop removes from Redis
	store3.Drop(code)
	_, err = store3.Get(code)
	if err == nil {
		t.Errorf("Expected 404 after drop, but party was found")
	}

	// Test Miniredis TTL fast forward
	pExp, _ := store1.CreateWithLimits(10, 5)
	store1.Save(pExp)
	expCode := pExp.Code
	s.FastForward(time.Duration(config.PartyMaxAgeMs+1000) * time.Millisecond)

	// Key should be expired in Redis
	ctx := context.Background()
	val, _ := rb1.client.Get(ctx, "raaga:party:"+expCode).Result()
	if val != "" {
		t.Errorf("Expected party key to expire after PartyMaxAgeMs in Redis")
	}
}
