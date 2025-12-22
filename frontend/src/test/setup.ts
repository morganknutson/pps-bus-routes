import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock window.matchMedia - MUST BE BEFORE ANY IMPORTS THAT USE IT
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

import { useStore } from '../store/useStore';

// Run cleanup after each test case
afterEach(() => {
  cleanup();
  // Reset store to initial state (partial update to preserve actions)
  useStore.setState({
    selectedSchoolId: null,
    schools: [],
    routes: [],
    homeAddress: undefined,
    isLoading: false,
  });
});

