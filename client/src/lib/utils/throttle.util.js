export function throttle(fn, intervalMs = 300) {
  let lastCall = 0;
  let timeoutId = null;
  let lastArgs = null;

  const throttled = (...args) => {
    const now = Date.now();
    const remaining = intervalMs - (now - lastCall);
    lastArgs = args;

    if (remaining <= 0) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
      return;
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  return throttled;
}