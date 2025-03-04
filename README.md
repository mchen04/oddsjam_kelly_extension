# Oddsjam Fantasy Bet Sizing Calculator - Chrome Extension

This Chrome extension uses the Kelly Criterion to calculate optimal bet sizes on OddsJam.com, helping users make more informed betting decisions based on Expected Value (EV), implied odds, and their bankroll.

## Overview of Files

### 1. `manifest.json`
This is the extension's configuration file that defines:
- Basic information (name, version, description)
- Permissions required (tabs, storage, scripting)
- Host permissions (oddsjam.com)
- Content scripts, background service worker
- Action popup and icons

### 2. `background.js`
The background script powers the extension's core functionality:
- Listens for tab updates to automatically detect when users navigate to oddsjam.com
- Orchestrates the scraping process with a multi-step approach:
  1. Checks if there's a suitable table on the page
  2. Scrapes targeted elements containing odds and EV data
  3. Processes the data using stored bankroll and Kelly multiplier settings
  4. Injects a new column into the OddsJam table
  5. Updates the bet size values based on the Kelly calculations
- Includes helper functions for odds conversion and Kelly Criterion calculations
- Listens for messages from the popup to run on demand or update settings

### 3. `content.js`
A simpler content script that:
- Listens for messages from the popup
- Contains functions for scraping bets and creating an overlay (appears to be partially deprecated as the main functionality has been moved to background.js)

### 4. `popup.html`
The user interface that appears when clicking the extension icon:
- Provides input fields for configuring bankroll amount and Kelly multiplier
- Includes a "Get Data" button to manually trigger the scraping process
- Contains an empty results container for displaying data

### 5. `popup.js`
Script that powers the popup interface:
- Auto-runs the scraper when the popup opens
- Handles the "Get Data" button click event
- Contains duplicated versions of the scraping and calculation functions 
- Processes table data using the Kelly Criterion formula
- Converts between American and decimal odds formats
- Calculates implied odds from American odds
- Displays results in the popup or injects them directly into the OddsJam page

## How It Works

1. When a user navigates to OddsJam.com, the extension automatically detects the page load
2. It waits 1.5 seconds for the page to fully render, then checks for a suitable betting table
3. If found, it scrapes the EV and odds data from specific elements on the page
4. The data is processed using the Kelly Criterion formula to calculate optimal bet sizes
5. A new "Kelly Bet Size" column is injected into the OddsJam table
6. The calculated bet sizes are displayed in the new column
7. Users can adjust their bankroll and Kelly multiplier in the popup to customize calculations

## Kelly Criterion Implementation

The extension uses the Kelly Criterion formula to determine optimal bet sizing:
- `f* = (bp - q) / b`

Where:
- `f*` = fraction of bankroll to bet
- `b` = decimal odds - 1 (net return per unit wagered)
- `p` = probability of winning
- `q` = probability of losing (1 - p)

The extension applies a configurable Kelly multiplier (default 0.35) to make the betting strategy more conservative, as recommended by many professional bettors.

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" at the top right
4. Click "Load unpacked" and select the folder containing these files
5. The extension should now be installed and will activate on oddsjam.com

## Usage

1. Navigate to any page on oddsjam.com containing a betting table
2. The extension will automatically inject the Kelly bet sizes into a new column
3. To adjust settings, click the extension icon in your browser toolbar
4. Enter your desired bankroll amount and Kelly multiplier
5. Click "Get Data" to refresh the calculations with your new settings
