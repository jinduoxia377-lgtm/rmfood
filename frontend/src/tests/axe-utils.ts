import React from 'react';
import { render } from '@testing-library/react';
import axe from '@axe-core/react';

export async function renderWithAxe(
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1],
) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  try {
    const result = render(ui, {
      ...options,
      container,
    });

    await axe(container);

    return result;
  } finally {
    document.body.removeChild(container);
  }
}

export async function checkA11y(container: HTMLElement): Promise<void> {
  const results = await axe(container);

  if (results.violations.length > 0) {
    const violationMessages = results.violations
      .map(
        (violation) =>
          `[${violation.id}] ${violation.description}\n  Impact: ${violation.impact}\n  Elements: ${violation.nodes
            .map((node) => node.target.join(', '))
            .join('; ')}`,
      )
      .join('\n\n');

    throw new Error(
      `Accessibility violations found:\n\n${violationMessages}`,
    );
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
    'keyboard': {
      enabled: true,
    },
    'screen-reader': {
      enabled: true,
    },
  },
};
