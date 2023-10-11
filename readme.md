# Router6

Env agnostic router

## Installation

```
npm install router6
```

```
yarn add router6
```

## Usage example

```typescript
import Router6 from 'router6';

// create it
const router = new Router6([
  // define routes
  { name: 'home', path: '/' },
  { name: 'terms', path: '/terms' },
  { 
    name: 'blog', 
    path: '/blog', 
    children: [
      { name: 'article', path: '/:slug' },
    ],
  },
  { 
    name: 'about', 
    path: '/about', 
    children: [
      { name: 'section', path: '/:section(me|your|whatever)' }
    ],
    config: { any: 'data' },
  },
]);

// run it
router.start('/').then(() => console.log('router started'));

// attach
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    router.navigateToPath(e.target.pathname);
  } 
});

```
