/**
 * RMFOOD 设计系统 — Radix Theme 布局增强层
 *
 * 策略：包装现有 MainLayout，应用 Radix Theme Token
 * 不破坏任何现有功能，逐步引入 Radix 样式系统
 */
import { Box, Flex, Section, Container, Text } from '@radix-ui/themes'
import MainLayout from './MainLayout'

export function RadixLayoutEnhanced() {
  return (
    <Box as="div" style={{ minHeight: '100vh' }}>
      <Flex direction="column" height="100vh">
        {/* Top spacer for fixed header if needed */}
        <Section size="1" backgroundColor="surface">
          <Container size="4">
            <Text size="1" weight="bold" color="gray">
              {/* Left empty — header rendered by MainLayout */}
            </Text>
          </Container>
        </Section>

        {/* Main content area */}
        <Flex direction="row" flex="1" overflow="hidden">
          <Box flex="1" overflow="auto" className="bg-surface">
            <MainLayout />
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}

// Re-export MainLayout for backward compatibility
export { default } from './MainLayout'
export type { default as MainLayoutType } from './MainLayout'
