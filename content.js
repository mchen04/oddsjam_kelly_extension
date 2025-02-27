// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapeBets") {
        scrapeAndDisplayBets(request.bankroll, request.kellyMultiplier);
    }
});

function scrapeAndDisplayBets(bankroll, kellyMultiplier) {
    console.log('Scraping started...'); // Debug log
    try {
        const targetClass = "text-sm text-inherit __className_321157";
        const elements = document.querySelectorAll(`.${targetClass.split(' ').join('.')}`);
        
        if (elements.length === 0) {
            console.log("No elements found with the specified class");
            return;
        }
        
        const bets = [];
        elements.forEach((element, index) => {
            const text = element.textContent.trim();
            if (text) {
                const odds = 2.0; // Replace with actual odds calculation
                const probability = 1/odds;
                const kellyFraction = ((odds * probability) - 1) / (odds - 1);
                const betAmount = bankroll * kellyFraction * kellyMultiplier;
                
                bets.push({
                    name: text,
                    odds: odds,
                    betAmount: betAmount
                });
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