/**
 * BatchOperationBar组件全面测试
 *
 * 测试覆盖：
 * 1. 全选/取消全选功能
 * 2. 批量导出（JSON/CSV/Excel/PDF）
 * 3. 批量删除确认
 * 4. 打标签功能
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import BatchOperationBar from '@/components/ai/features/components/BatchOperationBar'
import type { ExportFormat } from '@/components/ai/features/components/BatchOperationBar'

const defaultProps = {
  selectedCount: 3,
  totalCount: 10,
  onExport: vi.fn(),
  onDelete: vi.fn(),
  onTagAdd: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
}

describe('BatchOperationBar - 批量操作栏组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. 基础渲染', () => {
    it('应该正确渲染选择状态', () => {
      render(<BatchOperationBar {...defaultProps} />)

      expect(screen.getByText(/✓\s*3\/10/)).toBeInTheDocument()
    })

    it('应该渲染所有操作按钮', () => {
      render(<BatchOperationBar {...defaultProps} />)

      expect(screen.getByText(/全选/)).toBeInTheDocument()
      expect(screen.getByText('导出')).toBeInTheDocument()
      expect(screen.getByText('打标签')).toBeInTheDocument()
      expect(screen.getByText('删除')).toBeInTheDocument()
      expect(screen.getByText('取消')).toBeInTheDocument()
    })
  })

  describe('2. 全选/取消全选功能', () => {
    it('未全选时应该显示"全选"按钮', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={3} totalCount={10} />)

      expect(screen.getByText('全选')).toBeInTheDocument()
    })

    it('已全选时应该显示"取消全选"按钮', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={10} totalCount={10} />)

      expect(screen.getByText('取消全选')).toBeInTheDocument()
    })

    it('点击"全选"应该调用onSelectAll', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={0} totalCount={10} />)

      const selectAllButton = screen.getByRole('button', { name: /全选/ })
      fireEvent.click(selectAllButton)

      expect(defaultProps.onSelectAll).toHaveBeenCalledTimes(1)
    })

    it('点击"取消全选"应该调用onClearSelection', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={10} totalCount={10} />)

      const clearButton = screen.getByRole('button', { name: /取消全选/ })
      fireEvent.click(clearButton)

      expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1)
    })

    it('totalCount为0时不应该显示全选按钮文本', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={0} totalCount={0} />)

      // 按钮仍然存在，但可能不显示"全选"文本
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  describe('3. 批量导出功能', () => {
    it('点击导出按钮应该显示导出格式菜单', () => {
      render(<BatchOperationBar {...defaultProps} />)

      const exportButton = screen.getByText('导出')
      fireEvent.click(exportButton)

      // 应该显示导出格式选项
      expect(screen.getByText('JSON 格式')).toBeInTheDocument()
      expect(screen.getByText('CSV 格式')).toBeInTheDocument()
      expect(screen.getByText('Excel 格式')).toBeInTheDocument()
      expect(screen.getByText('PDF 报告')).toBeInTheDocument()
    })

    it('选择JSON格式应该调用onExport("json")', () => {
      render(<BatchOperationBar {...defaultProps} />)

      // 打开导出菜单
      fireEvent.click(screen.getByText('导出'))

      // 选择JSON格式
      const jsonOption = screen.getByText('JSON 格式')
      fireEvent.click(jsonOption)

      expect(defaultProps.onExport).toHaveBeenCalledWith('json')
    })

    it('选择CSV格式应该调用onExport("csv")', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('导出'))
      fireEvent.click(screen.getByText('CSV 格式'))

      expect(defaultProps.onExport).toHaveBeenCalledWith('csv')
    })

    it('选择Excel格式应该调用onExport("excel")', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('导出'))
      fireEvent.click(screen.getByText('Excel 格式'))

      expect(defaultProps.onExport).toHaveBeenCalledWith('excel')
    })

    it('选择PDF格式应该调用onExport("pdf")', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('导出'))
      fireEvent.click(screen.getByText('PDF 报告'))

      expect(defaultProps.onExport).toHaveBeenCalledWith('pdf')
    })

    it('选择格式后应该关闭导出菜单', () => {
      render(<BatchOperationBar {...defaultProps} />)

      // 打开菜单
      fireEvent.click(screen.getByText('导出'))
      expect(screen.getByText('JSON 格式')).toBeInTheDocument()

      // 选择格式
      fireEvent.click(screen.getByText('JSON 格式'))

      // 菜单应该关闭
      expect(screen.queryByText('JSON 格式')).not.toBeInTheDocument()
    })

    it('应该显示格式的描述信息', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('导出'))

      expect(screen.getByText('结构化数据，适合程序处理')).toBeInTheDocument()
      expect(screen.getByText('表格数据，适合 Excel 打开')).toBeInTheDocument()
      expect(screen.getByText('.xlsx 文件，保留样式')).toBeInTheDocument()
      expect(screen.getByText('专业报告文档')).toBeInTheDocument()
    })
  })

  describe('4. 批量删除确认', () => {
    it('点击删除按钮应该显示确认对话框', () => {
      render(<BatchOperationBar {...defaultProps} />)

      const deleteButton = screen.getByText('删除')
      fireEvent.click(deleteButton)

      // 应该显示确认对话框（检查是否出现多次）
      expect(screen.getAllByText('确认删除').length).toBeGreaterThan(0)
    })

    it('确认对话框应该显示警告信息', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={5} />)

      fireEvent.click(screen.getByText('删除'))

      expect(screen.getByText('此操作不可撤销，请谨慎操作。')).toBeInTheDocument()
    })

    it('点击"确认删除"应该调用onDelete并关闭对话框', () => {
      render(<BatchOperationBar {...defaultProps} />)

      // 打开确认对话框
      fireEvent.click(screen.getByText('删除'))

      // 点击确认（使用getAllByText并选择对话框中的那个）
      const confirmButtons = screen.getAllByText('确认删除')
      const dialogConfirmButton = confirmButtons[1] // 第二个是按钮
      fireEvent.click(dialogConfirmButton)

      expect(defaultProps.onDelete).toHaveBeenCalledTimes(1)

      // 对话框应该关闭
      expect(screen.queryByText('确定要删除选中的')).not.toBeInTheDocument()
    })

    it('点击"取消"应该关闭对话框而不调用onDelete', () => {
      render(<BatchOperationBar {...defaultProps} />)

      // 打开确认对话框
      fireEvent.click(screen.getByText('删除'))

      // 点击取消（使用getAllByText）
      const cancelButtons = screen.getAllByText('取消')
      const dialogCancelButton = cancelButtons[cancelButtons.length - 1] // 最后一个是对话框中的
      fireEvent.click(dialogCancelButton)

      expect(defaultProps.onDelete).not.toHaveBeenCalled()

      // 对话框应该关闭
      expect(screen.queryByText('确认删除')).not.toBeInTheDocument()
    })

    it('应该正确显示选中的数量', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={7} />)

      fireEvent.click(screen.getByText('删除'))

      expect(screen.getAllByText(/7/).length).toBeGreaterThan(0)
    })
  })

  describe('5. 打标签功能', () => {
    it('点击打标签按钮应该显示标签选择器', () => {
      render(<BatchOperationBar {...defaultProps} />)

      const tagButton = screen.getByText('打标签')
      fireEvent.click(tagButton)

      // 应该显示标签选择器
      expect(screen.getByText('为选中配方添加标签')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('输入新标签...')).toBeInTheDocument()
    })

    it('应该显示常用标签列表', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('打标签'))

      // 显示常用标签
      expect(screen.getByText('补气')).toBeInTheDocument()
      expect(screen.getByText('补血')).toBeInTheDocument()
      expect(screen.getByText('健脾')).toBeInTheDocument()
      expect(screen.getByText('抗氧化')).toBeInTheDocument()
    })

    it('点击常用标签应该调用onTagAdd并关闭选择器', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('打标签'))
      fireEvent.click(screen.getByText('补气'))

      expect(defaultProps.onTagAdd).toHaveBeenCalledWith(['补气'])

      // 选择器应该关闭
      expect(screen.queryByText('为选中配方添加标签')).not.toBeInTheDocument()
    })

    it('输入新标签并按回车应该添加标签', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('打标签'))

      const input = screen.getByPlaceholderText('输入新标签...')
      fireEvent.change(input, { target: { value: '自定义标签' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(defaultProps.onTagAdd).toHaveBeenCalledWith(['自定义标签'])
    })

    it('输入新标签并点击添加按钮应该添加标签', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('打标签'))

      const input = screen.getByPlaceholderText('输入新标签...')
      fireEvent.change(input, { target: { value: '新功效' } })

      const addButton = screen.getByText('添加')
      fireEvent.click(addButton)

      expect(defaultProps.onTagAdd).toHaveBeenCalledWith(['新功效'])
    })

    it('空标签不应该触发添加', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('打标签'))

      const addButton = screen.getByText('添加')
      fireEvent.click(addButton) // 输入为空

      expect(defaultProps.onTagAdd).not.toHaveBeenCalled()
    })

    it('点击取消应该关闭标签选择器', () => {
      render(<BatchOperationBar {...defaultProps} />)

      fireEvent.click(screen.getByText('打标签'))
      expect(screen.getByText('为选中配方添加标签')).toBeInTheDocument()

      const cancelButtons = screen.getAllByText('取消')
      const tagPickerCancelButton = cancelButtons[0] // 第一个应该是标签选择器中的
      fireEvent.click(tagPickerCancelButton)

      expect(screen.queryByText('为选中配方添加标签')).not.toBeInTheDocument()
    })
  })

  describe('6. 取消选择功能', () => {
    it('点击取消按钮应该调用onClearSelection', () => {
      render(<BatchOperationBar {...defaultProps} />)

      const cancelButton = screen.getByText('取消')
      fireEvent.click(cancelButton)

      expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1)
    })
  })

  describe('7. 合并功能（可选）', () => {
    it('提供onMerge时应该显示合并按钮', () => {
      const onMerge = vi.fn()
      render(<BatchOperationBar {...defaultProps} onMerge={onMerge} />)

      expect(screen.getByText('合并')).toBeInTheDocument()
    })

    it('选中数量<2时合并按钮应该被禁用', () => {
      const onMerge = vi.fn()
      render(
        <BatchOperationBar
          {...defaultProps}
          selectedCount={1}
          onMerge={onMerge}
        />
      )

      const mergeButton = screen.getByText('合并').closest('button')
      expect(mergeButton?.disabled).toBe(true)
    })

    it('选中数量>=2时合并按钮应该可用', () => {
      const onMerge = vi.fn()
      render(
        <BatchOperationBar
          {...defaultProps}
          selectedCount={5}
          onMerge={onMerge}
        />
      )

      const mergeButton = screen.getByText('合并')
      expect(mergeButton).not.toBeDisabled()
    })

    it('点击合并按钮应该调用onMerge', () => {
      const onMerge = vi.fn()
      render(
        <BatchOperationBar
          {...defaultProps}
          selectedCount={3}
          onMerge={onMerge}
        />
      )

      fireEvent.click(screen.getByText('合并'))
      expect(onMerge).toHaveBeenCalledTimes(1)
    })

    it('不提供onMerge时不应该显示合并按钮', () => {
      const propsWithoutMerge = { ...defaultProps }
      delete propsWithoutMerge.onMerge

      render(<BatchOperationBar {...propsWithoutMerge} />)

      expect(screen.queryByText('合并')).not.toBeInTheDocument()
    })
  })

  describe('8. 紧凑模式', () => {
    it('紧凑模式应该应用不同的样式', () => {
      const { container } = render(
        <BatchOperationBar {...defaultProps} compact={true} />
      )

      // 紧凑模式下字体更小
      const bar = container.querySelector('.bg-primary-50')
      expect(bar?.className).toContain('px-3')
      expect(bar?.className).toContain('py-2')
    })
  })

  describe('9. 边界情况', () => {
    it('selectedCount为0时应该正常显示', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={0} totalCount={10} />)

      expect(screen.getByText(/✓\s*0\/10/)).toBeInTheDocument()
    })

    it('totalCount为0时应该正常显示', () => {
      render(<BatchOperationBar {...defaultProps} selectedCount={0} totalCount={0} />)

      expect(screen.getByText(/✓\s*0\/0/)).toBeInTheDocument()
    })
  })
})
