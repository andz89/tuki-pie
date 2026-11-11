import { describe, expect, it } from 'vitest';
import { carriesToken } from './link-tokens';

const site = 'https://a.com';

describe('carriesToken', () => {
  it('marks links with a secret, an ID or a random value', () => {
    for (const path of [
      '/reset?token=abc',
      '/confirm?key=x',
      '/api?apiKey=x',
      '/login?auth=1',
      '/verify?code=123',
      '/dl?sig=abc',
      '/x?session_id=1',
      '/order?id=5',
      '/order?order_id=55',
      '/cart?itemId=7',
      '/u?uid=1',
      '/x?r=550e8400-e29b-41d4-a716-446655440000',
      '/x?r=a8F3kd92LmQ0zX7p',
      '/x?r=Zm9vYmFyYmF6cXV4MTIz==',
      '/invite/550e8400-e29b-41d4-a716-446655440000',
      '/dl/0123456789abcdef0123456789abcdef',
    ]) {
      expect(carriesToken(site + path), path).toBe(true);
    }
  });

  it('leaves plain content, tracking and WordPress reading links alone', () => {
    for (const path of [
      '/',
      '/blog/my-first-post-2026',
      '/?p=12',
      '/?page_id=5',
      '/?attachment_id=9',
      '/?cat=3&paged=2',
      '/?s=coaching',
      '/style.css?ver=6.4.2',
      '/?utm_source=news&utm_campaign=summer-sale-2026',
      '/?fbclid=IwAR3xK9dLmQ0zX7pa8F3kd92',
      '/?gclid=Cj0KCQiA8F3kd92LmQ0zX7p',
      '/?li_fat_id=123',
      '/?_gl=1*abc123*_ga*MTIzNDU2',
      '/?campaign=summer-sale-2026-edition',
      '/?color=red',
    ]) {
      expect(carriesToken(site + path), path).toBe(false);
    }
  });

  it('only checks web links', () => {
    expect(carriesToken('mailto:hi@a.com?subject=token')).toBe(false);
    expect(carriesToken('not a url')).toBe(false);
  });
});
