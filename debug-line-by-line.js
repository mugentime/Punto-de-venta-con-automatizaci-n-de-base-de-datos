const { chromium } = require('playwright');

async function debugLineByLine() {
  console.log('🔍 Line-by-line debugging...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('pageerror', error => {
    console.error('🚨 PAGE ERROR DETAILS:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  });
  
  try {
    await page.goto('http://localhost:3000/online');
    await page.waitForLoadState('networkidle');
    
    // Get the script content and test it line by line
    const scriptAnalysis = await page.evaluate(() => {
      const scriptTags = Array.from(document.querySelectorAll('script'));
      const mainScript = scriptTags.find(script => script.textContent.includes('API_BASE_URL'));
      
      if (!mainScript) return { error: 'No main script found' };
      
      const lines = mainScript.textContent.split('\n');
      const suspiciousLines = [];
      
      // Look for problematic patterns
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmedLine = line.trim();
        
        // Check for await outside async function
        if (trimmedLine.includes('await') && !trimmedLine.includes('async')) {
          // Check if it's in a function declaration
          let isInAsyncFunction = false;
          for (let i = index; i >= Math.max(0, index - 20); i--) {
            const prevLine = lines[i].trim();
            if (prevLine.includes('async function') || prevLine.includes('async (') || prevLine.includes('async function(')) {
              isInAsyncFunction = true;
              break;
            }
            if (prevLine.includes('function') && !prevLine.includes('async')) {
              break; // Found non-async function
            }
          }
          
          if (!isInAsyncFunction) {
            suspiciousLines.push({
              lineNumber: lineNum,
              content: trimmedLine,
              fullLine: line
            });
          }
        }
      });
      
      return {
        totalLines: lines.length,
        suspiciousLines: suspiciousLines,
        hasScript: true
      };
    });
    
    console.log('📄 Script Analysis Result:');
    console.log('Total lines:', scriptAnalysis.totalLines);
    console.log('Suspicious await lines:', scriptAnalysis.suspiciousLines.length);
    
    if (scriptAnalysis.suspiciousLines.length > 0) {
      console.log('🚨 Found suspicious await usage:');
      scriptAnalysis.suspiciousLines.forEach(line => {
        console.log(`  Line ${line.lineNumber}: ${line.content}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await browser.close();
  }
}

debugLineByLine().catch(console.error);
