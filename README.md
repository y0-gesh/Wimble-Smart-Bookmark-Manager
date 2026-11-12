# Wimble - Smart Bookmark Manager

A **Manifest V3 Chrome Extension** that scans your bookmarked websites, categorizes and organizes them into clean folders, provides instant search, automatically backs up your bookmark tree before any change (with one-click revert), and supports **Import / Export** in Netscape HTML and JSON formats.

---

## Features

- **Website Scanning & Local Categorization**
  - Concurrently scans bookmarked URLs (with request timeouts and local caching) to extract page `<title>`, `<meta>` descriptions, keywords, and headings.
  - Categorizes bookmarks using domain rules and weighted keyword matching across categories (Development & Engineering, AI & Data Science, Design & Creative, Productivity & Tools, Learning & Reference, News/Blogs/Reading, Shopping, Finance, Media, Social, and Broken/Unreachable).
  - Interactive preview lets you review and override any bookmark's category before applying changes.
- **Automatic Backup & One-Click Revert**
  - Automatically saves a full snapshot of your Chrome bookmark tree in `chrome.storage.local` before organizing or importing.
  - Displays a **Revert** button in both the Popup and Manager after organizing, plus a **Backups** tab to create manual snapshots and restore any previous state.
- **Fast Search & Discovery**
  - Instant search in both the Extension Popup and Full-Page Manager across bookmark titles, URLs, domains, folder paths, and scanned website descriptions.
  - Filter by category, duplicates, or unreachable/broken links.
- **Import & Export**
  - **Export** your bookmarks as standard **Netscape HTML (`.html`)** (compatible with Chrome, Firefox, Safari, and Edge) or **JSON (`.json`)**.
  - **Import** `.html` or `.json` bookmark files with an item/folder preview and automatic pre-import backup.

---

## Tech Stack

- **Extension:** Chrome Manifest V3
- **UI:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Build & Test:** Vite, Vitest, jsdom

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended) and npm

### Install Dependencies
```bash
npm install
```

### Build the Extension
```bash
npm run build
```
This outputs the production extension bundle to `dist/`.

### Load in Chrome
1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `dist/` folder inside this project.

### Run Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

---

## Project Structure

```text
Bookmark-Manager/
├── public/
│   ├── manifest.json           # Chrome Manifest V3 configuration
│   └── icons/                  # Extension icons (16, 48, 128)
├── src/
│   ├── core/
│   │   ├── types.ts            # Shared TypeScript interfaces
│   │   ├── chromeBookmarks.ts  # Chrome bookmarks/storage wrappers & tree helpers
│   │   ├── backup.ts           # Snapshot creation & exact tree revert
│   │   ├── scanner.ts          # Concurrent URL fetcher & HTML metadata parser
│   │   ├── categorizer.ts      # Domain rules & keyword scoring classifier
│   │   ├── organizer.ts        # Backup -> categorize -> move orchestrator
│   │   └── importExport.ts     # Netscape HTML & JSON import/export
│   ├── pages/
│   │   ├── popup/              # Extension popup UI
│   │   └── manager/            # Full-page manager dashboard & tabs
│   └── background/
│       └── index.ts            # MV3 service worker
├── tests/
│   ├── backup.test.ts
│   ├── categorizer.test.ts
│   └── importExport.test.ts
├── popup.html
├── manager.html
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

---

## Permissions Used

- `bookmarks` — Read, create, move, and remove bookmarks/folders.
- `storage` & `unlimitedStorage` — Persist backup snapshots and scanned website metadata locally.
- `host_permissions` (`http://*/*`, `https://*/*`) — Fetch bookmarked URLs directly from the extension to read page metadata without CORS restrictions. All scanning and categorization happens locally in your browser.

