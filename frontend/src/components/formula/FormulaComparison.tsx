import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface FormulaComparisonProps {
  formulas: Array<{
    name: string
    data: Array<{ efficacy: number; safety: number; stability: number; cost: number }>
  }>
}

export function FormulaComparison({ formulas }: FormulaComparisonProps) {
  const series = useMemo(() => {
    const metrics = ['efficacy', 'safety', 'stability', 'cost']
    return metrics.map(metric => ({
      name: metric,
      ...formulas.reduce((acc, f, idx) => ({
        ...acc,
        [`formula_${idx}`]: (f.data[0] as any)?.[metric] || 0
      }), {})
    }))
  }, [formulas])
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {formulas.map((formula, idx) => (
          <div key={idx} className="p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">{formula.name}</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(formula.data[0] || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600">{key}:</span>
                  <span className="font-medium">{(value * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Legend />
          {formulas.map((_, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={`formula_${idx}`}
              stroke={['#4A90D9', '#50C878', '#FF6B6B'][idx % 3]}
              name={`配方${idx + 1}`}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
