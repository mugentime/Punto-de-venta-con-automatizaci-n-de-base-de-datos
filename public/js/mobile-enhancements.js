/**
 * Mobile Enhancements for Conejo Negro POS
 * Critical mobile optimizations and PWA features
 */

// Viewport height fix for mobile browsers
function setVHProperty() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh-actual', `${vh}px`);
  document.documentElement.classList.add('js-vh-fix');
}

// Initialize viewport height fix
setVHProperty();
window.addEventListener('resize', setVHProperty);
window.addEventListener('orientationchange', () => {
  setTimeout(setVHProperty, 100); // Delay for orientation change completion
});

// Prevent iOS bounce scrolling
document.addEventListener('touchmove', function(e) {
  if (e.touches.length > 1) return; // Allow pinch zoom
  
  const target = e.target;
  const scrollableParent = target.closest('.scrollable, [data-scrollable]');
  
  if (!scrollableParent) {
    e.preventDefault(); // Prevent bounce on non-scrollable elements
  }
}, { passive: false });

// Optimize touch events for better performance
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', function(e) {
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', function(e) {
  touchEndY = e.changedTouches[0].screenY;
  
  // Handle swipe gestures if needed
  const swipeDistance = touchStartY - touchEndY;
  
  if (Math.abs(swipeDistance) > 50) {
    // Trigger custom swipe events
    const swipeEvent = new CustomEvent(swipeDistance > 0 ? 'swipeup' : 'swipedown', {
      detail: { distance: Math.abs(swipeDistance) }
    });
    e.target.dispatchEvent(swipeEvent);
  }
}, { passive: true });

// Enhance form input experience on mobile
document.addEventListener('DOMContentLoaded', function() {
  const inputs = document.querySelectorAll('input, textarea, select');
  
  inputs.forEach(input => {
    // Add proper input modes for better keyboards
    if (input.type === 'email' && !input.inputMode) {
      input.inputMode = 'email';
    }
    if (input.type === 'tel' && !input.inputMode) {
      input.inputMode = 'tel';
    }
    if (input.type === 'number' && !input.inputMode) {
      input.inputMode = 'numeric';
    }
    if (input.type === 'search' && !input.inputMode) {
      input.inputMode = 'search';
    }
    
    // Prevent zoom on focus for iOS
    if (parseFloat(getComputedStyle(input).fontSize) < 16) {
      input.style.fontSize = '16px';
    }
    
    // Enhanced focus handling
    input.addEventListener('focus', function() {
      this.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add focused class for enhanced styling
      this.classList.add('input-focused');
    });
    
    input.addEventListener('blur', function() {
      this.classList.remove('input-focused');
    });
  });
});

// Performance optimizations
document.addEventListener('DOMContentLoaded', function() {
  // Add js-loaded class for progressive enhancement
  document.documentElement.classList.add('js-loaded');
  
  // Lazy load images
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
  
  // Preload critical resources
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Preload next likely sections
      const criticalSections = ['registro', 'inventario-cafeteria', 'reportes'];
      criticalSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section && !section.classList.contains('preloaded')) {
          section.style.contentVisibility = 'auto';
          section.classList.add('preloaded');
        }
      });
    });
  }
});

// Connection status monitoring
let isOnlineGlobal = navigator.onLine;

function updateConnectionStatus() {
  const statusElement = document.querySelector('.connection-status');
  
  if (statusElement) {
    statusElement.style.background = isOnlineGlobal ? '#00ff00' : '#ff4444';
    statusElement.title = isOnlineGlobal ? 'Conectado' : 'Sin conexión';
  }
  
  // Dispatch custom event for other components
  window.dispatchEvent(new CustomEvent('connectionchange', {
    detail: { online: isOnlineGlobal }
  }));
}

window.addEventListener('online', () => {
  isOnlineGlobal = true;
  updateConnectionStatus();
});

window.addEventListener('offline', () => {
  isOnlineGlobal = false;
  updateConnectionStatus();
});

// Enhanced error handling for mobile
window.addEventListener('error', function(e) {
  if (window.location.hostname !== 'localhost') {
    // Only log errors in production for mobile debugging
    console.error('Mobile Error:', {
      message: e.message,
      source: e.filename,
      line: e.lineno,
      column: e.colno,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }
});

// Memory management for single-page app
function cleanupUnusedElements() {
  // Remove hidden modal backdrops
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    if (!backdrop.closest('.modal.show')) {
      backdrop.remove();
    }
  });
  
  // Clean up temporary elements
  document.querySelectorAll('[data-temp="true"]').forEach(el => el.remove());
  
  // Force garbage collection in development
  if (window.gc && window.location.hostname === 'localhost') {
    window.gc();
  }
}

// Clean up every 5 minutes
setInterval(cleanupUnusedElements, 300000);

// PWA installation prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show custom install button if desired
  const installButton = document.querySelector('.install-app-btn');
  if (installButton) {
    installButton.style.display = 'block';
    installButton.addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('PWA installed');
        }
        deferredPrompt = null;
        installButton.style.display = 'none';
      });
    });
  }
});

// Export for use in other modules
window.MobileEnhancements = {
  setVHProperty,
  updateConnectionStatus,
  cleanupUnusedElements
};

console.log('✅ Mobile enhancements loaded successfully');