const { chromium } = require('playwright');

async function detectSpecificErrors() {
  console.log('🔍 Debugging specific await errors...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture specific error with stack trace
  page.on('pageerror', error => {
    console.error('🚨 DETAILED PAGE ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Name:', error.name);
    
    // Try to extract line number
    const stackLines = error.stack.split('\n');
    stackLines.forEach((line, index) => {
      if (line.includes('await')) {
        console.error(`🎯 LINE ${index}: ${line.trim()}`);
      }
    });
  });
  
  // Capture console errors with detailed info
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`🔴 CONSOLE ERROR: ${msg.text()}`);
      console.error('Location:', msg.location());
    }
  });
  
  try {
    await page.goto('http://localhost:3000/online');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Check if main JavaScript block is executing
    const result = await page.evaluate(() => {
      // Try to find the script tag and check its content
      const scriptTags = Array.from(document.querySelectorAll('script'));
      const mainScript = scriptTags.find(script => script.textContent.includes('API_BASE_URL'));
      
      return {
        hasMainScript: !!mainScript,
        scriptCount: scriptTags.length,
        apiBaseUrlFound: mainScript ? mainScript.textContent.includes('API_BASE_URL') : false,
        firstLines: mainScript ? mainScript.textContent.substring(0, 500) : 'No main script found'
      };
    });
    
    console.log('📄 Script Analysis:', result);
    
    // Wait for any remaining JavaScript to execute
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('💥 Error during debugging:', error);
  } finally {
    await browser.close();
  }
}

detectSpecificErrors().catch(console.error);
