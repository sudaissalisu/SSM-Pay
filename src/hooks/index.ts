/**
 * Enterprise Custom React Hooks
 * Collection of reusable React hooks for SSM Pay application
 * 
 * @module hooks/index
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';

// ============== Type Definitions ==============

interface UseDebounceOptions<T> {
  value: T;
  delay?: number;
  onChange?: (value: T) => void;
}

interface UseThrottleOptions {
  delay?: number;
  leading?: boolean;
  trailing?: boolean;
}

interface UseLocalStorageOptions<T> {
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T | null;
}

interface UseAsyncState<T> {
  data?: T;
  loading: boolean;
  error?: Error;
}

interface UseAsyncOptions {
  immediate?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
}

// ============== useDebounce Hook ==============

/**
 * Debounce value changes
 * @example
 * ```tsx
 * const [debouncedValue] = useDebounce(searchTerm, 300);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============== useThrottle Hook ==============

/**
 * Throttle function calls
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const lastRun = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRun.current >= delay) {
      lastRun.current = now;
      return callback(...args);
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      lastRun.current = Date.now();
      callback(...args);
    }, delay - (now - lastRun.current));
  }, [callback, delay]) as unknown as T;
}

// ============== useLocalStorage Hook ==============

/**
 * Persist state in localStorage
 * @example
 * ```tsx
 * const [theme, setTheme] = useLocalStorage('theme', 'dark');
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(defaultValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue, removeValue];
}

// ============== useSessionStorage Hook ==============

/**
 * Persist state in sessionStorage (cleared on tab close)
 */
export function useSessionStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T) => {
    try {
      setStoredValue(value);
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error setting sessionStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}

// ============== useAsync Hook ==============

/**
 * Handle async operations with loading/error states
 * @example
 * ```tsx
 * const { data, loading, error, execute } = useAsync(fetchUser);
 * await execute(userId);
 * ```
 */
export function useAsync<T, P extends any[] = []>(
  asyncFunction: (...args: P) => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: undefined,
    loading: options.immediate ?? false,
    error: undefined,
  });

  const execute = useCallback(async (...args: P) => {
    setState({ data: undefined, loading: true, error: undefined });

    try {
      const data = await asyncFunction(...args);
      setState({ data, loading: false, error: undefined });
      options.onSuccess?.(data as any);
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState({ data: undefined, loading: false, error: err });
      options.onError?.(err);
      throw err;
    }
  }, [asyncFunction]);

  // Execute immediately if configured
  useEffect(() => {
    if (options.immediate) {
      execute(...([] as unknown as P));
    }
  }, []);

  return {
    ...state,
    execute,
    reset: () => setState({ data: undefined, loading: false, error: undefined }),
  };
}

// ============== useToggle Hook ==============

/**
 * Simple toggle hook with additional utilities
 */
export function useToggle(initialValue: boolean = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return {
    value,
    setValue,
    toggle,
    setTrue,
    setFalse,
  };
}

// ============== useClickOutside Hook ==============

/**
 * Detect clicks outside an element
 */
export function useClickOutside(
  handler: () => void,
  ignoreElements?: HTMLElement[]
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;

      // Check if click is on ignored element
      if (ignoreElements?.some(el => el.contains(event.target as Node))) return;

      handler();
    };

    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [handler, ignoreElements]);

  return ref;
}

// ============== useKeyPress Hook ==============

/**
 * Detect keyboard key presses
 */
export function useKeyPress(
  targetKey: string,
  handler?: () => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMatch = event.key === targetKey || event.code === targetKey;
      const ctrlMatch = !options.ctrl || event.ctrlKey || event.metaKey;
      const shiftMatch = !options.shift || event.shiftKey;
      const altMatch = !options.alt || event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        handler?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [targetKey, handler, options]);
}

// ============== useInterval Hook ==============

/**
 * Set up interval that cleans up on unmount
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ============== useTimeout Hook ==============

/**
 * Set up timeout that can be reset
 */
export function useTimeout(callback: () => void, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, delay);
  }, [callback, delay]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    reset();
    return clear;
  }, [reset, clear]);
}

// ============== usePrevious Hook ==============

/**
 * Get previous value of a variable
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  const prevValue = ref.current;

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return prevValue;
}

// ============== useFirstRender Hook ==============

/**
 * Check if this is the first render
 */
export function useFirstRender(): boolean {
  const isFirst = useRef(true);

  if (isFirst.current) {
    isFirst.current = false;
    return true;
  }

  return false;
}

// ============== useMounted Hook ==============

