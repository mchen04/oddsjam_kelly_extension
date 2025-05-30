document.addEventListener('DOMContentLoaded', function() {
  const scrapeButton = document.getElementById('scrapeButton');
  const resultsContainer = document.getElementById('results');
  const bankrollInput = document.getElementById('bankroll'); // This is for the main Kelly Criterion column
  const newKellyBankrollInput = document.getElementById('newKellyBankroll'); // This is for the new Kelly Calculator column
  const newKellyMultiplierInput = document.getElementById('newKellyMultiplier'); // This is for the new Kelly Calculator column
  const kellyMultiplierInput = document.getElementById('kellyMultiplier');
  const enableToggle = document.getElementById('enableToggle');
  const projectedOddsInput = document.getElementById('projectedOdds');
  const offeredOddsInput = document.getElementById('offeredOdds');
  const calculateKellyButton = document.getElementById('calculateKellyButton');
  const optimalBetPercentageSpan = document.getElementById('optimalBetPercentage');
  const recommendedWagerAmountSpan = document.getElementById('recommendedWagerAmount');
  
  // Preset Settings elements
  const presetToggle = document.getElementById('presetToggle');
  const minOddsInput = document.getElementById('minOdds');
  const maxOddsInput = document.getElementById('maxOdds');
  const minNumDataPointsInput = document.getElementById('minNumDataPoints');
  const savePresetButton = document.getElementById('savePresetButton');
  
  // Load saved values from storage
  loadSavedValues();
  
  // Save values when they change
  kellyMultiplierInput.addEventListener('change', saveValues);
  calculateKellyButton.addEventListener('click', calculateAndDisplayKelly);
  
  // Add event listener for newKellyBankrollInput to save its value
  newKellyBankrollInput.addEventListener('input', saveNewKellyBankroll);

  // Add event listeners for preset settings
  minOddsInput.addEventListener('change', savePresetValues);
  maxOddsInput.addEventListener('change', savePresetValues);
  minNumDataPointsInput.addEventListener('change', savePresetValues);
  enableToggle.addEventListener('change', function() {
    // When toggle changes, save its state and the current URL if enabled
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Extract base URL without query parameters
      const url = new URL(tabs[0].url);
      const baseUrl = url.origin + url.pathname;
      const urlTitle = tabs[0].title || baseUrl;
      
      // Get existing enabled URLs
      chrome.storage.local.get(['enabledUrls', 'bankroll', 'kellyMultiplier'], function(result) {
        let enabledUrls = result.enabledUrls || [];
        const currentBankroll = result.bankroll || bankrollInput.value;
        const currentKellyMultiplier = result.kellyMultiplier || kellyMultiplierInput.value;
        
        if (enableToggle.checked) {
          // Add current URL if not already in the list
          if (!enabledUrls.some(item => item.url === baseUrl)) {
            enabledUrls.push({
              url: baseUrl,
              title: urlTitle,
              enabled: true,
              bankroll: currentBankroll,
              kellyMultiplier: currentKellyMultiplier
            });
          } else {
            // Update existing URL to enabled
            enabledUrls = enabledUrls.map(item =>
              item.url === baseUrl ? {
                ...item,
                enabled: true,
                bankroll: currentBankroll,
                kellyMultiplier: currentKellyMultiplier
              } : item
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
    const newBankroll = bankrollInput.value;
    const newKellyMultiplier = kellyMultiplierInput.value;
    
    chrome.storage.local.set({
      'bankroll': newBankroll,
      'kellyMultiplier': newKellyMultiplier
    });
    
    // Also update these values for the current URL if it's enabled
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = new URL(tabs[0].url);
      const baseUrl = url.origin + url.pathname;
      
      chrome.storage.local.get(['enabledUrls'], function(result) {
        let enabledUrls = result.enabledUrls || [];
        const currentUrlInfo = enabledUrls.find(item => item.url === baseUrl && item.enabled);
        
        if (currentUrlInfo) {
          // Update the values for this URL
          enabledUrls = enabledUrls.map(item =>
            item.url === baseUrl ? {
              ...item,
              bankroll: newBankroll,
              kellyMultiplier: newKellyMultiplier
            } : item
          );
          
          chrome.storage.local.set({
            'enabledUrls': enabledUrls
          }, function() {
            // Update the displayed list
            displayEnabledUrls();
          });
        }
      });
    });
  }
  
  // Function to save newKellyBankroll to chrome.storage
  function saveNewKellyBankroll() {
    chrome.storage.local.set({
      'newKellyBankroll': newKellyBankrollInput.value
    });
  }

  // Function to save preset values to chrome.storage
  function savePresetValues() {
    chrome.storage.local.set({
      'minOdds': minOddsInput.value,
      'maxOdds': maxOddsInput.value,
      'minNumDataPoints': minNumDataPointsInput.value
    });
  }
  
  // Function to load saved values from chrome.storage
  function loadSavedValues() {
    chrome.storage.local.get([
      'bankroll',
      'kellyMultiplier',
      'enabledUrls',
      'minOdds',
      'maxOdds',
      'minNumDataPoints',
      'savedPresets',
      'newKellyBankroll' // Add newKellyBankroll to the list of items to retrieve
    ], function(result) {
      if (result.bankroll) {
        bankrollInput.value = result.bankroll;
      } else {
        bankrollInput.value = 5000; // New default
      }
      // Load newKellyBankroll from storage, or set default to 5000
      if (result.newKellyBankroll) {
        newKellyBankrollInput.value = result.newKellyBankroll;
      } else {
        newKellyBankrollInput.value = 5000; // Default for new Kelly Bankroll
      }
      if (result.kellyMultiplier) {
        kellyMultiplierInput.value = result.kellyMultiplier;
      } else {
        kellyMultiplierInput.value = 1; // New default
      }
      // Set default values for preset settings inputs if not already set
      // We don't use result.minOdds etc. here because we want to use the default values from the HTML
      // The HTML default values will be used unless there's a preset for the current page
      
      // Display the list of enabled URLs
      displayEnabledUrls();
      
      // Display the list of saved presets
      displaySavedPresets();
      
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
        
        // Check if current URL has preset settings
        const savedPresets = result.savedPresets || [];
        const currentPreset = savedPresets.find(preset => preset.url === currentBaseUrl);
        
        // Set preset toggle state based on current URL
        presetToggle.checked = currentPreset ? currentPreset.enabled : false;
        
        // Update input fields with preset values if available
        if (currentPreset && currentPreset.enabled) {
          // Only update input values if they exist in the preset
          if (currentPreset.minOdds !== undefined) {
            minOddsInput.value = currentPreset.minOdds;
          }
          
          if (currentPreset.maxOdds !== undefined) {
            maxOddsInput.value = currentPreset.maxOdds;
          }
          
          if (currentPreset.minNumDataPoints !== undefined) {
            minNumDataPointsInput.value = currentPreset.minNumDataPoints;
          }
        }
        
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
                // Process the data with URL-specific settings
                processTableData(results[0].result.text);
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
        
        // Create URL text container
        const textContainer = document.createElement('div');
        textContainer.className = 'url-text-container';
        
        // Create URL text
        const urlText = document.createElement('span');
        urlText.className = 'url-text';
        urlText.textContent = item.title || item.url;
        textContainer.appendChild(urlText);
        
        // Add values if enabled
        if (item.enabled && (item.bankroll || item.kellyMultiplier)) {
          const valuesContainer = document.createElement('div');
          valuesContainer.className = 'url-values';
          
          const bankrollValue = item.bankroll || bankrollInput.value;
          const kellyValue = item.kellyMultiplier || kellyMultiplierInput.value;
          
          valuesContainer.innerHTML = `
            <span class="value-item">Bankroll: $${bankrollValue}</span>
            <span class="value-item">Kelly %: ${kellyValue}</span>
          `;
          
          textContainer.appendChild(valuesContainer);
        }
        
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
        listItem.appendChild(textContainer);
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
  
  // Preset Settings functionality
  
  // Handle preset toggle changes
  presetToggle.addEventListener('change', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = new URL(tabs[0].url);
      const baseUrl = url.origin + url.pathname;
      const urlTitle = tabs[0].title || baseUrl;
      const presetName = urlTitle.split(' - ')[0] || 'Preset';
      
      // Get the current input values
      const minOddsValue = minOddsInput.value.trim();
      const maxOddsValue = maxOddsInput.value.trim();
      const minNumDataPointsValue = minNumDataPointsInput.value.trim();
      
      // Get existing saved presets
      chrome.storage.local.get(['savedPresets'], function(result) {
        let savedPresets = result.savedPresets || [];
        
        if (presetToggle.checked) {
          // Create preset object with only non-empty values
          const presetData = {
            url: baseUrl,
            title: urlTitle,
            enabled: true,
            name: presetName
          };
          
          // Only include parameters that have actual values (not just whitespace)
          // Note: "0" is considered a valid value
          if (minOddsValue !== '' && minOddsValue.trim() !== '') presetData.minOdds = minOddsValue.trim();
          if (maxOddsValue !== '' && maxOddsValue.trim() !== '') presetData.maxOdds = maxOddsValue.trim();
          if (minNumDataPointsValue !== '' && minNumDataPointsValue.trim() !== '') presetData.minNumDataPoints = minNumDataPointsValue.trim();
          
          // Add current URL if not already in the list
          if (!savedPresets.some(item => item.url === baseUrl)) {
            savedPresets.push(presetData);
          } else {
            // Update existing URL to enabled and update settings
            savedPresets = savedPresets.map(item => {
              if (item.url === baseUrl) {
                // Start with a clean preset object that only has the base properties
                const updatedPreset = {
                  ...item,
                  enabled: true,
                  name: presetName,
                  title: urlTitle
                };
                
                // Explicitly handle each parameter - add if present, remove if empty
                if (minOddsValue !== '' && minOddsValue.trim() !== '') {
                  updatedPreset.minOdds = minOddsValue.trim();
                } else {
                  // Explicitly delete the property if it exists and the new value is empty
                  delete updatedPreset.minOdds;
                }
                
                if (maxOddsValue !== '' && maxOddsValue.trim() !== '') {
                  updatedPreset.maxOdds = maxOddsValue.trim();
                } else {
                  delete updatedPreset.maxOdds;
                }
                
                if (minNumDataPointsValue !== '' && minNumDataPointsValue.trim() !== '') {
                  updatedPreset.minNumDataPoints = minNumDataPointsValue.trim();
                } else {
                  delete updatedPreset.minNumDataPoints;
                }
                
                return updatedPreset;
              }
              return item;
            });
          }
        } else {
          // Update existing URL to disabled
          savedPresets = savedPresets.map(item =>
            item.url === baseUrl ? {...item, enabled: false} : item
          );
        }
        
        // Save updated list
        chrome.storage.local.set({
          'savedPresets': savedPresets
        }, function() {
          // Update the displayed list
          displaySavedPresets();
        });
      });
    });
  });
  
  // Handle save preset button
  savePresetButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = new URL(tabs[0].url);
      const baseUrl = url.origin + url.pathname;
      const urlTitle = tabs[0].title || baseUrl;
      const presetName = urlTitle.split(' - ')[0] || 'Preset';
      
      // Get the current input values
      const minOddsValue = minOddsInput.value.trim();
      const maxOddsValue = maxOddsInput.value.trim();
      const minNumDataPointsValue = minNumDataPointsInput.value.trim();
      
      // Get existing saved presets
      chrome.storage.local.get(['savedPresets'], function(result) {
        let savedPresets = result.savedPresets || [];
        
        // Create preset object with only non-empty values
        const presetData = {
          url: baseUrl,
          title: urlTitle,
          enabled: true,
          name: presetName
        };
        
        // Only include parameters that have actual values (not just whitespace)
        // Note: "0" is considered a valid value
        if (minOddsValue !== '' && minOddsValue.trim() !== '') presetData.minOdds = minOddsValue.trim();
        if (maxOddsValue !== '' && maxOddsValue.trim() !== '') presetData.maxOdds = maxOddsValue.trim();
        if (minNumDataPointsValue !== '' && minNumDataPointsValue.trim() !== '') presetData.minNumDataPoints = minNumDataPointsValue.trim();
        
        // Add or update preset
        if (!savedPresets.some(item => item.url === baseUrl)) {
          // Add new preset
          savedPresets.push(presetData);
        } else {
          // Update existing preset
          savedPresets = savedPresets.map(item => {
            if (item.url === baseUrl) {
              // Start with a clean preset object that only has the base properties
              const updatedPreset = {
                ...item,
                enabled: true,
                name: presetName,
                title: urlTitle
              };
              
              // Explicitly handle each parameter - add if present, remove if empty
              if (minOddsValue !== '' && minOddsValue.trim() !== '') {
                updatedPreset.minOdds = minOddsValue.trim();
              } else {
                // Explicitly delete the property if it exists and the new value is empty
                delete updatedPreset.minOdds;
              }
              
              if (maxOddsValue !== '' && maxOddsValue.trim() !== '') {
                updatedPreset.maxOdds = maxOddsValue.trim();
              } else {
                delete updatedPreset.maxOdds;
              }
              
              if (minNumDataPointsValue !== '' && minNumDataPointsValue.trim() !== '') {
                updatedPreset.minNumDataPoints = minNumDataPointsValue.trim();
              } else {
                delete updatedPreset.minNumDataPoints;
              }
              
              return updatedPreset;
            }
            return item;
          });
        }
        
        // Turn on the preset toggle
        presetToggle.checked = true;
        
        // Save updated list
        chrome.storage.local.set({
          'savedPresets': savedPresets
        }, function() {
          // Update the displayed list
          displaySavedPresets();
          
          // Immediately apply the preset to the current tab
          applyPresetToCurrentTab(presetData);
        });
      });
    });
  });
  
  // Function to apply preset to current tab
  function applyPresetToCurrentTab(preset) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) {
        console.error("No active tab found");
        return;
      }
      
      try {
        // Create a new URL object to manipulate
        const currentUrl = new URL(tabs[0].url);
        const newUrl = new URL(tabs[0].url);
        let urlModified = false;
        
        // Handle minOdds parameter
        if (preset.minOdds !== undefined && preset.minOdds !== '') {
          // Only modify if the current value is different
          if (currentUrl.searchParams.get('minOdds') !== preset.minOdds) {
            newUrl.searchParams.set('minOdds', preset.minOdds);
            urlModified = true;
          }
        } else {
          // Remove parameter if it exists in URL but not in preset
          if (currentUrl.searchParams.has('minOdds')) {
            newUrl.searchParams.delete('minOdds');
            urlModified = true;
          }
        }
        
        // Handle maxOdds parameter
        if (preset.maxOdds !== undefined && preset.maxOdds !== '') {
          // Only modify if the current value is different
          if (currentUrl.searchParams.get('maxOdds') !== preset.maxOdds) {
            newUrl.searchParams.set('maxOdds', preset.maxOdds);
            urlModified = true;
          }
        } else {
          // Remove parameter if it exists in URL but not in preset
          if (currentUrl.searchParams.has('maxOdds')) {
            newUrl.searchParams.delete('maxOdds');
            urlModified = true;
          }
        }
        
        // Handle minNumDataPoints parameter
        if (preset.minNumDataPoints !== undefined && preset.minNumDataPoints !== '') {
          // Only modify if the current value is different
          if (currentUrl.searchParams.get('minNumDataPoints') !== preset.minNumDataPoints) {
            newUrl.searchParams.set('minNumDataPoints', preset.minNumDataPoints);
            urlModified = true;
          }
        } else {
          // Remove parameter if it exists in URL but not in preset
          if (currentUrl.searchParams.has('minNumDataPoints')) {
            newUrl.searchParams.delete('minNumDataPoints');
            urlModified = true;
          }
        }
        
        // Only update the tab URL if we actually modified it
        if (urlModified) {
          // Check if the new URL is actually different from the current URL
          if (newUrl.toString() !== tabs[0].url) {
            console.log("URL parameters changed, updating URL to:", newUrl.toString());
            chrome.tabs.update(tabs[0].id, {url: newUrl.toString()});
          } else {
            console.log("URL parameters rearranged but content is the same, skipping refresh");
          }
        } else {
          console.log("No parameters changed, URL not modified");
        }
      } catch (err) {
        console.error("Error applying preset to current tab:", err);
      }
    });
  }
  
  // Function to display the list of saved presets
  function displaySavedPresets() {
    const presetListContainer = document.getElementById('savedPresetsList');
    if (!presetListContainer) return;
    
    // Clear the container
    presetListContainer.innerHTML = '';
    
    // Get the list of saved presets
    chrome.storage.local.get(['savedPresets'], function(result) {
      const savedPresets = result.savedPresets || [];
      
      if (savedPresets.length === 0) {
        presetListContainer.innerHTML = '<p class="no-presets">No presets have been saved yet.</p>';
        return;
      }
      
      // Create a list element
      const list = document.createElement('ul');
      list.className = 'preset-items-list';
      
      // Add each preset to the list
      savedPresets.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'url-item';
        
        // Create toggle switch container
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'url-toggle';
        
        // Create toggle input
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = `preset-toggle-${index}`;
        toggleInput.checked = item.enabled;
        toggleInput.dataset.url = item.url;
        toggleInput.addEventListener('change', function() {
          togglePresetEnabled(item.url, this.checked);
        });
        
        // Create toggle label
        const toggleLabel = document.createElement('label');
        toggleLabel.htmlFor = `preset-toggle-${index}`;
        
        // Add input and label to container
        toggleContainer.appendChild(toggleInput);
        toggleContainer.appendChild(toggleLabel);
        
        // Create URL text container
        const textContainer = document.createElement('div');
        textContainer.className = 'url-text-container';
        
        // Create URL text
        const urlText = document.createElement('span');
        urlText.className = 'url-text';
        urlText.textContent = item.title || item.url;
        textContainer.appendChild(urlText);
        
        // Add values if enabled
        if (item.enabled) {
          const valuesContainer = document.createElement('div');
          valuesContainer.className = 'url-values';
          
          // Create an array to hold the value items
          const valueItems = [];
          
          // Only add values that exist in the preset
          if (item.minOdds !== undefined) {
            valueItems.push(`<span class="value-item">Min Odds: ${item.minOdds}</span>`);
          }
          
          if (item.maxOdds !== undefined) {
            valueItems.push(`<span class="value-item">Max Odds: ${item.maxOdds}</span>`);
          }
          
          if (item.minNumDataPoints !== undefined) {
            valueItems.push(`<span class="value-item">Min Data Points: ${item.minNumDataPoints}</span>`);
          }
          
          // If no values exist, show a message
          if (valueItems.length === 0) {
            valueItems.push(`<span class="value-item">No parameters set</span>`);
          }
          
          valuesContainer.innerHTML = valueItems.join('');
          
          textContainer.appendChild(valuesContainer);
        }
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-url';
        deleteButton.textContent = '×';
        deleteButton.dataset.url = item.url;
        deleteButton.addEventListener('click', function() {
          deletePreset(item.url);
        });
        
        // Add elements to list item
        listItem.appendChild(toggleContainer);
        listItem.appendChild(textContainer);
        listItem.appendChild(deleteButton);
        
        // Add list item to list
        list.appendChild(listItem);
      });
      
      // Add list to container
      presetListContainer.appendChild(list);
    });
  }
  
  // Function to toggle a preset's enabled state
  function togglePresetEnabled(url, enabled) {
    chrome.storage.local.get(['savedPresets'], function(result) {
      let savedPresets = result.savedPresets || [];
      
      // Update the preset's enabled state
      savedPresets = savedPresets.map(item =>
        item.url === url ? {...item, enabled: enabled} : item
      );
      
      // Save the updated list
      chrome.storage.local.set({
        'savedPresets': savedPresets
      }, function() {
        // Update the displayed list
        displaySavedPresets();
      });
    });
  }
  
  // Function to delete a preset from the list
  function deletePreset(url) {
    chrome.storage.local.get(['savedPresets'], function(result) {
      let savedPresets = result.savedPresets || [];
      
      // Remove the preset from the list
      savedPresets = savedPresets.filter(item => item.url !== url);
      
      // Save the updated list
      chrome.storage.local.set({
        'savedPresets': savedPresets
      }, function() {
        // Update the displayed list
        displaySavedPresets();
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
        chrome.storage.local.get(['enabledUrls', 'bankroll', 'kellyMultiplier'], function(result) {
          let enabledUrls = result.enabledUrls || [];
          const currentBankroll = result.bankroll || bankrollInput.value;
          const currentKellyMultiplier = result.kellyMultiplier || kellyMultiplierInput.value;
          
          // Add current URL if not already in the list
          if (!enabledUrls.some(item => item.url === baseUrl)) {
            enabledUrls.push({
              url: baseUrl,
              title: urlTitle,
              enabled: true,
              bankroll: currentBankroll,
              kellyMultiplier: currentKellyMultiplier
            });
          } else {
            // Update existing URL to enabled
            enabledUrls = enabledUrls.map(item =>
              item.url === baseUrl ? {
                ...item,
                enabled: true,
                bankroll: currentBankroll,
                kellyMultiplier: currentKellyMultiplier
              } : item
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
      // Process the data with URL-specific settings
      processTableData(results[0].result.text);
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
  
  // Get the current URL to check for URL-specific settings
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = new URL(tabs[0].url);
    const baseUrl = url.origin + url.pathname;
    
    // Get URL-specific settings if available
    chrome.storage.local.get(['enabledUrls', 'bankroll', 'kellyMultiplier'], function(result) {
      const enabledUrls = result.enabledUrls || [];
      const currentUrlInfo = enabledUrls.find(item => item.url === baseUrl && item.enabled);
      
      // Use URL-specific settings if available, otherwise fall back to global settings
      const bankroll = currentUrlInfo?.bankroll || parseFloat(document.getElementById('bankroll').value) || 5000;
      const kellyMultiplier = currentUrlInfo?.kellyMultiplier || parseFloat(document.getElementById('kellyMultiplier').value) || 1;
      
      console.log(`Using settings - Bankroll: ${bankroll}, Kelly %: ${kellyMultiplier}`);
      
      processTableDataWithSettings(rawText, bankroll, kellyMultiplier);
    });
  });
  
  // This function will be called once we have the correct settings
  function processTableDataWithSettings(rawText, bankroll, kellyMultiplier) {
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
    
    // Now that we have the data, update the UI
    updateUIWithTableData(tableData);
  }
  
  return tableData;
}

function calculateAndDisplayKelly() {
  const projectedOdds = projectedOddsInput.value.trim();
  const offeredOdds = offeredOddsInput.value.trim();

  if (!projectedOdds || !offeredOdds) {
    optimalBetPercentageSpan.textContent = 'Please enter both odds.';
    recommendedWagerAmountSpan.textContent = 'N/A';
    return;
  }

  const bankroll = parseFloat(newKellyBankrollInput.value) || 5000;
  const kellyMultiplier = parseFloat(newKellyMultiplierInput.value) || 1.0;

  // Convert American odds to decimal odds
  const bookDecimalOdds = americanToDecimal(offeredOdds);
  const actualProb = calculateImpliedOdds(projectedOdds) / 100; // Projected odds are true odds

  if (isNaN(bookDecimalOdds) || isNaN(actualProb) || actualProb <= 0) {
    optimalBetPercentageSpan.textContent = 'Invalid odds entered.';
    recommendedWagerAmountSpan.textContent = 'N/A';
    return;
  }

  const b = bookDecimalOdds - 1;
  const p = actualProb;
  const q = 1.0 - p;

  let kellyFraction = 0;
  if (b > 0) { // Avoid division by zero
    kellyFraction = ((b * p) - q) / b;
  }

  const optimalBetPercent = Math.max(0, kellyFraction * kellyMultiplier);
  const recommendedWager = (optimalBetPercent * bankroll).toFixed(2);

  optimalBetPercentageSpan.textContent = `${(optimalBetPercent * 100).toFixed(2)}%`;
  recommendedWagerAmountSpan.textContent = `$${recommendedWager}`;
}

// Function to update the UI with the processed table data
function updateUIWithTableData(tableData) {
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
    return parseFloat((100 / (odds + 100) * 100).toFixed(2));
  } else {
    return parseFloat((Math.abs(odds) / (Math.abs(odds) + 100) * 100).toFixed(2));
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

    // Get the current URL to check for URL-specific settings
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = new URL(tabs[0].url);
      const baseUrl = url.origin + url.pathname;
      
      // Get URL-specific settings if available
      chrome.storage.local.get(['enabledUrls', 'bankroll', 'kellyMultiplier'], function(result) {
        const enabledUrls = result.enabledUrls || [];
        const currentUrlInfo = enabledUrls.find(item => item.url === baseUrl && item.enabled);
        
        // Use URL-specific settings if available, otherwise fall back to global settings
        const bankroll = currentUrlInfo?.bankroll || parseFloat(document.getElementById('bankroll').value) || 4000;
        const kellyMultiplier = currentUrlInfo?.kellyMultiplier || parseFloat(document.getElementById('kellyMultiplier').value) || 0.25;
        
        console.log(`Using settings for table processing - Bankroll: ${bankroll}, Kelly %: ${kellyMultiplier}`);
        
        rows.forEach(row => {
          const evCell = row.querySelector('td:nth-child(5)');
          const oddsCell = row.querySelector('td:nth-child(6)');
          
          if (evCell && oddsCell) {
            const ev = parseFloat(evCell.textContent);
            const odds = oddsCell.textContent.trim();
            const kellyFraction = calculateKelly(ev, odds);
            const betSize = (kellyFraction * kellyMultiplier * bankroll).toFixed(2);
            tableData.push({ betSize });
          }
        });

        const resultsContainer = document.getElementById('results');
        if (tableData.length > 0) {
          updateUIWithTableData(tableData);
        } else {
          resultsContainer.innerHTML = "No matching elements found or error occurred";
        }
      });
    });
  }
}
});
