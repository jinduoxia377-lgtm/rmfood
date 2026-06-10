import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import axe from 'axe-core';

export interface AxeResults {
  violations: any[];
  passes: any[];
  incomplete: any[];
  inapplicable: any[];
}

export async function renderAndCheckA11y(
  ui: ReactElement,
  options?: RenderOptions,
): Promise<AxeResults> {
  const { container } = render(ui, options);

  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });

  return results;
}

export function expectNoA11yViolations(results: AxeResults): void {
  if (results.violations.length > 0) {
    const violationMessages = results.violations
      .map(
        (violation) =>
          `[${violation.id}] ${violation.description}\n  Impact: ${violation.impact}\n  Elements: ${violation.nodes
            .map((node: any) => node.target.join(', '))
            .join('; ')}`,
      )
      .join('\n\n');

    throw new Error(
      `Accessibility violations found:\n\n${violationMessages}`,
    );
  }
}

export const AXE_RULES = {
  keyboard: {
    enabled: true,
  },
  'color-contrast': {
    enabled: true,
  },
  'screen-reader': {
    enabled: true,
  },
};

export const AXE_TAGS = {
  wcag2a: 'wcag2a',
  wcag2aa: 'wcag2aa',
  wcag21a: 'wcag21a',
  wcag21aa: 'wcag21aa',
};
