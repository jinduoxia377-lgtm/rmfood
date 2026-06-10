import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import axe from 'axe-core';
import { Button } from '../../components/ui/Button';

describe('Button Accessibility Tests', () => {
  test('should have no accessibility violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    
    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });
    
    expect(results.violations).toEqual([]);
  });

  test('should have proper ARIA attributes when disabled', async () => {
    render(<Button disabled>Disabled Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('disabled');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  test('should have proper aria-label when icon only', async () => {
    render(<Button aria-label="Close">X</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Close');
  });

  test('should support keyboard navigation', async () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('tabindex', '-1');
  });

  test('should have proper type attribute', async () => {
    render(<Button type="submit">Submit</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  test('should handle loading state accessibly', async () => {
    render(<Button loading>Loading...</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('disabled');
  });
});
