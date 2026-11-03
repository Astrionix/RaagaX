package party

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"raaga/backend/config"
)

// PersistentMember represents a member with authentication credentials and metadata for persistence.
type PersistentMember struct {
	MemberId    string  `json:"memberId"`
	UserId      string  `json:"userId"`
	DeviceId    string  `json:"deviceId"`
	DisplayName string  `json:"displayName"`
	AvatarUrl   *string `json:"avatarUrl,omitempty"`
	Token       string  `json:"token"`
	IsHost      bool    `json:"isHost"`
	Connected   bool    `json:"connected"`
	JoinedAtMs  int64   `json:"joinedAtMs"`
	LastSeenMs  int64   `json:"lastSeenMs"`
}

// PersistentPlayback captures all playback and queue state for cross-instance persistence.
type PersistentPlayback struct {
	Track               *Track   `json:"track"`
	Queue               []*Track `json:"queue"`
	QueueIndex          int      `json:"queueIndex"`
	IsPlaying           bool     `json:"isPlaying"`
	PositionMs          int64    `json:"positionMs"`
	AnchorMs            int64    `json:"anchorMs"`
	Seq                 int      `json:"seq"`
	QueueSeq            int      `json:"queueSeq"`
	UpdatedBy           *string  `json:"updatedBy,omitempty"`
	UpdatedAtMs         int64    `json:"updatedAtMs"`
	StartedBy           *string  `json:"startedBy,omitempty"`
	StartedByName       *string  `json:"startedByName,omitempty"`
	AutoplayEnabled     bool     `json:"autoplayEnabled"`
	LastTrackChangeAtMs int64    `json:"lastTrackChangeAtMs"`
}

// PersistentParty holds complete state needed to reconstruct a party on another instance or after restart.
type PersistentParty struct {
	Code            string                       `json:"code"`
	MaxMembers      int                          `json:"maxMembers"`
	HostOnlyControl bool                         `json:"hostOnlyControl"`
	HostIP          string                       `json:"hostIp"`
	CreatedAtMs     int64                        `json:"createdAtMs"`
	TouchedAtMs     int64                        `json:"touchedAtMs"`
	EmptySinceMs    *int64                       `json:"emptySinceMs,omitempty"`
	Members         map[string]*PersistentMember `json:"members"`
	Playback        PersistentPlayback           `json:"playback"`
}

// ToPersistent serializes Party state including private tokens, device IDs, and queue items.
func (p *Party) ToPersistent() *PersistentParty {
	p.mu.Lock()
	defer p.mu.Unlock()

	membersCopy := make(map[string]*PersistentMember, len(p.Members))
	for id, m := range p.Members {
		membersCopy[id] = &PersistentMember{
			MemberId:    m.MemberId,
			UserId:      m.UserId,
			DeviceId:    m.DeviceId,
			DisplayName: m.DisplayName,
			AvatarUrl:   m.AvatarUrl,
			Token:       m.Token,
			IsHost:      m.IsHost,
			Connected:   m.Connected,
			JoinedAtMs:  m.JoinedAtMs,
			LastSeenMs:  m.LastSeenMs,
		}
	}

	queueCopy := make([]*Track, len(p.Playback.Queue))
	copy(queueCopy, p.Playback.Queue)

	return &PersistentParty{
		Code:            p.Code,
		MaxMembers:      p.MaxMembers,
		HostOnlyControl: p.HostOnlyControl,
		HostIP:          p.HostIP,
		CreatedAtMs:     p.CreatedAtMs,
		TouchedAtMs:     p.TouchedAtMs,
		EmptySinceMs:    p.EmptySinceMs,
		Members:         membersCopy,
		Playback: PersistentPlayback{
			Track:               p.Playback.Track,
			Queue:               queueCopy,
			QueueIndex:          p.Playback.QueueIndex,
			IsPlaying:           p.Playback.IsPlaying,
			PositionMs:          p.Playback.PositionMs,
			AnchorMs:            p.Playback.AnchorMs,
			Seq:                 p.Playback.Seq,
			QueueSeq:            p.Playback.QueueSeq,
			UpdatedBy:           p.Playback.UpdatedBy,
			UpdatedAtMs:         p.Playback.UpdatedAtMs,
			StartedBy:           p.Playback.StartedBy,
			StartedByName:       p.Playback.StartedByName,
			AutoplayEnabled:     p.Playback.AutoplayEnabled,
			LastTrackChangeAtMs: p.Playback.LastTrackChangeAtMs,
		},
	}
}

