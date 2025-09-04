const fs = require('fs');

function findAllAwaitIssues() {
  console.log('🔍 Finding ALL await issues...');
  
  const content = fs.readFileSync('conejo_negro_online.html', 'utf8');
  
  // Extract script content
  const scriptMatches = content.match(/<script[^>]*>(.*?)<\/script>/gs);
  const mainScript = scriptMatches.find(script => script.includes('API_BASE_URL'));
  const jsContent = mainScript.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
  
  const lines = jsContent.split('\n');
  const awaitIssues = [];
  
  // Find ALL lines with await
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.includes('await')) {
      // Check if it's in an async context
      let isInAsyncFunction = false;
      let functionContext = 'unknown';
      
      // Look backwards for function declaration
      for (let i = index; i >= Math.max(0, index - 50); i--) {
        const prevLine = lines[i].trim();
        
        if (prevLine.includes('async function') || 
            prevLine.includes('async (') || 
            prevLine.includes('addEventListener(') && lines[i+1] && lines[i+1].includes('async') ||
            prevLine.includes(', async function') ||
            prevLine.includes(', async (')) {
          isInAsyncFunction = true;
          functionContext = prevLine.substring(0, 100) + (prevLine.length > 100 ? '...' : '');
          break;
        }
        
        if (prevLine.includes('function ') && !prevLine.includes('async')) {
          functionContext = prevLine.substring(0, 100) + (prevLine.length > 100 ? '...' : '');
          break;
        }
      }
      
      if (!isInAsyncFunction) {
        awaitIssues.push({
          lineNumber: index + 1,
          content: trimmedLine,
          fullLine: line,
          functionContext: functionContext
        });
      }
    }
  });
  
  console.log(`📊 Found ${awaitIssues.length} await issues:`);
  
  awaitIssues.forEach((issue, index) => {
    console.log(`\\n🚨 Issue ${index + 1}:`);
    console.log(`  Line ${issue.lineNumber}: ${issue.content}`);
    console.log(`  Function context: ${issue.functionContext}`);
    
    if (issue.content.includes('apiRequest(`/records/')) {
      console.log(`  ⚠️  This is the main problematic line!`);
    }
  });
  
  // Also check for any duplicate function definitions
  const functionNames = [];
  lines.forEach((line, index) => {
    const match = line.match(/\\s*(async\\s+)?function\\s+(\\w+)/);
    if (match) {
      const functionName = match[2];
      const isAsync = !!match[1];
      const existing = functionNames.find(f => f.name === functionName);
      
      if (existing) {
        console.log(`\\n🔄 DUPLICATE FUNCTION FOUND:`);
        console.log(`  Function "${functionName}" defined at lines ${existing.line} and ${index + 1}`);
        console.log(`  First: ${existing.isAsync ? 'async' : 'non-async'}`);
        console.log(`  Second: ${isAsync ? 'async' : 'non-async'}`);
      } else {
        functionNames.push({
          name: functionName,
          line: index + 1,
          isAsync: isAsync
        });
      }
    }
  });
}

findAllAwaitIssues();