/**
 * Track component mount status
 */
export function useMounted(): boolean {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  return isMounted;
}

// ============== useMediaQuery Hook ==============

/**
 * Responsive media query hook
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ============== Breakpoint Hooks ==============

/** Mobile breakpoint (max-width: 640px) */
export function useIsMobile() {
  return useMediaQuery('(max-width: 640px)');
}

/** Tablet breakpoint (min-width: 641px, max-width: 1024px) */
export function useIsTablet() {
  return useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
}

/** Desktop breakpoint (min-width: 1025px) */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1025px)');
}

/** Reduced motion preference */
export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// ============== useWindowSize Hook ==============

/**
 * Track window dimensions
 */
export function useWindowSize() {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// ============== useScrollPosition Hook ==============

/**
 * Track scroll position
 */
export function useScrollPosition() {
  const [scroll, setScroll] = useState({
    x: 0,
    y: 0,
    direction: 'none' as 'up' | 'down' | 'left' | 'right' | null,
  });

  const prevScroll = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => {
      const x = window.scrollX || document.documentElement.scrollLeft;
      const y = window.scrollY || document.documentElement.scrollTop;

      let direction: 'up' | 'down' | 'left' | 'right' | null = null;

      if (y > prevScroll.current.y) direction = 'down';
      else if (y < prevScroll.current.y) direction = 'up';
      else if (x > prevScroll.current.x) direction = 'right';
      else if (x < prevScroll.current.x) direction = 'left';

      setScroll({ x, y, direction });
      prevScroll.current = { x, y };
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scroll;
}

// ============== useElementSize Hook ==============

/**
 * Observe element dimensions
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => => {
      for (const entry of entries) {
        const { inlineSize, blockSize } = entry;
        setSize({
          width: inlineSize?.width || blockSize?.width || 0,
          height: inlineSize?.height || blockSize?.height || 0,
        });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

// ============== useIntersectionObserver Hook ==============

/**
 * Observe element visibility in viewport
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = { threshold: 0.1 }
) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
      setRatio(entry.intersectionRatio);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible, ratio };
}

// ============== useCopyToClipboard Hook ==============

/**
 * Copy text to clipboard
 */
export function useCopyToClipboard(resetDelay: number = 2000) {
  const [copiedText, setCopiedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
        setCopiedText('');
      }, resetDelay);

      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, [resetDelay]);

  return { copiedText, isCopied, copyText };
}

// ============== useNetworkStatus Hook ==============

/**
 * Monitor online/offline status
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isOffline: !isOnline };
}

// ============== useGeolocation Hook ==============

/**
 * Get user's geolocation
 */
export function useGeolocation(options?: PositionOptions) {
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError(new Error('Geolocation not supported'));
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options,
      }
    );
  }, [options]);

  return { location, error, loading, getLocation };
}

// ============== useFavicon Hook ==============

/**
 * Update browser favicon dynamically
 */
export function useFavicon() {
  const setFavicon = useCallback((url: string) => {
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  }, []);

  return { setFavicon };
}

// ============== useDocumentTitle Hook ==============

/**
 * Update document title
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = title;
    return () => { document.title = originalTitle; };
  }, [title]);
}

// ============== useUnsavedChanges Hook ==============

/**
 * Warn user about unsaved changes before leaving page
 */
export function useUnsavedChanges(hasChanges: boolean) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);
}

// ============== useIdle Callback Hook ==============

/**
 * Run callback when browser is idle
 */
export function useIdleCallback(callback: IdleRequestCallback, timeout?: number) {
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      requestRef.current = window.requestIdleCallback(callback, { timeout });
    } else {
      // Fallback to setTimeout
      requestRef.current = window.setTimeout(callback, timeout || 1000);
    }

    return () => {
      if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(requestRef.current);
      } else {
        window.clearTimeout(requestRef.current);
      }
    };
  }, [callback, timeout]);
}

// ============== useRaf Loop Hook ==============

/**
 * Run animation loop using requestAnimationFrame
 */
export function useRafLoop(
  callback: (deltaTime: number) => void,
  active: boolean = true
) {
  const rafId = useRef<number>(0);
  const previousTime = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const animate = (time: number) => {
      if (previousTime.current === 0) {
        previousTime.current = time;
      }

      const deltaTime = time - previousTime.current;
      previousTime.current = time;

      callback(deltaTime);
      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId.current);
  }, [active, callback]);
}

// ============== useCountDown Hook ==============

/**
 * Countdown timer hook
 */
