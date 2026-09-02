# RaagaX WebSocket Coordinator (for Render.com / Railway)

A lightweight, dedicated, stateful Node.js WebSocket coordinator for:
1. **Connect to Device**: Discovers devices across Wi-Fi/subnets and accounts, and relays instant playback commands (play, pause, seek, volume, transfer) with sub-10ms latency.
2. **Jam Sessions**: Real-time room synchronization across multiple listeners.

---

## Deploy to Render (100% Free, No Credit Card Required)

1. Create a new GitHub repository named `raaga-sync-server` and push the contents of this folder to it:
   ```bash
   cd raaga-sync-server
   git init
   git add .
   git commit -m "feat: initial coordinator"
   git branch -M main
   git remote add origin https://github.com/<your-username>/raaga-sync-server.git
   git push -u origin main
   ```

2. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** -> **Web Service**.

3. Connect your `raaga-sync-server` repository.

4. Fill in the settings:
   * **Name**: `raaga-sync`
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Instance Type**: **Free ($0/month)**

5. Add Environment Variable:
   * **Key**: `RENDER_EXTERNAL_URL`
   * **Value**: Your Render service URL (e.g. `https://raaga-sync-xxxx.onrender.com`)
   *(This enables the built-in self-ping interval so the service stays awake 24/7 without sleeping).*

6. Click **Deploy Web Service**.

---

## Wire to Your Cloudflare Frontend

Once Render finishes deploying, it gives you an HTTPS URL like `https://raaga-sync-xxxx.onrender.com`.

In your Cloudflare Workers environment or `wrangler.jsonc`:
```json
"vars": {
  "NEXT_PUBLIC_SYNC_WS_URL": "wss://raaga-sync-xxxx.onrender.com"
}
```
Or in `.env.production` / `.env.local`:
```env
NEXT_PUBLIC_SYNC_WS_URL=wss://raaga-sync-xxxx.onrender.com
```

Both Connect and Jam will automatically switch to your dedicated WebSocket relay!
