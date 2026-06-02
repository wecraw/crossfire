// Global test setup executed before any spec files.
//
// jsdom (the DOM used by the Vitest runner) does not implement a few browser
// APIs that the app touches during component construction / ngOnInit. We
// provide minimal stubs here so component smoke tests can run.

// window.matchMedia — used by GameComponent.setTheme() to detect dark mode.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined, // deprecated
      removeListener: () => undefined, // deprecated
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Element.scrollTo — used by GameComponent.scrollGameToBottom(); jsdom does
// not implement it, and it fires from a setTimeout that can outlive a test.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => undefined;
}

// Ensure each test starts from a clean localStorage so persistence-related
// state never leaks between specs.
beforeEach(() => {
  localStorage.clear();
});
