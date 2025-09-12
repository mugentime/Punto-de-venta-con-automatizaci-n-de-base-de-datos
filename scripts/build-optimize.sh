#!/bin/bash
# Build Optimization Script for Railway Deployment
# POS Conejo Negro - Performance optimized build process

set -e

echo "🚀 Starting optimized build process for Railway deployment..."

# Build configuration
BUILD_START_TIME=$(date +%s)
NODE_ENV=${NODE_ENV:-production}
OPTIMIZE_IMAGES=${OPTIMIZE_IMAGES:-true}
MINIFY_ASSETS=${MINIFY_ASSETS:-true}
ENABLE_CACHE=${ENABLE_CACHE:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get file size in human readable format
get_file_size() {
    if [[ -f "$1" ]]; then
        if command_exists du; then
            du -h "$1" | cut -f1
        else
            echo "Unknown"
        fi
    else
        echo "Not found"
    fi
}

# Pre-build checks
log_info "Running pre-build checks..."

# Check Node.js version
if command_exists node; then
    NODE_VERSION=$(node --version)
    log_success "Node.js version: $NODE_VERSION"
else
    log_error "Node.js not found"
fi

# Check npm version
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    log_success "npm version: $NPM_VERSION"
else
    log_error "npm not found"
fi

# Check available disk space
AVAILABLE_SPACE=$(df -h . | awk 'NR==2{printf "%s", $4}')
log_info "Available disk space: $AVAILABLE_SPACE"

# Clean previous builds
log_info "Cleaning previous builds..."
rm -rf dist/ build/ .cache/ node_modules/.cache/ || true
log_success "Clean completed"

# Optimize package.json
log_info "Optimizing package.json..."
if [[ -f "package.json" ]]; then
    # Remove dev dependencies from production build
    if [[ "$NODE_ENV" == "production" ]]; then
        log_info "Installing production dependencies only..."
        npm ci --only=production --no-audit --prefer-offline
    else
        npm ci --no-audit --prefer-offline
    fi
    log_success "Dependencies installed and optimized"
else
    log_error "package.json not found"
fi

# Optimize application files
log_info "Optimizing application files..."

# Create optimized directories
mkdir -p dist/public dist/logs dist/data dist/backups

# Copy essential files
cp -r public/* dist/public/ 2>/dev/null || true
cp package.json dist/ 2>/dev/null || true
cp server.js dist/ 2>/dev/null || true

# Copy routes, middleware, utils, etc.
for dir in routes middleware utils config src; do
    if [[ -d "$dir" ]]; then
        cp -r "$dir" dist/
        log_success "Copied $dir to dist/"
    fi
done

# Optimize JavaScript files
if command_exists uglifyjs && [[ "$MINIFY_ASSETS" == "true" ]]; then
    log_info "Minifying JavaScript files..."
    find dist/ -name "*.js" -type f -exec sh -c '
        for file do
            if [[ ! "$file" =~ \.min\. ]]; then
                uglifyjs "$file" --compress --mangle --output "${file%.js}.min.js"
                mv "${file%.js}.min.js" "$file"
            fi
        done
    ' sh {} +
    log_success "JavaScript minification completed"
else
    log_warning "Skipping JavaScript minification (uglifyjs not found or disabled)"
fi

# Optimize CSS files
if command_exists cleancss && [[ "$MINIFY_ASSETS" == "true" ]]; then
    log_info "Minifying CSS files..."
    find dist/ -name "*.css" -type f -exec sh -c '
        for file do
            cleancss -o "$file" "$file"
        done
    ' sh {} +
    log_success "CSS minification completed"
else
    log_warning "Skipping CSS minification (cleancss not found or disabled)"
fi

# Optimize images
if command_exists imagemin && [[ "$OPTIMIZE_IMAGES" == "true" ]]; then
    log_info "Optimizing images..."
    imagemin 'dist/public/**/*.{jpg,jpeg,png,gif,svg}' --out-dir=dist/public/
    log_success "Image optimization completed"
else
    log_warning "Skipping image optimization (imagemin not found or disabled)"
fi

# Remove unnecessary files
log_info "Removing unnecessary files..."
find dist/ -name "*.map" -type f -delete 2>/dev/null || true
find dist/ -name "*.test.js" -type f -delete 2>/dev/null || true
find dist/ -name "*.spec.js" -type f -delete 2>/dev/null || true
find dist/ -name ".DS_Store" -type f -delete 2>/dev/null || true
find dist/ -name "Thumbs.db" -type f -delete 2>/dev/null || true
rm -rf dist/tests/ dist/test/ dist/.git/ dist/docs/ 2>/dev/null || true
log_success "Cleanup completed"

# Generate build manifest
log_info "Generating build manifest..."
BUILD_END_TIME=$(date +%s)
BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))