// FromPersistent rehydrates a full Party instance from persistent state.
func FromPersistent(state *PersistentParty) *Party {
	if state == nil {
		return nil
	}
	p := &Party{
		Code:            state.Code,
		Members:         make(map[string]*Member, len(state.Members)),
		MaxMembers:      state.MaxMembers,
		HostOnlyControl: state.HostOnlyControl,
		HostIP:          state.HostIP,
		CreatedAtMs:     state.CreatedAtMs,
		TouchedAtMs:     state.TouchedAtMs,
		EmptySinceMs:    state.EmptySinceMs,
		Playback: &PlaybackState{
			Track:               state.Playback.Track,
			Queue:               state.Playback.Queue,
			QueueIndex:          state.Playback.QueueIndex,
			IsPlaying:           state.Playback.IsPlaying,
			PositionMs:          state.Playback.PositionMs,
			AnchorMs:            state.Playback.AnchorMs,
			Seq:                 state.Playback.Seq,
			QueueSeq:            state.Playback.QueueSeq,
			UpdatedBy:           state.Playback.UpdatedBy,
			UpdatedAtMs:         state.Playback.UpdatedAtMs,
			StartedBy:           state.Playback.StartedBy,
			StartedByName:       state.Playback.StartedByName,
			AutoplayEnabled:     state.Playback.AutoplayEnabled,
			LastTrackChangeAtMs: state.Playback.LastTrackChangeAtMs,
		},
	}
	if p.Playback.Queue == nil {
		p.Playback.Queue = make([]*Track, 0)
	}

	for id, pm := range state.Members {
		p.Members[id] = &Member{
			MemberId:          pm.MemberId,
			UserId:            pm.UserId,
			DeviceId:          pm.DeviceId,
			DisplayName:       pm.DisplayName,
			AvatarUrl:         pm.AvatarUrl,
			Token:             pm.Token,
			IsHost:            pm.IsHost,
			Connected:         pm.Connected,
			JoinedAtMs:        pm.JoinedAtMs,
			LastSeenMs:        pm.LastSeenMs,
			ControlBudget:     config.ControlRatePerSecond,
			ControlBudgetAtMs: pm.LastSeenMs,
			FrameBudget:       config.FrameRatePerSecond,
			FrameBudgetAtMs:   pm.LastSeenMs,
		}
	}
	return p
}

// StoreBackend abstracts state persistence across in-memory and shared database providers.
type StoreBackend interface {
	SaveParty(ctx context.Context, p *Party) error
	LoadParty(ctx context.Context, code string) (*Party, error)
	DeleteParty(ctx context.Context, code string) error
	ListPartyCodes(ctx context.Context) ([]string, error)
	Close() error
}

// MemoryStoreBackend provides thread-safe snapshot storage for single-instance setups and tests.
type MemoryStoreBackend struct {
	mu    sync.RWMutex
	store map[string][]byte
}

func NewMemoryStoreBackend() *MemoryStoreBackend {
	return &MemoryStoreBackend{
		store: make(map[string][]byte),
	}
}

func (m *MemoryStoreBackend) SaveParty(ctx context.Context, p *Party) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	state := p.ToPersistent()
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	m.store[p.Code] = data
	return nil
}

func (m *MemoryStoreBackend) LoadParty(ctx context.Context, code string) (*Party, error) {
	m.mu.RLock()
	data, ok := m.store[code]
	m.mu.RUnlock()
	if !ok {
		return nil, NewPartyError(404, "no_such_party", "No party with that code.")
	}
	var state PersistentParty
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return FromPersistent(&state), nil
}

func (m *MemoryStoreBackend) DeleteParty(ctx context.Context, code string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.store, code)
	return nil
}

func (m *MemoryStoreBackend) ListPartyCodes(ctx context.Context) ([]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	codes := make([]string, 0, len(m.store))
	for c := range m.store {
		codes = append(codes, c)
	}
	return codes, nil
}

func (m *MemoryStoreBackend) Close() error {
	return nil
}

// RedisStoreBackend provides shared database persistence using Redis for multi-instance deployments.
type RedisStoreBackend struct {
	client *redis.Client
}

func NewRedisStoreBackend(redisURL string) (*RedisStoreBackend, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}
	return &RedisStoreBackend{client: client}, nil
}

func (r *RedisStoreBackend) SaveParty(ctx context.Context, p *Party) error {
	state := p.ToPersistent()
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	partyKey := "raaga:party:" + p.Code
	ttl := time.Duration(config.PartyMaxAgeMs) * time.Millisecond
	if ttl <= 0 {
		ttl = 12 * time.Hour
	}

	pipe := r.client.Pipeline()
	pipe.Set(ctx, partyKey, data, ttl)
	pipe.SAdd(ctx, "raaga:party:codes", p.Code)
	_, err = pipe.Exec(ctx)
	return err
}

func (r *RedisStoreBackend) LoadParty(ctx context.Context, code string) (*Party, error) {
	partyKey := "raaga:party:" + code
	data, err := r.client.Get(ctx, partyKey).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, NewPartyError(404, "no_such_party", "No party with that code.")
		}
		return nil, err
	}
	var state PersistentParty
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return FromPersistent(&state), nil
}

func (r *RedisStoreBackend) DeleteParty(ctx context.Context, code string) error {
	partyKey := "raaga:party:" + code
	pipe := r.client.Pipeline()
	pipe.Del(ctx, partyKey)
	pipe.SRem(ctx, "raaga:party:codes", code)
	_, err := pipe.Exec(ctx)
	return err
}

func (r *RedisStoreBackend) ListPartyCodes(ctx context.Context) ([]string, error) {
	return r.client.SMembers(ctx, "raaga:party:codes").Result()
}

func (r *RedisStoreBackend) Close() error {
	return r.client.Close()
}

func initStoreBackend() StoreBackend {
	redisURL := strings.TrimSpace(os.Getenv("JAM_REDIS_URL"))
	if redisURL == "" {
		redisURL = strings.TrimSpace(os.Getenv("REDIS_URL"))
	}
	if redisURL != "" {
		rb, err := NewRedisStoreBackend(redisURL)
		if err == nil {
			log.Printf("Listen Together: connected to shared Redis persistence")
			return rb
		}
		log.Printf("Listen Together: Redis connection error (%v), falling back to memory backend", err)
	}
	return NewMemoryStoreBackend()
}

