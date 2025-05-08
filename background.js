// Listen for tab updates to automatically run the scraper when navigating to enabled pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      // Wait a bit for the page to fully render before checking
      setTimeout(() => {
        // Check if this page is in the list of enabled URLs
        checkIfPageEnabled(tab.url, tabId);
      }, 250); // 0.25 second delay
    }
  });

// Also listen for DOM content loaded to catch pages that might load tables dynamically
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
      // We'll set up a delayed check to run after the page has had time to load dynamic content
      setTimeout(() => {
        checkIfPageEnabled(tab.url, tabId);
      }, 1000); // 1 second delay for dynamic content
    }
  });

// Check if the current page is in the list of enabled URLs
function checkIfPageEnabled(url, tabId) {
  try {
    // Extract base URL without query parameters
    const urlObj = new URL(url);
    const baseUrl = urlObj.origin + urlObj.pathname;
    
    console.log("Checking if page is enabled:", baseUrl);
    
    // Get the list of enabled URLs and preset settings
    chrome.storage.local.get(['enabledUrls', 'savedPresets'], function(result) {
      const enabledUrls = result.enabledUrls || [];
      const savedPresets = result.savedPresets || [];
      
      // Check if current URL is in the enabled list and is enabled
      const currentUrlInfo = enabledUrls.find(item => item.url === baseUrl);
      
      // Check if current URL has preset settings enabled
      const currentPreset = savedPresets.find(preset => preset.url === baseUrl && preset.enabled);
      
      // Variable to track if we need to modify the URL
      let needsUrlModification = false;
      
      // If preset settings are enabled for this URL, modify it to include the parameters
      if (currentPreset) {
        console.log("URL has preset settings enabled:", currentPreset);
        needsUrlModification = true;
        
        // Get the current tab
        chrome.tabs.get(tabId, function(tab) {
          if (chrome.runtime.lastError) {
            console.error("Error getting tab:", chrome.runtime.lastError);
            return;
          }
          
          try {
            // Create a new URL object to manipulate
            const tabUrl = new URL(tab.url);
            
            // Check if this URL already contains our preset parameters
            const hasMinOdds = tabUrl.searchParams.has('minOdds');
            const hasMaxOdds = tabUrl.searchParams.has('maxOdds');
            const hasMinNumDataPoints = tabUrl.searchParams.has('minNumDataPoints');
            
            // Only modify URL if it doesn't already have our parameters
            if (!hasMinOdds || !hasMaxOdds || !hasMinNumDataPoints) {
              console.log("Modifying URL with preset parameters");
              
              // Set the preset parameters (use preset values or defaults)
              tabUrl.searchParams.set('minOdds', currentPreset.minOdds || "-200");
              tabUrl.searchParams.set('maxOdds', currentPreset.maxOdds || "200");
              tabUrl.searchParams.set('minNumDataPoints', currentPreset.minNumDataPoints || "3");
              
              // Update the tab URL
              chrome.tabs.update(tabId, {url: tabUrl.toString()}, function() {
                if (chrome.runtime.lastError) {
                  console.error("Error updating tab URL:", chrome.runtime.lastError);
                } else {
                  console.log("Tab URL updated successfully");
                }
              });
            } else {
              console.log("URL already contains preset parameters");
            }
          } catch (err) {
            console.error("Error modifying URL:", err);
          }
        });
      }
      
      // Check for Kelly Criterion processing (only if not already handling preset settings)
      if (currentUrlInfo && currentUrlInfo.enabled && !needsUrlModification) {
        console.log("Page is enabled for Kelly calculations, running scraper automatically");
        runScraper(tabId, currentUrlInfo);
        
        // Also notify the content script to run its calculations with URL-specific settings
        chrome.tabs.sendMessage(tabId, {
          action: "pageEnabled",
          bankroll: currentUrlInfo.bankroll || result.bankroll || 3000,
          kellyMultiplier: currentUrlInfo.kellyMultiplier || result.kellyMultiplier || 1
        }, function(response) {
          console.log("Content script response:", response);
        });
      } else if (!needsUrlModification) {
        console.log("Page is not enabled for automatic calculations");
      }
    });
  } catch (error) {
    console.error("Error checking if page is enabled:", error);
  }
}
  
  // Main function to orchestrate the scraping process
  function runScraper(tabId, urlInfo = null) {
    console.log("Running scraper on tab:", tabId);
    
    // First, check if there's a table that needs our processing
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      function: checkForTargetTable
    }, (results) => {
      if (results && results[0] && results[0].result) {
        console.log("Target table found, proceeding with scraping");
        
        // Step 1: Scrape the data
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          function: scrapeTargetedElements
        }, (scrapeResults) => {
          if (scrapeResults && scrapeResults[0] && scrapeResults[0].result) {
            const scraped = scrapeResults[0].result;
            console.log(`Scraped ${scraped.elements} elements`);
            
            // Step 2: Process the data with settings from storage
            if (urlInfo && urlInfo.bankroll && urlInfo.kellyMultiplier) {
              // Use URL-specific settings if available
              console.log(`Using URL-specific settings: Bankroll: ${urlInfo.bankroll}, Kelly %: ${urlInfo.kellyMultiplier}`);
              const tableData = processTableData(
                scraped.text,
                urlInfo.bankroll,
                urlInfo.kellyMultiplier
              );
              processScrapedData(tabId, tableData);
            } else {
              // Fall back to global settings if URL-specific settings not available
              chrome.storage.local.get({
                bankroll: 4000,
                kellyMultiplier: 1
              }, (settings) => {
                console.log(`Using global settings: Bankroll: ${settings.bankroll}, Kelly %: ${settings.kellyMultiplier}`);
                const tableData = processTableData(
                  scraped.text,
                  settings.bankroll,
                  settings.kellyMultiplier
                );
                processScrapedData(tabId, tableData);
              });
            }
          } else {
            console.log("No elements scraped, trying again in 1 second");
            // Try again after a delay in case content is still loading
            setTimeout(() => runScraper(tabId, urlInfo), 1000);
          }
        });
      } else {
        console.log("No suitable table found on this page, trying again in 1 second");
        // Try again after a delay in case table is loaded dynamically
        setTimeout(() => runScraper(tabId, urlInfo), 1000);
      }
    });
  }
  
  // Helper function to process scraped data and update the UI
  function processScrapedData(tabId, tableData) {
    // Step 3: Inject the new column
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      function: injectBetSizeColumn
    }, () => {
      // Add a short delay before updating bet sizes to ensure values are properly calculated
      setTimeout(() => {
        // Step 4: Update the bet sizes
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          function: updateBetSizes,
          args: [tableData.map(row => row.betSize)]
        });
      }, 250); // 0.25 second delay
    });
  }
  
  // Check if there's a table that needs our processing
  function checkForTargetTable() {
    console.log("Checking for target table");
    const table = document.querySelector('table');
    if (!table) {
      console.log("No table found");
      return false;
    }
  
    // Check if Kelly column already exists
    if (document.querySelector('.kelly_size')) {
      console.log("Kelly column already exists");
      return false;
    }
    
    // More flexible check for table structure
    const headers = table.querySelectorAll('thead tr th');
    if (headers.length > 0) {
      console.log("Table with headers found");
      return true;
    }
    
    console.log("Table found but doesn't match criteria");
    return false;
  }
  
  // Scrape the data from the page
  function scrapeTargetedElements() {
    try {
      const targetClass = "text-sm text-inherit __className_321157";
      const elements = document.querySelectorAll(`.${targetClass.split(' ').join('.')}`);
      
      if (elements.length === 0) {
        return { text: "", elements: 0 };
      }
      
      let result = "";
      elements.forEach((element, index) => {
        const text = element.textContent.trim();
        if (text) {
          result += `${index + 1}. ${text}\n\n`;
        }
      });
      
      return { text: result, elements: elements.length };
    } catch (error) {
      console.error(`Error during scraping: ${error.message}`);
      return { text: "", elements: 0, error: error.message };
    }
  }
  
  // Process the scraped text into structured data with bet sizes
  function processTableData(rawText, bankroll, kellyMultiplier) {
    const lines = rawText.trim().split('\n\n');
    const tableData = [];
    
    console.log(`Processing data with bankroll: $${bankroll}, Kelly multiplier: ${kellyMultiplier}`);
    
    for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 < lines.length) {
        const trueAmericanOdds = lines[i + 1].replace(/^\d+\.\s/, '');
        const bookAmericanOdds = lines[i + 2].replace(/^\d+\.\s/, '');
        const bookDecimalOdds = americanToDecimal(bookAmericanOdds);
        const actualProb = calculateImpliedOdds(trueAmericanOdds) / 100;
        
        const b = bookDecimalOdds - 1;
        const p = actualProb; 
        const q = 1.0 - p;   
        
        const kellyFraction = ((b * p) - q) / b;
        const betSize = Math.max(0, kellyFraction * kellyMultiplier * bankroll).toFixed(2);
        
        tableData.push({
          ev: lines[i].replace(/^\d+\.\s/, ''),
          odds: trueAmericanOdds,
          bookPrice: bookAmericanOdds,
          impliedOdds: calculateImpliedOdds(trueAmericanOdds),
          betSize: betSize
        });
      }
    }
    return tableData;
  }
  
  // Helper function to convert American odds to decimal
  function americanToDecimal(americanOdds) {
    const odds = parseInt(americanOdds.replace('+', ''));
    return odds > 0 ? 1 + (odds / 100) : 1 + (100 / Math.abs(odds));
  }
  
  // Helper function to calculate implied odds from American odds
  function calculateImpliedOdds(americanOdds) {
    const odds = parseInt(americanOdds);
    if (isNaN(odds)) return 0;
    
    return odds > 0 
      ? (100 / (odds + 100) * 100).toFixed(2)
      : (Math.abs(odds) / (Math.abs(odds) + 100) * 100).toFixed(2);
  }
  
  // Inject a new column for Kelly bet sizes
  function injectBetSizeColumn() {
    const table = document.querySelector('table');
    if (!table) return;
  
    if (document.querySelector('.kelly_size')) {
      return;
    }
  
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
  
    const newHeader = document.createElement('th');
    newHeader.className = 'z-1 sticky top-0 bg-brand-gray border-none kelly_size';
    newHeader.innerHTML = `
      <div class="relative flex h-12 justify-between border-t border-[#4F5253] mt-4">
        <div class="flex flex-1 justify-center">
          <div class="relative flex items-center justify-center px-3 text-xs font-medium uppercase text-white select-none __className_9ac160" style="min-height: 36px;">
            <div>Kelly Bet Size</div>
          </div>
        </div>
        <div class="bg-brand-gray-1 w-px"></div>
      </div>
      <div class="mt-[-3px] h-[3px] w-full bg-transparent"></div>
    `;
    
    const seventhHeader = headerRow.children[6];
    if (seventhHeader) {
      seventhHeader.after(newHeader);
    } else {
      headerRow.appendChild(newHeader);
    }
  
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const newCell = document.createElement('td');
      newCell.className = `${row.firstElementChild?.className || ''} kelly_size`;
      newCell.innerHTML = `
        <div class="flex h-full flex-col justify-center px-4 py-3 min-w-[100px] text-center hover:brightness-110">
          <p class="text-sm text-inherit kelly-bet-size">Calculating...</p>
        </div>
      `;
      
      const seventhCell = row.children[6];
      if (seventhCell) {
        seventhCell.after(newCell);
      } else {
        row.appendChild(newCell);
      }
    });
    
    console.log("Kelly column injected");
    return true;
  }
  
  // Update the bet size values in the injected column
  function updateBetSizes(betSizes) {
    const cells = document.querySelectorAll('.kelly-bet-size');
    cells.forEach((cell, index) => {
      if (betSizes[index] !== undefined) {
        const dollarAmount = parseFloat(betSizes[index]).toFixed(2);
        cell.textContent = `$${dollarAmount}`;
      }
    });
    console.log("Bet sizes updated:", betSizes.length);
    return true;
  }
  
  // Listen for messages from the popup or content script
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      console.log("Message received:", request, "from:", sender);
      
      if (request.action === "runScraper") {
        // If the message comes from a content script, use the sender's tab ID
        const tabId = sender.tab ? sender.tab.id : null;
        
        if (tabId) {
          console.log("Running scraper on tab:", tabId);
          // Get the URL info for this tab
          chrome.tabs.get(tabId, function(tab) {
            if (chrome.runtime.lastError) {
              console.error("Error getting tab:", chrome.runtime.lastError);
              runScraper(tabId);
              return;
            }
            
            const url = new URL(tab.url);
            const baseUrl = url.origin + url.pathname;
            
            // Get URL-specific settings
            chrome.storage.local.get(['enabledUrls'], function(result) {
              const enabledUrls = result.enabledUrls || [];
              const urlInfo = enabledUrls.find(item => item.url === baseUrl && item.enabled);
              
              runScraper(tabId, urlInfo);
            });
          });
          sendResponse({status: "Scraper started on tab " + tabId});
        } else {
          // If no tab ID from sender, use the active tab
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) {
              console.log("Running scraper on active tab:", tabs[0].id);
              
              const url = new URL(tabs[0].url);
              const baseUrl = url.origin + url.pathname;
              
              // Get URL-specific settings
              chrome.storage.local.get(['enabledUrls'], function(result) {
                const enabledUrls = result.enabledUrls || [];
                const urlInfo = enabledUrls.find(item => item.url === baseUrl && item.enabled);
                
                runScraper(tabs[0].id, urlInfo);
              });
              
              sendResponse({status: "Scraper started on active tab " + tabs[0].id});
            } else {
              console.error("No active tab found");
              sendResponse({status: "Error: No active tab found"});
            }
          });
        }
        return true; // Keep the message channel open for the async response
      }
      else if (request.action === "updateSettings") {
        // Store settings when updated from popup
        chrome.storage.local.set({
          bankroll: request.bankroll,
          kellyMultiplier: request.kellyMultiplier
        }, function() {
          console.log("Settings saved:", request.bankroll, request.kellyMultiplier);
          sendResponse({status: "Settings saved"});
        });
        return true; // Keep the message channel open for the async response
      }
      else if (request.action === "updatePresetSettings") {
        // Store preset settings when updated from popup
        chrome.storage.local.set({
          minOdds: request.minOdds,
          maxOdds: request.maxOdds,
          minNumDataPoints: request.minNumDataPoints
        }, function() {
          console.log("Preset settings saved:", request.minOdds, request.maxOdds, request.minNumDataPoints);
          sendResponse({status: "Preset settings saved"});
        });
        return true; // Keep the message channel open for the async response
      }
    }
  );
