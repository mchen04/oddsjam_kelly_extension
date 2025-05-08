
## Installation

1.  Download or clone this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" using the toggle switch in the top right corner.
4.  Click on the "Load unpacked" button.
5.  Select the directory where you downloaded/cloned the extension files.
6.  The "Oddsjam Fantasy Bet Sizing Calculator" should now appear in your list of extensions and be active.

## User Guide

### Accessing the Extension

Click on the Oddsjam Fantasy Bet Sizing Calculator icon in your Chrome toolbar to open the popup interface.

### Kelly Criterion Settings

The left column in the popup manages settings related to Kelly Criterion bet sizing.

#### 1. Setting Global Bankroll & Kelly Percentage

*   **Bankroll ($):** Enter your total bankroll amount. This is used as the base for calculating bet sizes.
*   **Kelly %:** Enter the Kelly fraction you wish to use (e.g., `1` for Full Kelly, `0.5` for Half Kelly). This multiplier adjusts the aggressiveness of the bet sizing.
*   These values are saved globally and act as defaults if a page doesn't have specific settings.

#### 2. Enabling/Disabling Auto-Calculation for a Page

*   Navigate to an Oddsjam page where you want automatic bet sizing.
*   Open the extension popup.
*   Toggle the **"Auto-calculate"** switch at the top of the Kelly Criterion column.
    *   **ON:** The current page will be added to the "Enabled Pages" list (or updated if already present). The current Bankroll and Kelly % values from the input fields will be saved specifically for this page. The extension will automatically try to scrape data and display bet sizes when you visit this page.
    *   **OFF:** If the page was previously enabled, its auto-calculation will be disabled. It will remain in the list but marked as inactive.

#### 3. Calculating Bets Manually

*   Click the **"Calculate Bets"** button to manually trigger the scraping and calculation process for the current active Oddsjam page. If "Auto-calculate" is also enabled for this page, clicking this button will ensure the current page's settings are up-to-date and saved.

#### 4. Managing Enabled Pages

*   The **"Enabled Pages"** list shows all pages you've configured for auto-calculation.
*   For each page, you'll see:
    *   A toggle switch to quickly enable/disable auto-calculation for that specific URL.
    *   The page title or URL.
    *   The Bankroll and Kelly % settings saved for that page.
    *   A `×` (delete) button to remove the page from the list entirely.

### Preset URL Settings

The right column in the popup manages URL parameter presets, allowing you to quickly apply filters to Oddsjam pages.

#### 1. Configuring Preset Parameters

*   **Min Odds:** Set the minimum odds for filtering.
*   **Max Odds:** Set the maximum odds for filtering.
*   **Min Data Points:** Set the minimum number of data points required.
*   Enter the desired values in their respective input fields. Empty fields mean that parameter will not be included or will be removed from the URL if the preset is applied.

#### 2. Saving/Applying Presets for a Page

*   Navigate to an Oddsjam page where you want to apply or save a preset.
*   Open the extension popup.
*   Configure the desired `Min Odds`, `Max Odds`, and `Min Data Points`.
*   **Enable Presets Toggle:**
    *   Toggling this **ON** will save the current input field values as a preset for the current page URL. It will also attempt to immediately apply these parameters to the current tab's URL, potentially causing a page refresh.
    *   Toggling this **OFF** will disable the preset for the current page.
*   **Save Preset Button:**
    *   Clicking this button explicitly saves the current input values as a preset for the active page. It will also enable the preset and apply it to the current tab.

#### 3. Managing Saved Presets

*   The **"Saved Presets"** list shows all URL presets you've created.
*   For each preset, you'll see:
    *   A toggle switch to enable/disable the automatic application of this preset when visiting the associated URL.
    *   The page title or URL the preset is for.
    *   The saved parameter values (`Min Odds`, `Max Odds`, `Min Data Points`).
    *   A `×` (delete) button to remove the preset from the list.

When a page with an enabled preset is loaded, the extension's background script will automatically modify the URL to include these parameters, effectively applying your saved filters.

## Technical Breakdown

### Key Files

*   **`manifest.json`**:
    *   Defines the extension's name, version, permissions, and entry points.
    *   Specifies `background.js` as the service worker.
    *   Declares `content.js` to be injected into `https://*.oddsjam.com/*` pages.
    *   Sets `popup.html` as the default popup for the browser action.
*   **`background.js`**:
    *   The core logic unit. Handles tab updates, URL checks, preset application, coordinates scraping, performs Kelly calculations, and injects UI changes (columns/data) into the page. Manages communication and storage access for settings.
*   **`content.js`**:
    *   Runs in the context of Oddsjam pages.
    *   Detects tables and page readiness for scraping.
    *   Can perform scraping and display an overlay as a primary or supplementary mechanism.
    *   Communicates with `background.js`.
*   **`popup.html`**:
    *   The HTML structure for the extension's popup interface.
    *   Includes input fields for settings and containers for dynamic lists.
*   **`popup.js`**:
    *   Handles all logic within the popup.
    *   Manages user input, saves settings to `chrome.storage.local`.
    *   Dynamically renders the "Enabled Pages" and "Saved Presets" lists.
    *   Communicates with `background.js` to trigger actions or update settings.
*   **`css/styles.css`**:
    *   Provides styling for `popup.html` for a professional look and feel.

### Permissions Used

*   **`activeTab`**: Allows the extension to access information about the currently active tab (e.g., its URL, title) when the user interacts with the popup.
*   **`scripting`**: Enables the extension to inject JavaScript code (`content.js` and other functions) into web pages (`host_permissions` target). This is crucial for scraping data and modifying page content.
*   **`tabs`**: Required to listen for tab updates (`onUpdated`), get details of tabs (URL for checks), and update tab URLs (for applying presets).
*   **`storage`**: Allows the extension to store and retrieve user settings, enabled URLs, and saved presets locally and persistently.
*   **`host_permissions: ["https://*.oddsjam.com/*"]`**: Grants the extension permission to interact with all subdomains of `oddsjam.com`. This is necessary for content scripts to run and for the extension to make modifications or scrape data from these pages.

## Future Enhancements (Potential Ideas)

*   Support for more sportsbooks or data providers.
*   Advanced preset options (e.g., date ranges, specific markets).
*   Export/Import settings functionality.
*   More sophisticated error handling and user feedback.
*   Visual cues on the page indicating active presets or Kelly calculations.

## Disclaimer

This tool is intended for informational and educational purposes only. Betting involves risk, and you should never bet more than you can afford to lose. The calculations provided by this extension are based on the Kelly Criterion and publicly available data; their accuracy or profitability is not guaranteed. Always do your own research and make responsible betting decisions. The developers of this extension are not responsible for any financial losses incurred while using this tool.