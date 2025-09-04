const fs = require('fs');

function findProblemLine() {
  const content = fs.readFileSync('conejo_negro_online.html', 'utf8');
  
  // Extract script content
  const scriptMatches = content.match(/<script[^>]*>(.*?)<\/script>/gs);
  const mainScript = scriptMatches.find(script => script.includes('API_BASE_URL'));
  const jsContent = mainScript.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
  
  const lines = jsContent.split('\n');
  
  // Find line 1325
  console.log('🔍 Looking for line 1325 in script:');
  console.log(`Line 1324: ${lines[1323] || 'N/A'}`);
  console.log(`Line 1325: ${lines[1324] || 'N/A'}`);
  console.log(`Line 1326: ${lines[1325] || 'N/A'}`);
  
  // Also look for the specific content mentioned in the error
  lines.forEach((line, index) => {
    if (line.includes('await apiRequest(`/records/${recordId}/products`,')) {
      console.log(`\n🎯 Found problematic line at script line ${index + 1} (HTML line unknown):`);
      console.log(`${line.trim()}`);
      
      // Look for the function context
      console.log('\n📄 Function context:');
      for (let i = Math.max(0, index - 5); i <= Math.min(lines.length - 1, index + 2); i++) {
        const marker = i === index ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${lines[i]}`);
      }
    }
  });
}

findProblemLine();
