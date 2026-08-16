import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';
import { RaagaXWaveform } from '@/components/brand/RaagaXWaveform';

describe('RaagaX Complete Brand Identity & Design System', () => {
  it('should render Primary Full Logo with abstract SVG components and no text', () => {
    const html = renderToString(React.createElement(RaagaXLogo, { variant: 'full', size: 48, themeOverride: 'dark' }));
    expect(html).toContain('svg');
    expect(html).toContain('rxRedGlowGrad');
    expect(html).toContain('rxSymbolGlow');
    // Ensure no alphabetic characters inside the symbol
    expect(html).not.toContain('>R<');
    expect(html).not.toContain('>X<');
    expect(html).not.toContain('>RX<');
  });

  it('should render Micro Mark variant for favicons and 16-24px UI', () => {
    const html = renderToString(React.createElement(RaagaXLogo, { variant: 'micro', size: 24, themeOverride: 'light' }));
    expect(html).toContain('svg');
    expect(html).toContain('fill="#E50914"');
  });

  it('should render Monochrome Red, Black, and White variants', () => {
    const redHtml = renderToString(React.createElement(RaagaXLogo, { variant: 'monochrome-red' }));
    const blackHtml = renderToString(React.createElement(RaagaXLogo, { variant: 'monochrome-black' }));
    const whiteHtml = renderToString(React.createElement(RaagaXLogo, { variant: 'monochrome-white' }));

    expect(redHtml).toContain('#E50914');
    expect(blackHtml).toContain('#0F172A');
    expect(whiteHtml).toContain('#FFFFFF');
  });

  it('should render RaagaXWordmark with separate geometric typography and brand red X', () => {
    const html = renderToString(React.createElement(RaagaXWordmark, { size: 'xl', showTagline: true, tagline: 'Music That Moves With You' }));
    expect(html.toLowerCase()).toContain('raaga');
    expect(html.toLowerCase()).toContain('x');
    expect(html).toContain('Music That Moves With You');
    expect(html).toContain('text-[#E50914]');
  });

  it('should render RaagaXWaveform for all 7 player states', () => {
    const states = ['idle', 'loading', 'buffering', 'playing', 'paused', 'error', 'offline'] as const;
    
    for (const state of states) {
      const html = renderToString(React.createElement(RaagaXWaveform, { state, barCount: 7, height: 20 }));
      expect(html).toContain(`aria-label="Waveform state: ${state}"`);
    }
  });
});
