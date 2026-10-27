# PWA Setup Instructions

The invoicing system is now configured as a Progressive Web App (PWA) that can be installed on mobile devices and desktops.

**Production URL:** `https://codemathphp.co.za/invoicing`

## What's Included

1. **manifest.json** - App configuration and metadata
2. **sw.js** - Service Worker for offline functionality and caching
3. **PWA meta tags** - Added to all pages
4. **Install prompt** - Automatic install button on supported browsers

## Setup Steps

### 1. Generate App Icons

You need to create icon files for the PWA. Two options:

#### Option A: Use the Icon Generator (Recommended)
1. Open `create-icons.html` in your browser
2. Click "Generate Icons" button
3. Click "Download All Icons" to save all icon sizes
4. Save all icons in the `invoicing` folder with these exact names:
   - `icon-72x72.png`
   - `icon-96x96.png`
   - `icon-128x128.png`
   - `icon-144x144.png`
   - `icon-152x152.png`
   - `icon-192x192.png`
   - `icon-384x384.png`
   - `icon-512x512.png`

#### Option B: Create Custom Icons
- Create icons with the sizes listed above
- Use your company logo or a custom invoice icon
- Save them in the `invoicing` folder with the exact names above

### 2. Verify HTTPS

PWAs require HTTPS to work properly (except on localhost). Make sure your site is served over HTTPS in production.

### 3. Test the PWA

1. Open the invoicing system in a supported browser (Chrome, Edge, Safari, Firefox)
2. Look for the install prompt that appears automatically
3. Or use browser menu:
   - **Chrome/Edge**: Menu → "Install BetaDeck Invoice"
   - **Safari (iOS)**: Share button → "Add to Home Screen"
   - **Firefox**: Menu → "Install"

## Features

### ✅ Installable
- Can be installed on mobile devices and desktops
- Appears in app launcher/home screen
- Runs in standalone mode (no browser UI)

### ✅ Offline Support
- Service Worker caches pages and resources
- Works offline after first visit
- Automatic updates when online

### ✅ App Shortcuts
- Quick access to "Create Invoice" from home screen
- Quick access to "View Invoices" from home screen

### ✅ Native Feel
- Standalone display mode
- Custom theme color (#FF8C00)
- Custom app icon
- No browser address bar when installed

## Browser Support

- ✅ Chrome/Edge (Android, Desktop)
- ✅ Safari (iOS 11.3+, macOS)
- ✅ Firefox (Android, Desktop)
- ✅ Samsung Internet

## Troubleshooting

### Icons not showing
- Make sure all icon files are in the `invoicing` folder
- Check file names match exactly (case-sensitive)
- Verify icons are PNG format

### Install prompt not showing
- Ensure you're using HTTPS (or localhost)
- Check browser supports PWA installation
- Clear browser cache and reload

### Service Worker not registering
- Check browser console for errors
- Verify `sw.js` file is accessible
- Ensure HTTPS is enabled

## Updating the App

When you update the app:
1. Update the version in `sw.js` (change `CACHE_NAME` version number)
2. Users will get the update automatically on next visit
3. Old cache will be cleared automatically

## Notes

- The app works best on mobile devices
- All pages are cached for offline access
- Logo and services.json are cached
- Dynamic content (invoices) still requires network connection