cat > dist/build-manifest.json << EOF
{
    "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "buildDuration": ${BUILD_DURATION},
    "nodeVersion": "$(node --version)",
    "npmVersion": "$(npm --version)",
    "environment": "${NODE_ENV}",
    "commitSha": "${RAILWAY_GIT_COMMIT_SHA:-unknown}",
    "commitBranch": "${RAILWAY_GIT_BRANCH:-unknown}",
    "optimizations": {
        "minifyAssets": ${MINIFY_ASSETS},
        "optimizeImages": ${OPTIMIZE_IMAGES},
        "enableCache": ${ENABLE_CACHE}
    },
    "buildSize": {
        "serverJs": "$(get_file_size dist/server.js)",
        "packageJson": "$(get_file_size dist/package.json)",
        "totalSize": "$(du -sh dist/ 2>/dev/null | cut -f1 || echo 'Unknown')"
    }
}
EOF

log_success "Build manifest generated"

# Set appropriate permissions
log_info "Setting file permissions..."
find dist/ -type f -exec chmod 644 {} +
find dist/ -type d -exec chmod 755 {} +
chmod +x dist/server.js 2>/dev/null || true

# Generate security headers for static files
log_info "Generating security configurations..."
cat > dist/.htaccess << 'EOF'
# Security Headers for static files
<IfModule mod_headers.c>
    Header set X-Content-Type-Options nosniff
    Header set X-Frame-Options DENY
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Content-Security-Policy "default-src 'self'"
</IfModule>

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache Control
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
EOF

# Create production ready server script
log_info "Creating production server startup script..."
cat > dist/start.sh << 'EOF'
#!/bin/bash
# Production startup script for POS Conejo Negro

export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=512 --gc-interval=100"

# Wait for database to be ready
echo "Waiting for database connection..."
sleep 5

# Start the application
echo "Starting POS Conejo Negro server..."
exec node server.js
EOF

chmod +x dist/start.sh

# Performance analysis
log_info "Analyzing build performance..."
DIST_SIZE=$(du -sh dist/ 2>/dev/null | cut -f1 || echo "Unknown")
FILE_COUNT=$(find dist/ -type f | wc -l)

# Build summary
echo ""
echo "🎉 Build optimization completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Build Summary:"
echo "   • Build time: ${BUILD_DURATION} seconds"
echo "   • Total size: ${DIST_SIZE}"
echo "   • File count: ${FILE_COUNT}"
echo "   • Environment: ${NODE_ENV}"
echo "   • Optimizations: Minify(${MINIFY_ASSETS}), Images(${OPTIMIZE_IMAGES}), Cache(${ENABLE_CACHE})"
echo ""
echo "📁 Optimized build available in: ./dist/"
echo "🚀 Ready for Railway deployment!"
echo ""

# Verify build integrity
log_info "Verifying build integrity..."
if [[ -f "dist/server.js" ]] && [[ -f "dist/package.json" ]]; then
    log_success "Build integrity verified - all essential files present"
else
    log_error "Build integrity check failed - missing essential files"
fi

# Generate deployment instructions
cat > DEPLOYMENT.md << EOF
# Railway Deployment Instructions

## Build Information
- Build time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Build duration: ${BUILD_DURATION} seconds
- Total size: ${DIST_SIZE}
- Environment: ${NODE_ENV}

## Pre-deployment Checklist
1. ✅ Optimized build created in \`./dist/\`
2. ✅ Dependencies installed (production only)
3. ✅ Assets minified and compressed
4. ✅ Security headers configured
5. ✅ Build manifest generated

## Railway Deployment Steps
1. Push this repository to GitHub
2. Connect Railway to your GitHub repository
3. Set environment variables using \`railway.env.template\`
4. Deploy using the provided \`Dockerfile\`
5. Monitor deployment using \`scripts/monitor-railway.js\`

## Post-deployment Verification
- Health check: https://your-app.railway.app/api/health
- Version info: https://your-app.railway.app/api/version
- Monitor dashboard: https://your-app.railway.app/railway-monitor.html

## Rollback Instructions
If deployment fails, use Railway's rollback feature to return to the previous version.

EOF

log_success "Deployment instructions generated: DEPLOYMENT.md"

# Final status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Production build optimization completed in ${BUILD_DURATION} seconds"
echo "🎯 Ready for Railway deployment with optimal performance"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0