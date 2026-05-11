import { describe, it, expect } from 'vitest';
import { detectOs } from '../../lib/detectOs';

// Real-world User-Agent strings for each platform
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15';
const MAC_FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0';
const WIN_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const WIN_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const LINUX_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const BOT_UA = 'Googlebot/2.1 (+http://www.google.com/bot.html)';

describe('detectOs', () => {
  it('identifies macOS Chrome UA as macos', () => {
    expect(detectOs(MAC_CHROME)).toBe('macos');
  });

  it('identifies macOS Safari UA as macos', () => {
    expect(detectOs(MAC_SAFARI)).toBe('macos');
  });

  it('identifies macOS Firefox UA as macos', () => {
    expect(detectOs(MAC_FIREFOX)).toBe('macos');
  });

  it('identifies Windows Chrome UA as windows', () => {
    expect(detectOs(WIN_CHROME)).toBe('windows');
  });

  it('identifies Windows Edge UA as windows', () => {
    expect(detectOs(WIN_EDGE)).toBe('windows');
  });

  it('identifies Linux Chrome UA as unknown', () => {
    expect(detectOs(LINUX_CHROME)).toBe('unknown');
  });

  it('identifies iOS Safari UA as unknown (not macOS)', () => {
    expect(detectOs(IOS_SAFARI)).toBe('unknown');
  });

  it('identifies iPadOS Safari UA as unknown (not macOS)', () => {
    expect(detectOs(IPAD_SAFARI)).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(detectOs('')).toBe('unknown');
  });

  it('returns unknown for bot UA', () => {
    expect(detectOs(BOT_UA)).toBe('unknown');
  });
});
