const fs = require('fs');

function fixAwaitIssue() {
  console.log('🔧 Fixing await issue...');
  
  let content = fs.readFileSync('conejo_negro_online.html', 'utf8');
  
  // Extract script content
  const scriptMatches = content.match(/<script[^>]*>(.*?)<\/script>/gs);
  const mainScript = scriptMatches.find(script => script.includes('API_BASE_URL'));
  const jsContent = mainScript.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
  
  const lines = jsContent.split('\n');
  
  // Find the problematic line (1325)
  const problematicLineIndex = 1324; // 0-based index for line 1325
  const problematicLine = lines[problematicLineIndex];
  
  console.log('🎯 Problematic line 1325:', problematicLine);
  
  // Look for the context to understand the function
  let functionStartIndex = -1;
  let functionName = 'unknown';
  
  for (let i = problematicLineIndex; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.includes('function ') || line.includes(' = function') || line.includes(' = async function')) {
      functionStartIndex = i;
      
      // Extract function name
      if (line.includes('async function')) {
        console.log('✅ Function is already async:', line);
        return; // Already async, problem is elsewhere
      } else if (line.includes('function')) {
        functionName = line.match(/function\\s+(\\w+)/)?.[1] || 'anonymous';
        console.log('❌ Function is NOT async:', line);
        break;
      }
    }
    
    // Check for arrow functions or event handlers
    if (line.includes('=>') || line.includes('addEventListener')) {
      console.log('🔍 Found arrow function or event handler:', line);
      // For event handlers, we need to make them async
      if (line.includes('addEventListener') && !line.includes('async')) {
        console.log('❌ Event handler needs to be async');
        functionStartIndex = i;
        break;
      }
    }
  }
  
  if (functionStartIndex >= 0) {
    console.log('🔧 Need to fix function at line:', functionStartIndex + 1);
    console.log('Function line:', lines[functionStartIndex]);
    
    // Show the context
    console.log('\\n📄 Context:');
    for (let i = Math.max(0, functionStartIndex - 2); i <= Math.min(lines.length - 1, problematicLineIndex + 2); i++) {
      const marker = i === problematicLineIndex ? '>>> ' : (i === functionStartIndex ? '### ' : '    ');
      console.log(`${marker}${i + 1}: ${lines[i]}`);
    }
    
    // Try to fix it
    const originalLine = lines[functionStartIndex];
    let fixedLine = originalLine;
    
    if (originalLine.includes('addEventListener') && !originalLine.includes('async')) {
      // Fix event handler
      fixedLine = originalLine.replace('function(', 'async function(');
    } else if (originalLine.includes('function ') && !originalLine.includes('async')) {
      // Fix regular function
      fixedLine = originalLine.replace('function ', 'async function ');
    }
    
    if (fixedLine !== originalLine) {
      console.log('\\n🔧 Proposed fix:');
      console.log('Original:', originalLine);
      console.log('Fixed:   ', fixedLine);
      
      // Apply the fix to the content
      lines[functionStartIndex] = fixedLine;
      
      const newJsContent = lines.join('\\n');
      const newScript = mainScript.replace(jsContent, newJsContent);
      const newContent = content.replace(mainScript, newScript);
      
      // Write the fixed content
      fs.writeFileSync('conejo_negro_online.html', newContent, 'utf8');
      console.log('✅ Fix applied successfully!');
    } else {
      console.log('❌ Could not determine how to fix this');
    }
  } else {
    console.log('❌ Could not find the function containing the problematic await');
  }
}

fixAwaitIssue();
