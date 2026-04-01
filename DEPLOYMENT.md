# Neon Arcade - GitHub Pages Deployment

This app is compatible with GitHub Pages! Here's how to deploy it:

## 1. Automatic Deployment (Recommended)
I have added a **GitHub Action** to your repository. This is the easiest way to deploy:
1.  **Commit and Push** your changes to the `main` branch.
2.  GitHub will automatically start a "Build and Deploy" workflow.
3.  Go to your repository's **Settings > Pages**.
4.  Under **Build and deployment > Source**, ensure it is set to **Deploy from a branch**.
5.  Select the **`gh-pages`** branch and the **`/ (root)`** folder.
6.  Click **Save**. Your site will be live at `https://<your-username>.github.io/<your-repo-name>/`.

## 2. Manual Deployment
If you prefer to deploy manually from your local machine:
1.  Install the package: `npm install --save-dev gh-pages`
2.  Run: `npm run deploy`
3.  This will build the app and push it to the `gh-pages` branch for you.

## 3. Why was it a "White Screen"?
The white screen and "MIME type" errors happen when you try to serve the **source code** directly on GitHub Pages. GitHub Pages only supports **static files** (HTML, JS, CSS). The GitHub Action I added handles the "build" step for you automatically so you don't have to worry about it!

## Note on Features
Since GitHub Pages is a static hosting service, the following features will be disabled or limited:
- **Global Chat**: Disabled (requires server).
- **Voice Chat**: Disabled (requires signaling server).
- **Global Leaderboard**: Shows local stats only.
- **Real-time Parties**: Disabled.

**XP, Levels, and High Scores** are saved locally to your browser's `localStorage`, so your progress is preserved!
