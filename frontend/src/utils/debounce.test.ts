import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delays function execution', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('cancels previous calls when called multiple times', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(50);
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('passes arguments correctly', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced('arg1', 'arg2', 123);
    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('handles multiple separate calls correctly', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced('call1');
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledWith('call1');
    expect(func).toHaveBeenCalledTimes(1);

    debounced('call2');
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledWith('call2');
    expect(func).toHaveBeenCalledTimes(2);
  });
});






