# Neon Arcade - GitHub Pages Deployment

This app is compatible with GitHub Pages! Here's how to deploy it:

## 1. Prepare for Deployment
The app has been configured to use relative paths (`base: './'`) and handles offline mode gracefully since GitHub Pages doesn't support the Node.js backend.

## 2. Manual Deployment
1. Run `npm run build`.
2. This will create a `dist` folder.
3. Upload the contents of the `dist` folder to your GitHub repository's `gh-pages` branch or the `root` of your repository if using a dedicated deployment repo.

## 3. Automatic Deployment (Recommended)
You can use the `gh-pages` package to deploy easily:

1. Install the package: `npm install --save-dev gh-pages`
2. Add these scripts to your `package.json`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
3. Run `npm run deploy`.

## Note on Features
Since GitHub Pages is a static hosting service, the following features will be disabled or limited:
- **Global Chat**: Disabled (requires server).
- **Voice Chat**: Disabled (requires signaling server).
- **Global Leaderboard**: Shows local stats only.
- **Real-time Parties**: Disabled.

**XP, Levels, and High Scores** are saved locally to your browser's `localStorage`, so your progress is preserved!
