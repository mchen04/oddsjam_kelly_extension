// Run immediately when the content script is loaded
console.log("Content script loaded, checking if page is enabled...");
checkIfPageEnabled();

// Also run when the page is fully loaded (for cases where immediate execution might be too early)
window.addEventListener('load', function() {
    console.log("Window load event fired, checking if page is enabled...");
    checkIfPageEnabled();
});

// Also run when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded, checking if page is enabled...");
    checkIfPageEnabled();
});

// Set up a MutationObserver to detect when the table is added to the DOM
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
            // Check if any of the added nodes is a table or contains a table
            for (let i = 0; i < mutation.addedNodes.length; i++) {
                const node = mutation.addedNodes[i];
                if (node.nodeName === 'TABLE' || (node.querySelector && node.querySelector('table'))) {
                    console.log("Table detected in DOM, checking if page is enabled...");
                    checkIfPageEnabled();
                    break;
                }
            }
        }
    });
});

// Set up a timer to periodically check for tables that might be loaded dynamically
let checkInterval = setInterval(function() {
    if (document.querySelector('table') && !document.querySelector('.kelly_size')) {
        console.log("Table found during interval check, checking if page is enabled...");
        checkIfPageEnabled();
    }
}, 2000); // Check every 2 seconds

// Clear the interval after 30 seconds to avoid unnecessary checks
setTimeout(function() {
    clearInterval(checkInterval);
    console.log("Cleared periodic table check interval");
}, 30000);

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

// Function to check if the current page is enabled
function checkIfPageEnabled() {
    try {
        // Extract base URL without query parameters
        const url = new URL(window.location.href);
        const baseUrl = url.origin + url.pathname;
        console.log("Checking if page is enabled:", baseUrl);
        
        // Get the list of enabled URLs
        chrome.storage.local.get(['enabledUrls', 'bankroll', 'kellyMultiplier'], function(result) {
            console.log("Storage data retrieved:", result);
            const enabledUrls = result.enabledUrls || [];
            
            // Check if current URL is in the enabled list and is enabled
            const currentUrlInfo = enabledUrls.find(item => item.url === baseUrl);
            console.log("Current URL info:", currentUrlInfo);
            
            if (currentUrlInfo && currentUrlInfo.enabled) {
                console.log("Page is enabled, running calculations automatically");
                // Get bankroll and kellyMultiplier from storage
                const bankroll = result.bankroll || 4000;
                const kellyMultiplier = result.kellyMultiplier || 1;
                console.log("Using bankroll:", bankroll, "and Kelly multiplier:", kellyMultiplier);
                
                // Check if the table exists before running calculations
                if (document.querySelector('table')) {
                    console.log("Table found, running calculations");
                    // Add a short delay before running calculations to ensure values are received
                    console.log("Adding short delay before running calculations to ensure values are received");
                    setTimeout(() => {
                        // Run the calculations
                        scrapeAndDisplayBets(bankroll, kellyMultiplier);
                        
                        // Also run the background script's scraper
                        chrome.runtime.sendMessage({action: "runScraper"}, function(response) {
                            console.log("Background script response:", response);
                        });
                    }, 250); // 0.25 second delay
                } else {
                    console.log("Table not found yet, will try again when table is detected");
                }
            } else {
                console.log("Page is not enabled for automatic calculations");
            }
        });
    } catch (error) {
        console.error("Error checking if page is enabled:", error);
    }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    
    if (request.action === "scrapeBets" || request.action === "pageEnabled") {
        // Add a short delay before running calculations to ensure values are received
        setTimeout(() => {
            scrapeAndDisplayBets(request.bankroll, request.kellyMultiplier);
            sendResponse({status: "Calculations started"});
        }, 250); // 0.25 second delay
    }
    
    // Return true to indicate we'll send a response asynchronously
    return true;
});

