# Raaga Connect — Cloudflare Edge WebSocket Relay

Ultra-low latency (<20ms in India) multi-device synchronization relay for **Raaga Connect**.

## 🚀 Instant Deployment (Choose Option 1 or 2)

### Option 1: One-Click via Cloudflare Dashboard (Easiest)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** ➔ **Create Application** ➔ **Create Worker**.
3. Name it `raaga-connect-relay`.
4. Click **Deploy**.
5. Click **Edit code**, paste the entire contents of `src/index.js`, and click **Deploy**.
6. Under **Settings** ➔ **Bindings** ➔ **Durable Objects**, add binding:
   * **Variable name**: `ROOMS`
   * **Durable Object class**: `ConnectRoom`
7. Your WebSocket URL is ready:
   ```
   wss://raaga-connect-relay.<your-subdomain>.workers.dev/ws
   ```

### Option 2: Via Terminal (CLI)
```bash
cd cloudflare-relay
npm install
npx wrangler login
npx wrangler deploy
```

---

## ⚡ Architecture
- **Protocol**: Raw WebSockets with WebSocket Hibernation API.
- **Latency**: Direct Edge routing (<20ms in India via Hyderabad, Mumbai, Chennai, Delhi).
- **Cost**: 100% Free on Cloudflare Workers Free Tier (100,000 requests/day).
- **Failover**: Raaga apps automatically use Cloudflare as **Primary** and **Supabase Realtime** as **Backup**.
