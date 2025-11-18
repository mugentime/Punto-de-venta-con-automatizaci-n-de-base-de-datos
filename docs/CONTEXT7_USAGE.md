# Context7 Integration - CLI Command Verification

## Purpose
Context7 prevents Claude from using incorrect CLI flags by fetching up-to-date documentation BEFORE executing commands.

## Installation ✅
Context7 is installed globally with API key and auto-starts with every Claude instance.

**Configuration:**
- Scope: `user` (global across all projects)
- API Key: Configured for higher rate limits
- Location: `C:\Users\je2al\.claude.json`

## How Context7 Works

### Traditional Workflow (ERROR-PRONE) ❌
```
1. Claude plans: railway logs --tail 50
2. Execute command
3. Error: "unknown option '--tail'"
4. Claude tries: railway logs --limit 20
5. Execute command
6. Error: "unknown option '--limit'"
7. Claude checks: railway logs --help
8. Finally uses: railway logs (correct)

💰 Cost: 3 failed attempts = ~6K tokens wasted
```

### Context7 Workflow (CORRECT FIRST TIME) ✅
```
1. Claude thinks: "Need Railway logs, use context7 first"
2. Query Context7: "Railway CLI logs command flags. use context7"
3. Context7 returns: Available flags: -s, -e, -d, -b, --json
4. Claude uses: railway logs (correct immediately)

💰 Cost: 1 Context7 query = ~1.5K tokens (75% savings)
```

## Usage Pattern

### Before Using ANY CLI Tool:
```javascript
// ❌ OLD WAY (guessing):
railway logs --tail 50

// ✅ NEW WAY (verify first):
"What are the available flags for railway logs? use context7"
// → Context7 fetches docs
// → Returns: -s, -e, -d, -b, --json only
// → Execute: railway logs
```

### Supported CLI Tools
Context7 can verify documentation for:
- **Railway CLI** - deployment platform commands
- **Docker** - container management
- **GitHub CLI (gh)** - repository operations
- **npm/pnpm/yarn** - package managers
- **git** - version control
- **kubectl** - Kubernetes
- **aws-cli** - AWS services
- **Any other CLI with online documentation**

## Examples

### Example 1: Railway Logs
```bash
# Query Context7 first
"Railway CLI logs command syntax and available flags. use context7"

# Context7 Response:
# railway logs [DEPLOYMENT_ID]
# Flags: -s, -e, -d, -b, --json
# No --tail or --limit flags exist

# Correct usage:
railway logs
```

### Example 2: Docker Container Logs
```bash
# Query Context7 first
"Docker logs command syntax and flags. use context7"

# Context7 Resp:
# docker logs [OPTIONS] CONTAINER
# Available: --tail, --follow, --since, --timestamps

# Correct usage:
docker logs --tail 50 container_name
```

### Example 3: GitHub CLI PR Creation
```bash
# Query Context7 first
"GitHub CLI create pull request command syntax. use context7"

# Context7 returns current flags
# Execute with verified syntax
```

## When to Use Context7

**ALWAYS use Context7 when:**
1. Using a CLI tool for the first time in a session
2. Unsure about available flags/options
3. Documentation might have changed
4. Using a tool you haven't used recently

**Skip Context7 when:**
1. Using basic read-only tools (ls, cat, pwd)
2. You just verified the command in the same session
3. It's a simple, well-known command with no flags

## Integration with Claude Code

Context7 is integrated as an MCP (Model Context Protocol) server, meaning:
- ✅ Auto-starts with every Claude instance
- ✅ Available in all projects
- ✅ No manual activation needed
- ✅ Just add "use context7" to your query

## Best Practices

### 1. Query Context7 Before Complex Commands
```bash
# Before: railway deploy --environment production --verbose
# Query: "Railway deploy command syntax and available flags. use context7"
```

### 2. Cache Results Mentally
If you verify Railway logs has no --tail flag, remember that for the session.

### 3. Verify After Major Updates
If a CLI tool releases a major version, re-query Context7.

### 4. Use Specific Queries
```bash
# ❌ Vague: "Railway commands. use context7"
# ✅ Specific: "Railway logs command available flags. use context7"
```

## Cost Savings Analysis

**Without Context7:**
- Average failed attempts per unknown command: 2-3
- Tokens per failed attempt: ~2K
- Total waste: 4-6K tokens per mistake

**With Context7:**
- Context7 query cost: ~500 tokens
- Correct execution: ~1K tokens
- Total: ~1.5K tokens
- **Savings: 60-75% reduction in wasted tokens**

**Over 100 CLI commands:**
- Without: 400-600K tokens wasted
- With Context7: 150K tokens used
- **Net savings: 250-450K tokens**

## Troubleshooting

### Context7 Not Responding
```bash
# Check MCP server status
claude mcp list

# Should show:
# context7: npx -y @upstash/context7-mcp --api-key ctx7sk-... - ✓ Connected
```

### Need to Update API Key
```bash
# Remove old config
claude mcp remove context7

# Add with new key
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp --api-key NEW_KEY
```

### Context7 Rate Limited
If you hit rate limits (free tier):
- Get API key from: https://context7.com/dashboard
- Already configured with your key: `ctx7sk-1b2da6c3-6226-4664-bfb9-5739e303c00b`

## Summary

✅ **Context7 is installed and ready**
✅ **Auto-starts with every Claude instance**
✅ **Saves 60-75% of tokens on CLI commands**
✅ **Prevents embarrassing error-retry loops**
✅ **Use "use context7" before unfamiliar CLI commands**

**Remember:** The few seconds to query Context7 saves minutes of debugging and hundreds of tokens.
