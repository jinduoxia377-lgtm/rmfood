import React from 'react';
import { render } from '@testing-library/react';
import axe from '@axe-core/react';
import type { AxeResults } from 'axe-core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const axeCore = (axe as any).core as
  | { run: (container: HTMLElement, options?: Record<string, unknown>) => Promise<AxeResults> }
  | undefined;

export async function renderWithAxe(ui: React.ReactElement, options?: Parameters<typeof render>[1]) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  try {
    const result = render(ui, {
      ...options,
      container,
    });

    if (axeCore) {
      await axeCore.run(container);
    } else {
      await axe(React, require('react-dom'), 0);
    }

    return result;
  } finally {
    document.body.removeChild(container);
  }
}

export async function checkA11y(container: HTMLElement): Promise<void> {
   
  const results: AxeResults = axeCore
    ? await axeCore.run(container)
    : ((await (axe as any)(React, require('react-dom'), 0)) as AxeResults);

  if (results.violations.length > 0) {
    const violationMessages = results.violations
      .map(
        (violation) =>
          `[${violation.id}] ${violation.description}\n  Impact: ${violation.impact}\n  Elements: ${violation.nodes
            .map((node) => node.target.join(', '))
            .join('; ')}`,
      )
      .join('\n\n');

    throw new Error(`Accessibility violations found:\n\n${violationMessages}`);
  }
}

export const axeOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
  rules: {
    'color-contrast': {
      enabled: true,
    },
    keyboard: {
      enabled: true,
    },
    'screen-reader': {
      enabled: true,
    },
  },
};
