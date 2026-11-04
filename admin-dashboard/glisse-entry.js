import * as Glisse from 'glisse';
import React from 'react';
import * as ReactDOM from 'react-dom/client';

window.React = React;
window.ReactDOM = ReactDOM;
window.Glisse = Glisse;

/**
 * Automatically applies Glisse Liquid Glass classes, specular rims, and refraction attributes
 * to dashboard cards, buttons, tabs, and filters.
 */
export function initGlisse() {
  // Enhance stat cards, buttons, and control panels with Apple Liquid Glass styles
  const glassSelectors = [
    '.stat-card',
    '.btn-secondary',
    '.btn-primary',
    '.tab-btn',
    '.filter-chip',
    '.search-box',
    '[data-glass]'
  ];

  document.querySelectorAll(glassSelectors.join(', ')).forEach((el) => {
    el.classList.add('lg-glass');
    el.setAttribute('data-rim', 'true');
  });

  // Track cursor position for dynamic specular light sweep across glass surfaces
  window.addEventListener('pointermove', (e) => {
    const cards = document.querySelectorAll('.lg-glass');
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= -50 && x <= rect.width + 50 && y >= -50 && y <= rect.height + 50) {
        card.style.setProperty('--lg-x', `${x}px`);
        card.style.setProperty('--lg-y', `${y}px`);
      }
    });
  }, { passive: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlisse);
  } else {
    initGlisse();
  }
}

