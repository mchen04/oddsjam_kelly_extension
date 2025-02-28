// Listen for tab updates to automatically run the scraper when navigating to Oddsjam
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('oddsjam.com')) {
      // Wait a bit for the page to fully render before checking
      setTimeout(() => {
        runScraper(tabId);
      }, 1500); // 1.5 second delay
    }
  });
  
  // Main function to orchestrate the scraping process
  function runScraper(tabId) {
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
            chrome.storage.sync.get({
              bankroll: 5000, 
              kellyMultiplier: 0.25
            }, (settings) => {
              const tableData = processTableData(
                scraped.text, 
                settings.bankroll, 
                settings.kellyMultiplier
              );
              
              // Step 3: Inject the new column
              chrome.scripting.executeScript({
                target: {tabId: tabId},
                function: injectBetSizeColumn
              }, () => {
                // Step 4: Update the bet sizes
                chrome.scripting.executeScript({
                  target: {tabId: tabId},
                  function: updateBetSizes,
                  args: [tableData.map(row => row.betSize)]
                });
              });
            });
          }
        });
      } else {
        console.log("No suitable table found on this page");
      }
    });
  }
  
  // Check if there's a table that needs our processing
  function checkForTargetTable() {
    const table = document.querySelector('table');
    if (!table) return false;
  
    const secondHeader = table.querySelector('thead tr th:nth-child(2)');
    if (secondHeader && secondHeader.textContent.toLowerCase().includes('game')) {
      if (!document.querySelector('.kelly_size')) {
        return true;
      }
    }
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
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.action === "runScraper") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          runScraper(tabs[0].id);
          sendResponse({status: "Scraper started"});
        });
        return true; // Keep the message channel open for the async response
      } 
      else if (request.action === "updateSettings") {
        // Store settings when updated from popup
        chrome.storage.sync.set({
          bankroll: request.bankroll,
          kellyMultiplier: request.kellyMultiplier
        }, function() {
          console.log("Settings saved");
          sendResponse({status: "Settings saved"});
        });
        return true; // Keep the message channel open for the async response
      }
    }
  );