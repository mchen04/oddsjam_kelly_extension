document.addEventListener('DOMContentLoaded', function() {
  const scrapeButton = document.getElementById('scrapeButton');
  const resultsContainer = document.getElementById('results');
  const bankrollInput = document.getElementById('bankroll');
  const kellyMultiplierInput = document.getElementById('kellyMultiplier');
  const enableToggle = document.getElementById('enableToggle');
  
  // Load saved values from storage
  loadSavedValues();
  
  // Save values when they change
  bankrollInput.addEventListener('change', saveValues);
  kellyMultiplierInput.addEventListener('change', saveValues);
  enableToggle.addEventListener('change', function() {
    // When toggle changes, save its state and the current URL if enabled
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Extract base URL without query parameters
      const url = new URL(tabs[0].url);
      const baseUrl = url.origin + url.pathname;
      const urlTitle = tabs[0].title || baseUrl;
      
      // Get existing enabled URLs
      chrome.storage.local.get(['enabledUrls'], function(result) {
        let enabledUrls = result.enabledUrls || [];
        
        if (enableToggle.checked) {
          // Add current URL if not already in the list
          if (!enabledUrls.some(item => item.url === baseUrl)) {
            enabledUrls.push({
              url: baseUrl,
              title: urlTitle,
              enabled: true
            });
          } else {
            // Update existing URL to enabled
            enabledUrls = enabledUrls.map(item =>
              item.url === baseUrl ? {...item, enabled: true} : item
            );
          }
        } else {
          // Update existing URL to disabled
          enabledUrls = enabledUrls.map(item =>
            item.url === baseUrl ? {...item, enabled: false} : item
          );
        }
        
        // Save updated list
        chrome.storage.local.set({
          'enabledUrls': enabledUrls
        }, function() {
          // Update the displayed list
          displayEnabledUrls();
        });
      });
    });
  });
  
  // Function to save values to chrome.storage
  function saveValues() {
    chrome.storage.local.set({
      'bankroll': bankrollInput.value,
      'kellyMultiplier': kellyMultiplierInput.value
    });
  }
  
  // Function to load saved values from chrome.storage
  function loadSavedValues() {
    chrome.storage.local.get(['bankroll', 'kellyMultiplier', 'enabledUrls'], function(result) {
      if (result.bankroll) {
        bankrollInput.value = result.bankroll;
      }
      if (result.kellyMultiplier) {
        kellyMultiplierInput.value = result.kellyMultiplier;
      }
      
      // Display the list of enabled URLs
      displayEnabledUrls();
      
      // Check if we're on an enabled page
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        // Extract base URL without query parameters
        const url = new URL(tabs[0].url);
        const currentBaseUrl = url.origin + url.pathname;
        
        // Check if current URL is in the enabled list
        const enabledUrls = result.enabledUrls || [];
        const currentUrlInfo = enabledUrls.find(item => item.url === currentBaseUrl);
        
        // Set toggle state based on current URL
        enableToggle.checked = currentUrlInfo ? currentUrlInfo.enabled : false;
        
        // If current URL is enabled, run the scraper and get data
        if (currentUrlInfo && currentUrlInfo.enabled) {
          autoRunScraper();
          // Also run the Get Data functionality
          runGetData();
        }
        
        // Function to run the Get Data functionality
        function runGetData() {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              function: scrapeTargetedElements
            }, (results) => {
              if (results && results[0] && results[0].result) {
                const tableData = processTableData(results[0].result.text);
                
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  chrome.scripting.executeScript({
                    target: {tabId: tabs[0].id},
                    function: injectBetSizeColumn
                  }, () => {
                    // Add a short delay before updating bet sizes to ensure values are properly calculated
                    setTimeout(() => {
                      chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        function: updateBetSizes,
                        args: [tableData.map(row => row.betSize)]
                      });
                    }, 250); // 0.25 second delay
                  });
                });
              }
            });
          });
        }
      });
    });
  }
  
  // Function to display the list of enabled URLs
  function displayEnabledUrls() {
    // Get the container for the URL list (we'll add this to the HTML)
    const urlListContainer = document.getElementById('enabledUrlsList');
    if (!urlListContainer) return;
    
    // Clear the container
    urlListContainer.innerHTML = '';
    
    // Get the list of enabled URLs
    chrome.storage.local.get(['enabledUrls'], function(result) {
      const enabledUrls = result.enabledUrls || [];
      
      if (enabledUrls.length === 0) {
        urlListContainer.innerHTML = '<p class="no-urls">No pages have been enabled yet.</p>';
        return;
      }
      
      // Create a list element
      const list = document.createElement('ul');
      list.className = 'url-list';
      
      // Add each URL to the list
      enabledUrls.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'url-item';
        
        // Create toggle switch container
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'url-toggle';
        
        // Create toggle input
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = `toggle-${index}`;
        toggleInput.checked = item.enabled;
        toggleInput.dataset.url = item.url;
        toggleInput.addEventListener('change', function() {
          toggleUrlEnabled(item.url, this.checked);
        });
        
        // Create toggle label
        const toggleLabel = document.createElement('label');
        toggleLabel.htmlFor = `toggle-${index}`;
        
        // Add input and label to container
        toggleContainer.appendChild(toggleInput);
        toggleContainer.appendChild(toggleLabel);
        
        // Create URL text
        const urlText = document.createElement('span');
        urlText.className = 'url-text';
        urlText.textContent = item.title || item.url;
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-url';
        deleteButton.textContent = '×';
        deleteButton.dataset.url = item.url;
        deleteButton.addEventListener('click', function() {
          deleteUrl(item.url);
        });
        
        // Add elements to list item
        listItem.appendChild(toggleContainer);
        listItem.appendChild(urlText);
        listItem.appendChild(deleteButton);
        
        // Add list item to list
        list.appendChild(listItem);
      });
      
      // Add list to container
      urlListContainer.appendChild(list);
    });
  }
  
  // Function to toggle a URL's enabled state
  function toggleUrlEnabled(url, enabled) {
    chrome.storage.local.get(['enabledUrls'], function(result) {
      let enabledUrls = result.enabledUrls || [];
      
      // Update the URL's enabled state
      enabledUrls = enabledUrls.map(item =>
        item.url === url ? {...item, enabled: enabled} : item
      );
      
      // Save the updated list
      chrome.storage.local.set({
        'enabledUrls': enabledUrls
      }, function() {
        // Update the displayed list
        displayEnabledUrls();
      });
    });
  }
  
  // Function to delete a URL from the list
  function deleteUrl(url) {
    chrome.storage.local.get(['enabledUrls'], function(result) {
      let enabledUrls = result.enabledUrls || [];
      
      // Remove the URL from the list
      enabledUrls = enabledUrls.filter(item => item.url !== url);
      
      // Save the updated list
      chrome.storage.local.set({
        'enabledUrls': enabledUrls
      }, function() {
        // Update the displayed list
        displayEnabledUrls();
      });
    });
  }
  
  // Auto-run function
  function autoRunScraper() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: checkAndRunScraper
      });
    });
  }

  // Function to check if we're on the right page and run the scraper
  function checkAndRunScraper() {
    const table = document.querySelector('table');
    if (!table) return;

    const secondHeader = table.querySelector('thead tr th:nth-child(2)');
    if (secondHeader && secondHeader.textContent.toLowerCase().includes('game')) {
      // Only run if Kelly column doesn't exist yet
      if (!document.querySelector('.kelly_size')) {
        scrapeTargetedElements();
      }
    }
  }

  // No longer run here - now runs after loading saved values

  // Keep button for manual runs
  scrapeButton.addEventListener('click', function() {
    // If toggle is enabled, save current URL to the list
    if (enableToggle.checked) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        // Extract base URL without query parameters
        const url = new URL(tabs[0].url);
        const baseUrl = url.origin + url.pathname;
        const urlTitle = tabs[0].title || baseUrl;
        
        // Get existing enabled URLs
        chrome.storage.local.get(['enabledUrls'], function(result) {
          let enabledUrls = result.enabledUrls || [];
          
          // Add current URL if not already in the list
          if (!enabledUrls.some(item => item.url === baseUrl)) {
            enabledUrls.push({
              url: baseUrl,
              title: urlTitle,
              enabled: true
            });
          } else {
            // Update existing URL to enabled
            enabledUrls = enabledUrls.map(item =>
              item.url === baseUrl ? {...item, enabled: true} : item
            );
          }
          
          // Save updated list
          chrome.storage.local.set({
            'enabledUrls': enabledUrls
          }, function() {
            // Update the displayed list
            displayEnabledUrls();
          });
        });
      });
    }
    
    // Always run when button is clicked, regardless of toggle state
    runGetData();
  });

