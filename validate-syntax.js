const fs = require('fs');

function validateSyntax() {
  console.log('🔍 Validating JavaScript syntax...');
  
  try {
    const content = fs.readFileSync('conejo_negro_online.html', 'utf8');
    
    // Extract script content
    const scriptMatches = content.match(/<script[^>]*>(.*?)<\/script>/gs);
    if (!scriptMatches) {
      console.log('❌ No script tags found');
      return;
    }
    
    const mainScript = scriptMatches.find(script => script.includes('API_BASE_URL'));
    if (!mainScript) {
      console.log('❌ No main script found');
      return;
    }
    
    // Extract just the JavaScript content
    const jsContent = mainScript.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
    
    console.log('📄 Script length:', jsContent.length, 'characters');
    
    // Check for balanced braces
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;
    let inString = false;
    let inComment = false;
    let stringChar = '';
    
    const lines = jsContent.split('\n');
    const issues = [];
    
    lines.forEach((line, lineIndex) => {
      const lineNum = lineIndex + 1;
      const trimmedLine = line.trim();
      
      // Check for unmatched async/await patterns
      if (trimmedLine.includes('await') && !trimmedLine.includes('async')) {
        // Look back to see if we're in an async function
        let foundAsync = false;
        let braceDepth = 0;
        
        for (let i = lineIndex; i >= 0; i--) {
          const prevLine = lines[i].trim();
          
          // Count braces to understand scope
          for (const char of prevLine) {
            if (char === '{') braceDepth++;
            if (char === '}') braceDepth--;
          }
          
          // If we've gone up in scope and found function declaration
          if (braceDepth > 0 && (prevLine.includes('function') || prevLine.includes('=>'))) {
            if (prevLine.includes('async')) {
              foundAsync = true;
            }
            break;
          }
        }
        
        if (!foundAsync) {
          issues.push({
            line: lineNum,
            issue: 'await outside async function',
            content: trimmedLine
          });
        }
      }
      
      // Check for syntax issues
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (inComment) {
          if (char === '*' && line[i + 1] === '/') {
            inComment = false;
            i++; // Skip the /
          }
          continue;
        }
        
        if (char === '/' && line[i + 1] === '*') {
          inComment = true;
          i++; // Skip the *
          continue;
        }
        
        if (char === '/' && line[i + 1] === '/') {
          break; // Rest of line is comment
        }
        
        if (!inString) {
          if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
          } else if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount < 0) {
              issues.push({
                line: lineNum,
                issue: 'Extra closing brace',
                content: line
              });
            }
          } else if (char === '(') {
            parenCount++;
          } else if (char === ')') {
            parenCount--;
          } else if (char === '[') {
            bracketCount++;
          } else if (char === ']') {
            bracketCount--;
          }
        } else {
          if (char === stringChar && line[i - 1] !== '\\') {
            inString = false;
            stringChar = '';
          }
        }
      }
    });
    
    console.log('🔍 Syntax Analysis:');
    console.log('Final brace count:', braceCount);
    console.log('Final paren count:', parenCount);
    console.log('Final bracket count:', bracketCount);
    console.log('Issues found:', issues.length);
    
    if (issues.length > 0) {
      console.log('\n🚨 Issues found:');
      issues.slice(0, 10).forEach(issue => {
        console.log(`  Line ${issue.line}: ${issue.issue}`);
        console.log(`    ${issue.content}`);
      });
      
      if (issues.length > 10) {
        console.log(`    ... and ${issues.length - 10} more`);
      }
    }
    
    // Try to parse JavaScript
    try {
      new Function(jsContent);
      console.log('✅ JavaScript parses successfully');
    } catch (parseError) {
      console.log('❌ JavaScript parse error:', parseError.message);
      console.log('Parse error details:', parseError);
    }
    
  } catch (error) {
    console.error('💥 Error validating syntax:', error);
  }
}

validateSyntax();
