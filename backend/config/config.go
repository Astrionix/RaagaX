package config

import (
	"net/url"
	"os"
	"strconv"
	"strings"
)

func getInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(strings.TrimSpace(val))
	if err != nil {
		return fallback
	}
	return parsed
}

func getCSV(key string, fallback string) []string {
	val := os.Getenv(key)
	if val == "" {
		val = fallback
	}
	if val == "" {
		return nil
	}
	var res []string
	for _, item := range strings.Split(val, ",") {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			res = append(res, trimmed)
		}
	}
	return res
}

func getBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(strings.TrimSpace(val))
	if err != nil {
		return fallback
	}
	return parsed
}

// IsAllowedOrigin checks whether a given origin is allowed to connect via CORS or WebSocket.
// Native clients (Android, Desktop) send no Origin header (origin == "").
// Browser clients (Web) send their origin, e.g. "https://web.raaga.me" or "http://localhost:5173".
func IsAllowedOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	for _, allowed := range AllowedOrigins {
		if allowed == "*" || origin == allowed {
			return true
		}
	}
	// Permissive defaults for Raaga web deployments, local development, and browser extensions
	u, err := url.Parse(origin)
	if err == nil {
		host := strings.ToLower(u.Hostname())
		if host == "localhost" || host == "127.0.0.1" || host == "web.raaga.me" || host == "raaga.app" ||
			strings.HasSuffix(host, ".raaga.me") || strings.HasSuffix(host, ".onrender.com") {
			return true
		}
	}
	if strings.HasPrefix(origin, "chrome-extension://") || strings.HasPrefix(origin, "moz-extension://") {
		return true
	}
	return false
}

var (
	MaxMembers           = getInt("JAM_MAX_MEMBERS", 5)
	StateHeartbeatMs     = getInt("JAM_STATE_HEARTBEAT_MS", 5000)
	PlayLeadMs           = getInt("JAM_PLAY_LEAD_MS", 350)
	DisconnectGraceMs    = int64(getInt("JAM_DISCONNECT_GRACE_MS", 45000))
	EmptyPartyTTLMs      = int64(getInt("JAM_EMPTY_PARTY_TTL_MS", 120000))
	PartyMaxAgeMs        = int64(getInt("JAM_PARTY_MAX_AGE_MS", 12*60*60*1000))
	ControlRatePerSecond = float64(getInt("JAM_CONTROL_RATE_PER_SECOND", 25))
	MaxUpcomingQueue     = getInt("JAM_MAX_UPCOMING_QUEUE", 25)
	MaxQueueLength       = getInt("JAM_MAX_QUEUE_LENGTH", 1+MaxUpcomingQueue)
	// Render Free has 0.1 CPU. Fifty rooms (at most 250 sockets) is a safe
	// starting ceiling; raise it only after measuring CPU and memory usage.
	MaxParties           = getInt("JAM_MAX_PARTIES", 50)
	CreateRatePerMinute  = getInt("JAM_CREATE_RATE_PER_MINUTE", 2)
	RateLimitMaxEntries  = getInt("JAM_RATE_LIMIT_MAX_ENTRIES", 10000)
	RequestMaxBytes      = int64(getInt("JAM_REQUEST_MAX_BYTES", 16*1024))
	WebSocketMaxBytes    = int64(getInt("JAM_WEBSOCKET_MAX_BYTES", 16*1024))
	ConnectionIdleMs     = int64(getInt("JAM_CONNECTION_IDLE_MS", 15*60*1000))
	FrameRatePerSecond   = float64(getInt("JAM_FRAME_RATE_PER_SECOND", 30))
	AllowedOrigins       = getCSV("JAM_ALLOWED_ORIGINS", "https://web.raaga.me,https://raaga.app,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,*")
	TrustProxy           = getBool("JAM_TRUST_PROXY", false)
	Port                 = getInt("PORT", 8000)
)
