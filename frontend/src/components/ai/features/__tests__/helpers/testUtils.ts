import { ReactElement } from 'react'
import { render, RenderOptions, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

export async function waitForLoadingToComplete(): Promise<void> {
  await waitFor(() => {
    expect(document.body.querySelector('[data-testid="loading-indicator"]')).not.toBeInTheDocument()
  }, { timeout: 5000 })
}

export async function waitForErrorMessage(): Promise<Element> {
  return await waitFor(() => {
    const errorElement = document.querySelector('[data-testid="error-message"]')
    if (!errorElement) throw new Error('Error message not found')
    return errorElement
  }, { timeout: 3000 })
}

export async function typeAndSubmit(
  input: HTMLElement,
  text: string,
  submitButton: HTMLElement
): Promise<void> {
  await userEvent.type(input, text)
  await userEvent.click(submitButton)
}

export async function waitForMessageContent(content: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByText(content)).toBeInTheDocument()
  }, { timeout: 5000 })
}

export function createTestRenderer(options: RenderOptions = {}) {
  return (ui: ReactElement) => render(ui, {
    ...options
  })
}

export function simulateStreamResponse(
  chunks: string[],
  onChunk: (chunk: string) => void,
  delay: number = 50
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0
    const interval = setInterval(() => {
      if (index < chunks.length) {
        onChunk(chunks[index])
        index++
      } else {
        clearInterval(interval)
        resolve()
      }
    }, delay)
  })
}

export function advanceTimersByTime(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      vi.advanceTimersByTime(ms)
      resolve()
    }, 0)
  })
}

export class TestHelper {
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
  }

  getInput(): HTMLElement {
    return this.container.querySelector('input[placeholder*="输入"]') as HTMLElement
  }

  getSendButton(): HTMLElement {
    return this.container.querySelector('button[data-testid="send-button"]') as HTMLElement
  }

  getRetryButton(): HTMLElement {
    return this.container.querySelector('button[data-testid="retry-button"]') as HTMLElement
  }

  getReportButton(): HTMLElement {
    return this.container.querySelector('button[data-testid="report-button"]') as HTMLElement
  }

  getMessageElements(): Element[] {
    return Array.from(this.container.querySelectorAll('[data-testid="message"]'))
  }

  getFormulaElements(): Element[] {
    return Array.from(this.container.querySelectorAll('[data-testid="formula-card"]'))
  }

  async enterMessage(text: string): Promise<void> {
    const input = this.getInput()
    await userEvent.type(input, text)
  }

  async clickSend(): Promise<void> {
    const button = this.getSendButton()
    await userEvent.click(button)
  }

  async clickRetry(): Promise<void> {
    const button = this.getRetryButton()
    await userEvent.click(button)
  }

  hasErrorMessage(): boolean {
    return !!this.container.querySelector('[data-testid="error-message"]')
  }

  hasLoadingIndicator(): boolean {
    return !!this.container.querySelector('[data-testid="loading-indicator"]')
  }

  getMessageCount(): number {
    return this.getMessageElements().length
  }

  getFormulaCount(): number {
    return this.getFormulaElements().length
  }
}