function scrapeAndDisplayBets(bankroll, kellyMultiplier) {
    console.log('Scraping started with bankroll:', bankroll, 'and multiplier:', kellyMultiplier); // Debug log
    try {
        // Try multiple selectors to find the odds elements
        const selectors = [
            ".text-sm.text-inherit.__className_321157",
            "td:nth-child(6)", // Try direct table cell selector
            "[data-testid='odds-cell']", // Try data attribute
            ".odds-cell" // Try class
        ];
        
        let elements = [];
        
        // Try each selector until we find elements
        for (const selector of selectors) {
            elements = document.querySelectorAll(selector);
            console.log(`Tried selector "${selector}", found ${elements.length} elements`);
            if (elements.length > 0) break;
        }
        
        if (elements.length === 0) {
            console.log("No elements found with any of the selectors");
            
            // As a fallback, try to get all table cells and filter them
            const allCells = document.querySelectorAll('td');
            console.log(`Found ${allCells.length} table cells total`);
            
            // Look for cells that might contain odds (numbers with + or -)
            elements = Array.from(allCells).filter(cell => {
                const text = cell.textContent.trim();
                return /^[+-]?\d+$/.test(text); // Simple regex for odds format
            });
            
            console.log(`After filtering, found ${elements.length} potential odds elements`);
            
            if (elements.length === 0) {
                console.log("Still no elements found, cannot proceed");
                return;
            }
        }
        
        // Directly call the background script to run its scraper
        chrome.runtime.sendMessage({
            action: "runScraper",
            bankroll: bankroll,
            kellyMultiplier: kellyMultiplier
        }, function(response) {
            console.log("Background script response:", response);
        });
        
        // Also try to directly inject the column and update bet sizes
        injectBetSizeColumn();
        
        const bets = [];
        elements.forEach((element, index) => {
            const text = element.textContent.trim();
            if (text) {
                // Try to parse the odds more intelligently
                let odds = 2.0;
                if (/^[+-]?\d+$/.test(text)) {
                    // Convert American odds to decimal
                    const americanOdds = parseInt(text);
                    if (americanOdds > 0) {
                        odds = 1 + (americanOdds / 100);
                    } else if (americanOdds < 0) {
                        odds = 1 + (100 / Math.abs(americanOdds));
                    }
                }
                
                // Function to inject the bet size column
                function injectBetSizeColumn() {
                    const table = document.querySelector('table');
                    if (!table) {
                        console.log("No table found");
                        return;
                    }
                
                    if (document.querySelector('.kelly_size')) {
                        console.log("Kelly column already exists");
                        return;
                    }
                
                    console.log("Injecting Kelly column");
                    
                    const headerRow = table.querySelector('thead tr');
                    if (!headerRow) {
                        console.log("No header row found");
                        return;
                    }
                
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
                    
                    // Try different positions for the header
                    const positions = [6, 5, 4, 3, 2, 1, 0]; // Try different column positions
                    let inserted = false;
                    
                    for (const pos of positions) {
                        if (headerRow.children.length > pos) {
                            headerRow.children[pos].after(newHeader);
                            inserted = true;
                            console.log(`Inserted header after column ${pos}`);
                            break;
                        }
                    }
                    
                    if (!inserted) {
                        headerRow.appendChild(newHeader);
                        console.log("Appended header to the end");
                    }
                
                    const rows = table.querySelectorAll('tbody tr');
                    console.log(`Found ${rows.length} table rows`);
                    
                    rows.forEach((row, rowIndex) => {
                        const newCell = document.createElement('td');
                        newCell.className = `${row.firstElementChild?.className || ''} kelly_size`;
                        newCell.innerHTML = `
                            <div class="flex h-full flex-col justify-center px-4 py-3 min-w-[100px] text-center hover:brightness-110">
                                <p class="text-sm text-inherit kelly-bet-size">Calculating...</p>
                            </div>
                        `;
                        
                        // Try the same position as the header
                        if (inserted && row.children.length > positions[0]) {
                            row.children[positions[0]].after(newCell);
                            console.log(`Inserted cell after column ${positions[0]} in row ${rowIndex}`);
                        } else {
                            row.appendChild(newCell);
                            console.log(`Appended cell to the end of row ${rowIndex}`);
                        }
                    });
                    
                    console.log("Kelly column injection completed");
                    return true;
                }
                
                const probability = 1/odds;
                const kellyFraction = ((odds * probability) - 1) / (odds - 1);
                const betAmount = bankroll * kellyFraction * kellyMultiplier;
                
                bets.push({
                    name: text,
                    odds: odds,
                    betAmount: betAmount
                });
                
                // Try to directly update the bet size in the table
                const betSizeCells = document.querySelectorAll('.kelly-bet-size');
                if (betSizeCells.length > index) {
                    betSizeCells[index].textContent = `$${betAmount.toFixed(2)}`;
                }
            }
        });

        createOverlay(bets);
        console.log('Bets processed:', bets); // Debug log
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

function createOverlay(bets) {
    console.log('Creating overlay...'); // Debug log
    // Remove existing overlay if present
    const existingOverlay = document.querySelector('.kelly-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create new overlay
    const overlay = document.createElement('div');
    overlay.className = 'kelly-overlay';

    // Add header
    const header = document.createElement('div');
    header.className = 'kelly-overlay-header';
    header.textContent = 'Kelly Criterion Bets';
    overlay.appendChild(header);

    bets.forEach(bet => {
        const betElement = document.createElement('div');
        betElement.className = 'kelly-bet';
        betElement.innerHTML = `
            <div class="kelly-amount">$${bet.betAmount.toFixed(2)}</div>
            <div class="kelly-bet-name">${bet.name}</div>
            <div class="kelly-bet-odds">Odds: ${bet.odds}</div>
        `;
        overlay.appendChild(betElement);
    });

    document.body.appendChild(overlay);
    console.log('Overlay created and added to page'); // Debug log
} 