// This function runs in the context of the web page
function scrapeTargetedElements() {
  try {
    // Target the specific class
    const targetClass = "text-sm text-inherit __className_321157";
    const elements = document.querySelectorAll(`.${targetClass.split(' ').join('.')}`);
    
    if (elements.length === 0) {
      return "No elements found with the specified class";
    }
    
    // Create overlay container if it doesn't exist
    let overlayContainer = document.getElementById('kelly-overlay-container');
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = 'kelly-overlay-container';
      overlayContainer.style.cssText = `
        position: absolute;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(overlayContainer);
    }
    
    let result = "";
    elements.forEach((element, index) => {
      const text = element.textContent.trim();
      if (text) {
        result += `${index + 1}. ${text}\n\n`;
        
        // Create bet size overlay element
        const overlay = document.createElement('div');
        overlay.className = 'kelly-bet-overlay';
        overlay.style.cssText = `
          position: absolute;
          background: rgba(0, 128, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
        `;
        
        // Position overlay next to the odds element
        const rect = element.getBoundingClientRect();
        overlay.style.top = `${rect.top + window.scrollY}px`;
        overlay.style.left = `${rect.right + window.scrollX + 5}px`;
        
        // Store the index as a data attribute
        overlay.dataset.index = index;
        overlayContainer.appendChild(overlay);
      }
    });
    
    return { text: result, elements: elements.length };
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function displayResults(results) {
  if (!resultsContainer) {
      console.error('Results container not found');
      return;
  }

  if (results && results[0] && results[0].result) {
      const tableData = processTableData(results[0].result.text);
      //displayTableFormat(tableData);
      
      // Inject column and update bet sizes
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              function: injectBetSizeColumn
          }, () => {
              // Add a short delay before updating bet sizes to ensure values are properly calculated
              setTimeout(() => {
                  chrome.scripting.executeScript({
                      target: {tabId: tabs[0].id},
                      function: updateBetSizes,
                      args: [tableData.map(row => row.betSize)]
                  });
              }, 250); // 0.25 second delay
          });
      });
  } else {
      resultsContainer.innerHTML = "No matching elements found or error occurred";
  }
}

function injectBetSizeColumn() {
  const table = document.querySelector('table');
  if (!table) return;

  // Check if column already exists by looking for the kelly_size class
  if (document.querySelector('.kelly_size')) {
    return;
  }

  // Add header
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
  
  // Insert after the 7th column
  const seventhHeader = headerRow.children[6];
  if (seventhHeader) {
    seventhHeader.after(newHeader);
  } else {
    headerRow.appendChild(newHeader);
  }

  // Add cells to each row
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const newCell = document.createElement('td');
    newCell.className = `${row.firstElementChild?.className || ''} kelly_size`;
    newCell.innerHTML = `
      <div class="flex h-full flex-col justify-center px-4 py-3 min-w-[100px] text-center hover:brightness-110">
        <p class="text-sm text-inherit kelly-bet-size">Calculating...</p>
      </div>
    `;
    
    // Insert after the 7th column
    const seventhCell = row.children[6];
    if (seventhCell) {
      seventhCell.after(newCell);
    } else {
      row.appendChild(newCell);
    }
  });
}

function updateBetSizes(betSizes) {
  const cells = document.querySelectorAll('.kelly-bet-size');
  cells.forEach((cell, index) => {
    if (betSizes[index] !== undefined) {
      // Format as currency instead of percentage
      const dollarAmount = parseFloat(betSizes[index]).toFixed(2);
      cell.textContent = `$${dollarAmount}`;
    }
  });
}

function processTableData(rawText) {
  const lines = rawText.trim().split('\n\n');
  const tableData = [];
  const bankroll = parseFloat(document.getElementById('bankroll').value) || 4000;
  const kellyMultiplier = parseFloat(document.getElementById('kellyMultiplier').value) || 0.25;
  
  for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 < lines.length) {
          const trueAmericanOdds = lines[i + 1].replace(/^\d+\.\s/, '');
          const bookAmericanOdds = lines[i + 2].replace(/^\d+\.\s/, '');
          const bookDecimalOdds = americanToDecimal(bookAmericanOdds);
          const actualProb = calculateImpliedOdds(trueAmericanOdds) / 100;
          
          // Kelly Criterion calculation with step-by-step logging
          const b = bookDecimalOdds - 1;
          const p = actualProb; 
          const q = 1.0 - p;   
          
          console.log('Kelly Step by Step:');
          console.log('1. b =', b);
          console.log('2. p =', p);
          console.log('3. 1.0 - p =', q);
          console.log('4. b * p =', b * p);
          console.log('5. (b * p) - q =', (b * p) - q);
          console.log('6. ((b * p) - q) / b =', ((b * p) - q) / b);
          
          const kellyFraction = ((b * p) - q) / b;
          const betSize = Math.max(0, kellyFraction * kellyMultiplier * bankroll).toFixed(2);
          
          const row = {
              ev: lines[i].replace(/^\d+\.\s/, ''),
              odds: trueAmericanOdds,
              bookPrice: bookAmericanOdds,
              impliedOdds: calculateImpliedOdds(trueAmericanOdds),
              betSize: betSize
          };
          tableData.push(row);
      }
  }
  return tableData;
}

function americanToDecimal(americanOdds) {
  // Remove any '+' sign before parsing
  const odds = parseInt(americanOdds.replace('+', ''));
  console.log('Converting odds:', americanOdds, 'to number:', odds);
  
  if (odds > 0) {
      return 1 + (odds / 100);
  } else {
      return 1 + (100 / Math.abs(odds));
  }
}

function calculateImpliedOdds(americanOdds) {
  const odds = parseInt(americanOdds);
  if (isNaN(odds)) return 0;
  
  if (odds > 0) {
    return (100 / (odds + 100) * 100).toFixed(2);
  } else {
    return (Math.abs(odds) / (Math.abs(odds) + 100) * 100).toFixed(2);
  }
}

function displayTableFormat(tableData) {
  const table = document.createElement('table');
  table.innerHTML = `
    <tr>
      <th>EV %</th>
      <th>No-Vig Odds</th>
      <th>Book Price</th>
      <th>Implied Odds (%)</th>
      <th>Bet Size</th>
    </tr>
  `;
  
  tableData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.ev}</td>
      <td>${row.odds}</td>
      <td>${row.bookPrice}</td>
      <td>${row.impliedOdds}%</td>
      <td>$${row.betSize}</td>
    `;
    table.appendChild(tr);
  });
  
  // Get the results container and safely update its contents
  if (resultsContainer) {
      // Clear existing content
      resultsContainer.innerHTML = '';
      // Add the new table
      resultsContainer.appendChild(table);
  } else {
      console.error('Results container not found');
  }
}

