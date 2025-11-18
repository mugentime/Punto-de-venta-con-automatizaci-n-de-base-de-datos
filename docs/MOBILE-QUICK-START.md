# 📱 Mobile Development Quick Start Guide

> **Quick reference for developers working on mobile features for Conejo Negro POS**

## 🚀 Getting Started in 5 Minutes

### 1. Essential Mobile Classes

```tsx
// Touch-friendly button (minimum 44x44px)
<button className="min-w-[44px] min-h-[44px] touch-manipulation">
  Click Me
</button>

// Mobile-optimized input (prevents iOS zoom)
<input
  type="text"
  style={{ fontSize: '16px' }}
  className="text-base"
/>

// Responsive padding with safe areas
<div className="p-2 sm:p-4 md:p-6 safe-bottom">
  Content
</div>

// Stack on mobile, row on desktop
<div className="flex flex-col lg:flex-row gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

## 📐 Responsive Breakpoints

| Device | Width | Prefix | Example |
|--------|-------|--------|---------|
| Phone | < 640px | Default | `p-2` |
| Tablet | ≥ 640px | `sm:` | `sm:p-4` |
| Desktop | ≥ 1024px | `lg:` | `lg:p-6` |

```tsx
// Mobile: 1 column, Tablet: 2 columns, Desktop: 4 columns
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

---

## 🎯 Touch Targets

**Rule:** All interactive elements must be at least **44x44px**.

```tsx
// ✅ CORRECT
<button className="min-w-[44px] min-h-[44px] p-3">
  <Icon />
</button>

// ❌ WRONG
<button className="p-1">
  <Icon />  {/* Too small on mobile */}
</button>
```

---

## ⌨️ Mobile Keyboards

Use `inputMode` to show the right keyboard:

```tsx
// Numeric keyboard (0-9)
<input type="number" inputMode="numeric" pattern="[0-9]*" />

// Phone keyboard
<input type="tel" inputMode="tel" />

// Email keyboard (@ key)
<input type="email" inputMode="email" />

// Search keyboard (Search button)
<input type="text" inputMode="search" />
```

---

## 🎨 Animations

```tsx
// Screen transitions
<div className="animate-slide-in-up">Modal</div>

// Success feedback
<div className="animate-bounce-in">Success!</div>

// Error feedback
<div className="animate-shake">Error!</div>

// Loading state
<div className="animate-pulse-subtle">Loading...</div>
```

---

## 📱 Safe Areas (Notches)

```tsx
// Bottom navigation with safe area
<nav
  className="fixed bottom-0 left-0 right-0"
  style={{
    paddingBottom: 'env(safe-area-inset-bottom)'
  }}
>
  Navigation
</nav>

// Or use utility class
<nav className="fixed bottom-0 safe-bottom">
  Navigation
</nav>
```

---

## 🔄 Loading States

```tsx
// Lazy load screens
const SalesScreen = lazy(() => import('./screens/SalesScreen'));

<Suspense fallback={<LoadingSpinner />}>
  <SalesScreen />
</Suspense>

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
);
```

---

## ♿ Accessibility Essentials

```tsx
// Icon-only button needs label
<button aria-label="Add to cart">
  <PlusIcon />
</button>

// Form label association
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Current page indicator
<button aria-current={isActive ? 'page' : undefined}>
  Home
</button>

// Loading state announcement
<div role="status" aria-live="polite">
  Loading products...
</div>

// Error announcement
<div role="alert" aria-live="assertive">
  Error occurred
</div>
```

---

## 🎭 Common Patterns

### Modal

```tsx
<div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
  {/* Backdrop */}
  <div
    className="fixed inset-0 bg-black/50 backdrop-blur-sm"
    onClick={onClose}
  />

  {/* Modal content */}
  <div className="
    relative z-10
    bg-white rounded-t-3xl lg:rounded-3xl
    w-full lg:max-w-2xl
    max-h-[90vh] overflow-y-auto
    p-6 safe-bottom
    animate-slide-in-up
  ">
    {children}
  </div>
</div>
```

### Bottom Sheet

```tsx
<div className="
  fixed bottom-0 left-0 right-0
  bg-white rounded-t-3xl shadow-2xl
  max-h-[80vh] overflow-y-auto
  p-6 safe-bottom
  animate-slide-in-up
  z-50
">
  {content}
</div>
```

### Toast Notification

```tsx
<div className="
  fixed top-4 right-4 left-4
  sm:left-auto sm:w-96
  z-60 safe-top
  animate-slide-in-down
">
  <div className="bg-white rounded-xl shadow-lg p-4">
    {message}
  </div>
</div>
```

### Product Grid

