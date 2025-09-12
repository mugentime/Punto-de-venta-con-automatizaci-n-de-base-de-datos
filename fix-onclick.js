const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
let content = fs.readFileSync(dashboardPath, 'utf8');

console.log('🔧 Fixing onclick handlers in dashboard.html...');

// Replace all onclick with data-service attributes
const onclickMatches = content.match(/onclick="navigateToService\('([^']+)'\)"/g);

if (onclickMatches) {
    console.log('Found onclick handlers to fix:', onclickMatches.length);
    
    onclickMatches.forEach((match, index) => {
        const service = match.match(/onclick="navigateToService\('([^']+)'\)"/)[1];
        console.log(`${index + 1}. Replacing onclick for service: ${service}`);
        content = content.replace(match, `data-service="${service}"`);
    });
    
    // Add event listeners to the JavaScript at the end
    const scriptStart = content.lastIndexOf('// Initialize Magic Navigation when DOM is ready');
    const newEventListeners = `
        // Add event listeners for service cards (CSP-compliant)
        document.addEventListener('DOMContentLoaded', () => {
            // Service card navigation event listeners
            document.querySelectorAll('.service-card[data-service]').forEach(card => {
                card.addEventListener('click', (e) => {
                    const service = card.getAttribute('data-service');
                    if (service) {
                        console.log('🔄 Service card clicked:', service);
                        navigateToService(service);
                    }
                });
                
                // Add hover effect
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-4px)';
                });
                
                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                });
            });
        });
        
        `;
    
    if (scriptStart > -1) {
        content = content.slice(0, scriptStart) + newEventListeners + content.slice(scriptStart);
    }
    
    fs.writeFileSync(dashboardPath, content);
    console.log('✅ Fixed all onclick handlers and added event listeners');
    console.log('📄 Dashboard updated successfully');
} else {
    console.log('⚠️ No onclick handlers found to fix');
}

console.log('🎯 Dashboard onclick fix complete!');