export function useCountDown(
  targetDate: Date,
  onComplete?: () => void,
  intervalMs: number = 1000
) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = targetDate.getTime() - Date.now();
      setTimeLeft(Math.max(0, diff));

      if (diff <= 0) {
        setIsComplete(true);
        onComplete?.();
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, intervalMs);

    return () => clearInterval(interval);
  }, [targetDate, onComplete, intervalMs]);

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return {
    timeLeft,
    isComplete,
    days,
    hours,
    minutes,
    seconds,
  };
}

// ============== usePagination Hook ==============

/**
 * Pagination state management
 */
export function usePagination(totalItems: number, initialPageSize: number = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => goToPage(page + 1), [page, goToPage]);
  const prevPage = useCallback(() => goToPage(page - 1), [page, goToPage]);
  const firstPage = useCallback(() => goToPage(1), [goToPage]);
  const lastPage = useCallback(() => goToPage(totalPages), [goToPage, totalPages]);

  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to first page when changing size
  }, []);

  return {
    page,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    hasNextPage,
    hasPrevPage,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    changePageSize,
  };
}

// ============== useArray State Management ==============

/**
 * Array state management with utility functions
 */
export function useArray<T>(initialArray: T[] = []) {
  const [array, setArray] = useState<T[]>(initialArray);

  const push = useCallback((...items: T[]) => {
    setArray(prev => [...prev, ...items]);
  }, []);

  const pop = useCallback(() => {
    setArray(prev => prev.slice(0, -1));
  }, []);

  const shift = useCallback(() => {
    setArray(prev => prev.slice(1));
  }, []);

  const unshift = useCallback((...items: T[]) => {
    setArray(prev => [...items, ...prev]);
  }, []);

  const remove = useCallback((index: number) => {
    setArray(prev => [...prev.slice(0, index), ...prev.slice(index + 1)]);
  }, []);

  const insert = useCallback((index: number, item: T) => {
    setArray(prev => [...prev.slice(0, index), item, ...prev.slice(index)]);
  }, []);

  const update = useCallback((index: number, updater: (item: T) => T) => {
    setArray(prev => prev.map((item, i) => i === index ? updater(item) : item));
  }, []);

  const swap = useCallback((index1: number, index2: number) => {
    setArray(prev => {
      const result = [...prev];
      [result[index1], result[index2]] = [result[index2], result[index1]];
      return result;
    });
  }, []);

  const move = useCallback((from: number, to: number) => {
    setArray(prev => {
      const result = [...prev];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed[0]);
      return result;
    });
  }, []);

  const clear = useCallback(() => {
    setArray([]);
  }, []);

  const reverse = useCallback(() => {
    setArray(prev => [...prev].reverse());
  }, []);

  const sort = useCallback((compareFn?: (a: T, b: T) => number) => {
    setArray(prev => [...prev].sort(compareFn));
  }, []);

  const filter = useCallback((predicate: (item: T) => boolean) => {
    setArray(prev => prev.filter(predicate));
  }, []);

  return {
    array,
    setArray,
    push,
    pop,
    shift,
    unshift,
    remove,
    insert,
    update,
    swap,
    move,
    clear,
    reverse,
    sort,
    filter,
  };
}

// ============== Export All Hooks ==============

export {
  useDebounce,
  useThrottle,
  useLocalStorage,
  useSessionStorage,
  useAsync,
  useToggle,
  useClickOutside,
  useKeyPress,
  useInterval,
  useTimeout,
  usePrevious,
  useFirstRender,
  useMounted,
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersReducedMotion,
  useWindowSize,
  useScrollPosition,
  useElementSize,
  useIntersectionObserver,
  useCopyToClipboard,
  useNetworkStatus,
  useGeolocation,
  useFavicon,
  useDocumentTitle,
  useUnsavedChanges,
  useIdleCallback,
  useRafLoop,
  useCountDown,
  usePagination,
  useArray,
};

export default {
  useDebounce,
  useThrottle,
  useLocalStorage,
  useSessionStorage,
  useAsync,
  useToggle,
  useClickOutside,
  useKeyPress,
  useInterval,
  useTimeout,
  usePrevious,
  useFirstRender,
  useMounted,
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersReducedMotion,
  useWindowSize,
  useScrollPosition,
  useElementSize,
  useIntersectionObserver,
  useCopyToClipboard,
  useNetworkStatus,
  useGeolocation,
  useFavicon,
  useDocumentTitle,
  useUnsavedChanges,
  useIdleCallback,
  useRafLoop,
  useCountDown,
  usePagination,
  useArray,
};