```tsx
<div className="
  grid
  grid-cols-2
  sm:grid-cols-3
  lg:grid-cols-4
  xl:grid-cols-5
  gap-2 sm:gap-3 md:gap-4
">
  {products.map(product => (
    <ProductCard key={product.id} {...product} />
  ))}
</div>
```

---

## 🚨 Common Mistakes to Avoid

### ❌ WRONG

```tsx
// Touch target too small
<button className="p-1">
  <Icon className="w-4 h-4" />
</button>

// Input zooms on iOS
<input type="text" className="text-sm" />

// Missing ARIA label
<button>
  <TrashIcon />
</button>

// Hard-coded spacing (no safe areas)
<nav className="fixed bottom-0 pb-4">

// Non-responsive layout
<div className="flex gap-4">
  <div className="w-[300px]">Fixed width</div>
</div>
```

### ✅ CORRECT

```tsx
// Proper touch target
<button className="min-w-[44px] min-h-[44px] p-3 touch-manipulation">
  <Icon className="w-6 h-6" />
</button>

// No zoom on iOS
<input
  type="text"
  className="text-base"
  style={{ fontSize: '16px' }}
/>

// Accessible button
<button aria-label="Delete product">
  <TrashIcon />
</button>

// Safe area support
<nav
  className="fixed bottom-0"
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>

// Responsive layout
<div className="flex flex-col lg:flex-row gap-4">
  <div className="w-full lg:w-1/3">Responsive</div>
</div>
```

---

## 🎨 Mobile-First CSS Classes Reference

### Touch & Interaction
- `touch-target` - 44x44px minimum
- `touch-target-lg` - 48x48px comfortable
- `touch-feedback` - Visual press effect
- `touch-manipulation` - Disable double-tap zoom

### Safe Areas
- `safe-top` - Top notch padding
- `safe-bottom` - Bottom home indicator padding
- `safe-x` - Left & right padding
- `safe-all` - All sides padding

### Mobile Utilities
- `mobile:p-compact` - Compact padding on mobile
- `mobile:btn-full` - Full width button
- `mobile:stack` - Stack vertically
- `mobile:hidden` - Hide on mobile

### Scrolling
- `scroll-smooth-mobile` - iOS momentum scrolling
- `scrollbar-hidden` - Hide scrollbar
- `scrollbar-thin` - 4px thin scrollbar
- `overscroll-contain` - Prevent bounce

### Animations
- `animate-slide-in-*` - Slide transitions
- `animate-fade-*` - Fade in/out
- `animate-scale-*` - Scale in/out
- `animate-bounce-in` - Success bounce
- `animate-shake` - Error shake

### Performance
- `gpu-accelerated` - Hardware acceleration
- `optimize-rendering` - 3D optimization

---

## 📋 Pre-Commit Checklist

Before committing mobile features:

```
✅ All buttons are 44x44px minimum
✅ Inputs have fontSize: '16px' (prevent iOS zoom)
✅ Proper inputMode for mobile keyboards
✅ ARIA labels on icon-only buttons
✅ Safe area insets for bottom navigation
✅ Tested on mobile emulator (Chrome DevTools)
✅ Tested portrait and landscape
✅ Animation respects prefers-reduced-motion
✅ Touch feedback visible on tap
✅ No horizontal scroll on mobile
```

---

## 🧪 Quick Testing

### Chrome DevTools

```
1. Open DevTools (F12)
2. Click device icon (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or "Galaxy S21"
4. Test in both portrait and landscape
5. Check touch targets (blue boxes in DevTools)
```

### Test Orientation

```tsx
// Force landscape in DevTools
// Settings → Sensors → Orientation → Custom (90)

// Force portrait
// Settings → Sensors → Orientation → Portrait
```

---

## 📚 More Resources

- **Full Documentation:** [MOBILE-OPTIMIZATION.md](./MOBILE-OPTIMIZATION.md)
- **Tailwind Docs:** https://tailwindcss.com/docs
- **React Docs:** https://react.dev/
- **MDN Mobile:** https://developer.mozilla.org/en-US/docs/Web/Guide/Mobile

---

## 💡 Pro Tips

1. **Always test on real devices** when possible
2. **Use Chrome DevTools device emulation** for quick testing
3. **Check Lighthouse scores** (aim for 90+ on mobile)
4. **Test with slow 3G network** to catch performance issues
5. **Enable "Show paint rectangles"** in DevTools to find layout thrashing
6. **Use React DevTools Profiler** to find slow re-renders

---

## 🤝 Need Help?

- Check [MOBILE-OPTIMIZATION.md](./MOBILE-OPTIMIZATION.md) for detailed docs
- Search codebase for examples: `grep -r "min-w-\[44px\]"`
- Ask team in #mobile-development channel

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
