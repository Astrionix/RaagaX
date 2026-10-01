// Preload script for Google / YouTube auth window to sanitize environment
try {
  delete window.chrome;
} catch (_) {}

try {
  if (navigator.userAgentData) {
    Object.defineProperty(navigator, "userAgentData", {
      get: () => undefined,
      configurable: true,
    });
  }
} catch (_) {}

try {
  Object.defineProperty(navigator, "webdriver", {
    get: () => false,
    configurable: true,
  });
} catch (_) {}