function calculateKelly(ev, odds) {
  if (!ev || !odds) return 0;
  const decimalOdds = convertToDecimalOdds(odds);
  if (!decimalOdds) return 0;
  
  const p = (ev / 100) + 0.5; // Convert EV% to probability
  const q = 1 - p;
  const b = decimalOdds - 1;
  
  const f = (p * b - q) / b;
  return Math.max(0, f); // Kelly fraction (between 0 and 1)
}

function processTable() {
  const table = document.querySelector('table');
  if (table) {
      const rows = table.querySelectorAll('tbody tr');
      const tableData = [];

      rows.forEach(row => {
          const evCell = row.querySelector('td:nth-child(5)');
          const oddsCell = row.querySelector('td:nth-child(6)');
          
          if (evCell && oddsCell) {
              const ev = parseFloat(evCell.textContent);
              const odds = oddsCell.textContent.trim();
              const betSize = calculateKelly(ev, odds);
              tableData.push({ betSize });
          }
      });

      const resultsContainer = document.getElementById('results');
      if (tableData.length > 0) {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              chrome.scripting.executeScript({
                  target: {tabId: tabs[0].id},
                  function: injectBetSizeColumn
              }, () => {
                  chrome.scripting.executeScript({
                      target: {tabId: tabs[0].id},
                      function: updateBetSizes,
                      args: [tableData.map(row => row.betSize)]
                  });
              });
          });
      } else {
          resultsContainer.innerHTML = "No matching elements found or error occurred";
      }
  }
}
});
