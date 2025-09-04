const fs = require('fs');

function extractAndTest() {
  console.log('🔧 Extracting JavaScript from HTML...');
  
  const content = fs.readFileSync('conejo_negro_online.html', 'utf8');
  
  // Extract script content
  const scriptMatches = content.match(/<script[^>]*>(.*?)<\/script>/gs);
  const mainScript = scriptMatches.find(script => script.includes('API_BASE_URL'));
  const jsContent = mainScript.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
  
  // Write to a temporary JS file
  fs.writeFileSync('temp-extracted-script.js', jsContent, 'utf8');
  
  console.log('✅ Script extracted to temp-extracted-script.js');
  console.log('📄 Length:', jsContent.length, 'characters');
  
  // Try to parse it with Node.js
  try {
    require('./temp-extracted-script.js');
    console.log('✅ Script executed successfully');
  } catch (error) {
    console.log('❌ Script execution error:');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    
    // Try to get the specific line number
    const errorLine = error.stack.match(/:(\d+):/);
    if (errorLine) {
      const lineNum = parseInt(errorLine[1]);
      const lines = jsContent.split('\n');
      
      console.log(`\n🎯 Error at line ${lineNum}:`);
      console.log('Context:');
      for (let i = Math.max(0, lineNum - 3); i <= Math.min(lines.length - 1, lineNum + 2); i++) {
        const marker = i === lineNum - 1 ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${lines[i]}`);
      }
    }
  }
  
  // Clean up
  try {
    fs.unlinkSync('temp-extracted-script.js');
  } catch (e) {
    // Ignore cleanup errors
  }
}

extractAndTest();
