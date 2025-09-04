const fs = require('fs');

function fixLine2883() {
  console.log('🔧 Fixing line 2883...');
  
  let content = fs.readFileSync('conejo_negro_online.html', 'utf8');
  
  // Extract script content
  const scriptMatches = content.match(/<script[^>]*>(.*?)<\/script>/gs);
  const mainScript = scriptMatches.find(script => script.includes('API_BASE_URL'));
  const jsContent = mainScript.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
  
  const lines = jsContent.split('\n');
  
  // Find line 2883
  const problematicLineIndex = 2882; // 0-based index for line 2883
  const problematicLine = lines[problematicLineIndex];
  
  console.log('🎯 Line 2883:', problematicLine);
  
  // Show context around this line
  console.log('\n📄 Context around line 2883:');
  for (let i = Math.max(0, problematicLineIndex - 10); i <= Math.min(lines.length - 1, problematicLineIndex + 5); i++) {
    const marker = i === problematicLineIndex ? '>>> ' : '    ';
    console.log(`${marker}${i + 1}: ${lines[i]}`);
  }
  
  // Look for the function or context that contains this line
  let contextStart = -1;
  let contextType = 'unknown';
  
  for (let i = problematicLineIndex; i >= Math.max(0, problematicLineIndex - 20); i--) {
    const line = lines[i].trim();
    
    if (line.includes('addEventListener') && !line.includes('async')) {
      contextStart = i;
      contextType = 'event handler (needs async)';
      break;
    } else if (line.includes('function') && !line.includes('async')) {
      contextStart = i;
      contextType = 'function (needs async)';
      break;
    } else if (line.includes('async function')) {
      console.log('✅ Already in async function, this should not be an error');
      return;
    } else if (line.includes('try {') || line.includes('if (')) {
      // Look further back
      continue;
    }
  }
  
  if (contextStart >= 0) {
    console.log(`\n🔧 Found context at line ${contextStart + 1} (${contextType}):`, lines[contextStart]);
    
    // Fix the line
    const originalLine = lines[contextStart];
    let fixedLine = originalLine;
    
    if (originalLine.includes('addEventListener') && !originalLine.includes('async')) {
      if (originalLine.includes('function(')) {
        fixedLine = originalLine.replace('function(', 'async function(');
      }
    } else if (originalLine.includes('function ') && !originalLine.includes('async')) {
      fixedLine = originalLine.replace('function ', 'async function ');
    }
    
    if (fixedLine !== originalLine) {
      console.log('\n🔧 Applying fix:');
      console.log('Original:', originalLine);
      console.log('Fixed:   ', fixedLine);
      
      lines[contextStart] = fixedLine;
      
      const newJsContent = lines.join('\n');
      const newScript = mainScript.replace(jsContent, newJsContent);
      const newContent = content.replace(mainScript, newScript);
      
      fs.writeFileSync('conejo_negro_online.html', newContent, 'utf8');
      console.log('✅ Fix applied successfully!');
    } else {
      console.log('❌ Could not determine automatic fix');
      console.log('Manual fix needed: Make the function containing line 2883 async');
    }
  } else {
    console.log('❌ Could not find function context for line 2883');
  }
}

fixLine2883();
