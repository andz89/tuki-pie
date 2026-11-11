// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { isPieKeyFrom } from './usePieKeyboard';

afterEach(() => {
  document.body.innerHTML = '';
});

function element(html: string, selector: string): Element {
  document.body.innerHTML = html;
  const found = document.querySelector(selector);
  if (!found) throw new Error(`${selector} not found`);
  return found;
}

describe('isPieKeyFrom', () => {
  it('takes every key pressed with nothing focused', () => {
    expect(isPieKeyFrom('Enter', document.body)).toBe(true);
    expect(isPieKeyFrom('ArrowLeft', null)).toBe(true);
  });

  it('leaves Enter and arrows to a focused button in a list card', () => {
    const button = element(
      '<div class="pie-list"><ul><li><button id="b">Open</button></li></ul></div>',
      '#b',
    );
    expect(isPieKeyFrom('Enter', button)).toBe(false);
    expect(isPieKeyFrom('ArrowDown', button)).toBe(false);
  });

  it('leaves keys to anything inside the list card', () => {
    const item = element(
      '<div class="pie-list"><span id="s">x</span></div>',
      '#s',
    );
    expect(isPieKeyFrom('Enter', item)).toBe(false);
  });

  it('still closes on Esc from a focused list button', () => {
    const button = element(
      '<div class="pie-list"><button id="b">x</button></div>',
      '#b',
    );
    expect(isPieKeyFrom('Escape', button)).toBe(true);
  });

  it('leaves every key, Esc too, to a text field', () => {
    const input = element('<input id="i" />', '#i');
    expect(isPieKeyFrom('Escape', input)).toBe(false);
    expect(isPieKeyFrom('Enter', input)).toBe(false);
    const area = element('<textarea id="t"></textarea>', '#t');
    expect(isPieKeyFrom('ArrowLeft', area)).toBe(false);
  });
});
