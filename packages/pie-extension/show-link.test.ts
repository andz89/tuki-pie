// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showLinkOnPage } from './show-link.js';

// jsdom lays nothing out, so a link counts as shown only when given a size.
function giveSize(link: Element): void {
  link.getBoundingClientRect = () =>
    ({
      width: 50,
      height: 10,
      top: 0,
      left: 0,
      bottom: 10,
      right: 50,
    }) as DOMRect;
}

beforeEach(() => {
  document.body.innerHTML =
    '<div id="wpadminbar"><a href="https://a.com/admin">A</a></div>' +
    '<p><a href="https://a.com/one">1</a> <a href="javascript:void(0)">js</a></p>' +
    '<a href="https://a.com/two">2</a>';
  Element.prototype.scrollIntoView = vi.fn();
  (window as { __pieClearLocate?: () => void }).__pieClearLocate?.();
});

const links = () => [...document.querySelectorAll('a')];

describe('showLinkOnPage', () => {
  it('marks the link at the same position as Page Info listed it', () => {
    const two = links()[3];
    giveSize(two);
    expect(showLinkOnPage(1, 'https://a.com/two')).toBe('shown');
    expect(two.classList.contains('pie-locate-highlight')).toBe(true);
    expect(document.querySelector('.pie-locate-label')).not.toBeNull();
  });

  it('falls back to the address when the page changed', () => {
    const two = links()[3];
    giveSize(two);
    expect(showLinkOnPage(0, 'https://a.com/two')).toBe('shown');
  });

  it('counts risky links too, as Page Info lists them', () => {
    document.body.innerHTML =
      '<a href="https://a.com/posts/5/delete">del</a>' +
      '<a href="https://a.com/three">3</a>';
    const del = links()[0];
    giveSize(del);
    expect(showLinkOnPage(0, 'https://a.com/posts/5/delete')).toBe('shown');
    expect(del.classList.contains('pie-locate-highlight')).toBe(true);
  });

  it('says hidden for a link with no size', () => {
    expect(showLinkOnPage(0, 'https://a.com/one')).toBe('hidden');
  });

  it('says not-found for a link that is gone', () => {
    expect(showLinkOnPage(5, 'https://a.com/gone')).toBe('not-found');
  });

  it('clears the mark on the next click on the page', () => {
    giveSize(links()[3]);
    showLinkOnPage(1, 'https://a.com/two');
    document.dispatchEvent(new Event('pointerdown'));
    expect(document.querySelector('.pie-locate-highlight')).toBeNull();
    expect(document.querySelector('.pie-locate-label')).toBeNull();
  });
});
