pip install -r requirements.txt
docker compose up --build

## Self-host with Docker + Cloudflare Tunnel

This project can be hosted from your own machine and accessed from another Wi-Fi network, such as an iPad on mobile internet or a different home network.

### What this setup does

- Runs the frontend on your machine with Docker
- Runs the FastAPI backend on your machine with Docker
- Publishes both through a Cloudflare named tunnel
- Lets you keep the machine at home and access the app from anywhere

### 1. Prepare environment variables

Copy [.env.example](./.env.example) to `.env` in the project root and update:

```env
PUBLIC_APP_URL=https://app.example.com
PUBLIC_API_BASE_URL=https://api.example.com
CORS_ALLOW_ORIGINS=https://app.example.com
CLOUDFLARE_TUNNEL_TOKEN=your_cloudflare_tunnel_token
```

Notes:

- `PUBLIC_APP_URL` is the public hostname for the frontend
- `PUBLIC_API_BASE_URL` is the public hostname for the backend
- `CORS_ALLOW_ORIGINS` should include the frontend hostname
- `CLOUDFLARE_TUNNEL_TOKEN` comes from Cloudflare after you create a named tunnel

### 2. Create a named tunnel in Cloudflare

In Cloudflare Zero Trust:

1. Go to `Networks` -> `Tunnels`
2. Create a `Cloudflared` tunnel
3. Choose Docker as the connector type
4. Copy the tunnel token into `.env`

Create public hostnames like this:

- `app.example.com` -> `http://frontend:5001`
- `api.example.com` -> `http://backend:5000`

Because the tunnel container shares the same Docker network, it can reach `frontend` and `backend` by service name.

### 3. Start the app locally

For local-only testing:

```bash
docker compose up --build
```

For internet access through Cloudflare Tunnel:

```bash
docker compose --profile tunnel up --build -d
```

### 4. Verify it works

- Open `http://localhost:5001` on your computer
- Open `https://app.example.com` on your iPad
- Check the API at `https://api.example.com/api`

### 5. Important operational notes

- Your computer must stay on
- Docker must keep running
- If your app URL changes, update both `PUBLIC_API_BASE_URL` and `CORS_ALLOW_ORIGINS`
- The backend uses local folders such as `backend/output` and `backend/temp`, so generated files are stored on your machine, not in cloud storage

## Frontend on GitHub Pages

If you want the frontend to be free on GitHub Pages while keeping the backend on your own machine with Docker, this repo is set up for that flow too.

### How it works

- GitHub Pages hosts the Vite frontend
- The frontend calls your self-hosted backend through `VITE_API_BASE_URL`
- Routing uses hash URLs on `github.io` to avoid refresh and deep-link issues

### GitHub setup

1. Go to your GitHub repository settings
2. Open `Settings` -> `Pages`
3. Set the source to `GitHub Actions`
4. Open `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`
5. Add a repository variable named `VITE_API_BASE_URL`

Example:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

If you are publishing to a project pages URL instead of a root `username.github.io` site, also add:

```env
VITE_BASE_PATH=./
```

The workflow file is in `.github/workflows/deploy-frontend-pages.yml`.
