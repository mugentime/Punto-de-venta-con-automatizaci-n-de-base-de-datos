/**
 * Simple Mobile Menu Toggle for Conejo Negro POS
 * Works with existing HTML structure
 */

function toggleMobileNav() {
  const nav = document.querySelector('nav');
  const body = document.body;
  const hamburger = document.querySelector('.hamburger-menu');
  
  if (!nav) return;
  
  // Toggle navigation visibility
  if (nav.classList.contains('mobile-nav-active')) {
    // Close menu
    nav.classList.remove('mobile-nav-active');
    body.classList.remove('mobile-nav-open');
    if (hamburger) {
      hamburger.innerHTML = '<i class="fas fa-bars"></i>';
    }
    
    // Re-enable body scroll
    body.style.overflow = '';
  } else {
    // Open menu
    nav.classList.add('mobile-nav-active');
    body.classList.add('mobile-nav-open');
    if (hamburger) {
      hamburger.innerHTML = '<i class="fas fa-times"></i>';
    }
    
    // Prevent body scroll on mobile when menu is open
    if (window.innerWidth <= 768) {
      body.style.overflow = 'hidden';
    }
  }
}

// Close menu when clicking on overlay
document.addEventListener('click', function(e) {
  const nav = document.querySelector('nav');
  const hamburger = document.querySelector('.hamburger-menu');
  
  if (!nav || !nav.classList.contains('mobile-nav-active')) return;
  
  // Close if clicking outside the menu and hamburger
  if (!nav.contains(e.target) && !hamburger.contains(e.target)) {
    toggleMobileNav();
  }
});

// Close menu on escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const nav = document.querySelector('nav');
    if (nav && nav.classList.contains('mobile-nav-active')) {
      toggleMobileNav();
    }
  }
});

// Close menu when resizing to desktop
window.addEventListener('resize', function() {
  if (window.innerWidth > 768) {
    const nav = document.querySelector('nav');
    const body = document.body;
    const hamburger = document.querySelector('.hamburger-menu');
    
    if (nav && nav.classList.contains('mobile-nav-active')) {
      nav.classList.remove('mobile-nav-active');
      body.classList.remove('mobile-nav-open');
      body.style.overflow = '';
      if (hamburger) {
        hamburger.innerHTML = '<i class="fas fa-bars"></i>';
      }
    }
  }
});

// Handle navigation item clicks
document.addEventListener('click', function(e) {
  if (e.target.matches('.nav-link, .nav-link *')) {
    // Close mobile menu when navigation link is clicked
    const nav = document.querySelector('nav');
    if (nav && nav.classList.contains('mobile-nav-active') && window.innerWidth <= 768) {
      setTimeout(toggleMobileNav, 150); // Small delay for better UX
    }
  }
});

console.log('Simple mobile menu initialized');