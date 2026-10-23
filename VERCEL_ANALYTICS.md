# Vercel Web Analytics Setup

This project now uses the official `@vercel/analytics` package for Vercel Web Analytics.

## Overview

Vercel Web Analytics has been configured using the `@vercel/analytics` npm package. The analytics code is bundled into a single JavaScript file (`static/js/analytics.js`) that is loaded on every page.

## How It Works

1. **Source Code**: `src/analytics.js` imports and initializes the `@vercel/analytics` package
2. **Build Process**: The build script uses esbuild to bundle the analytics code into `static/js/analytics.js`
3. **Template Integration**: The `templates/base.html` template loads the analytics script on every page

## Building the Analytics Bundle

When you modify analytics configuration or update the package, rebuild the bundle:

```bash
npm run build
```

Or specifically:

```bash
npm run build:analytics
```

This will:
- Bundle `src/analytics.js` with the `@vercel/analytics` package
- Minify the output
- Save it to `static/js/analytics.js`

## Deployment

### On Vercel

1. **Enable Web Analytics** in your Vercel project dashboard (Analytics tab)
2. Deploy your project - the analytics will automatically start tracking
3. The script will load from `/_vercel/insights/script.js` when deployed on Vercel

### Local Development

- Analytics runs in "development" mode automatically when `NODE_ENV=development`
- In development mode, analytics data is not sent to Vercel servers
- You can see console logs indicating the analytics script is loaded

## Files Modified

- **package.json**: Added `@vercel/analytics` and `esbuild` dependencies
- **src/analytics.js**: New file that imports and initializes analytics
- **static/js/analytics.js**: Generated bundle (created by build process)
- **templates/base.html**: Updated to load the bundled analytics script
- **.gitignore**: Updated to allow `package.json`, `package-lock.json`, and `src/` directory

## Upgrading @vercel/analytics

To upgrade to the latest version:

```bash
npm update @vercel/analytics
npm run build
```

Then commit the updated `package.json`, `package-lock.json`, and `static/js/analytics.js` files.

## Troubleshooting

### Analytics not showing in dashboard

1. Make sure Web Analytics is enabled in your Vercel project settings
2. Verify the project is deployed to Vercel
3. Check browser console for any errors
4. Ensure ad blockers are disabled (they may block analytics scripts)

### Build errors

If you get build errors when running `npm run build`:

1. Ensure dependencies are installed: `npm install`
2. Check that `src/analytics.js` exists and has no syntax errors
3. Verify esbuild is installed: `npm list esbuild`

## Additional Configuration

The `inject()` function from `@vercel/analytics` accepts configuration options. To customize, edit `src/analytics.js`:

```javascript
import { inject } from '@vercel/analytics';

inject({
  mode: 'auto',           // 'auto' | 'production' | 'development'
  beforeSend: (event) => {
    // Optionally modify or filter events before sending
    return event;
  }
});
```

After making changes, run `npm run build` to regenerate the bundle.

## Resources

- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Vercel Analytics Quickstart](https://vercel.com/docs/analytics/quickstart)
- [@vercel/analytics Package](https://www.npmjs.com/package/@vercel/analytics)
