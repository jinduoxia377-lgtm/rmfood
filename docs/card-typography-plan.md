# Card Typography Optimization Plan

## Analysis Summary

### Current Issues:
1. **StatCard**: Label text-[11px], Value text-lg(18px), Icon w-6h-6(24px)
2. **Charts**: Font sizes 9-10px too small, inconsistent
3. **DataQualityPanel**: title text-[13px], progress ring size 80px
4. **QuickActions**: buttons text-[13px], min-h-[46px]
5. **PerformancePanel**: values [font-size:26px], labels text-[13px]
6. **OB/DL/Seq Charts**: XAxis/YAxis fontSize 9-10px, Tooltip fontSize 12px

### Apple HIG Standards:
- Labels: 12-14px (caption-strong/body-sm)
- Values: 20-28px (body-strong/display)
- Icons: 16-24px (body/display)
- Padding: 16-24px
- Font weights: 400 (normal), 600 (semibold)
- Line heights: 1.5 (body), 1.25 (tight)

## Optimization Plan

### 1. StatCard (frontend/src/components/ui/StatCard.tsx)
- Label: text-xs (12px) + font-semibold
- Value: text-xl (20px) → text-2xl (24px)
- Subtitle: text-xs (12px)
- Icon: w-7 h-7 (28px), size 14→16
- Padding: px-5 pt-4 pb-5 (20px)
- Trend: font-normal + leading-normal

### 2. DataQualityPanel
- Title: text-xs (12px) + font-semibold + uppercase + tracking-wide
- ProgressRing: size 80 → 96px
- Metric description: text-xs (12px) + font-medium

### 3. QuickActions
- Button text: text-sm (14px) + font-semibold
- Button height: min-h-[52px]
- Icon: w-5 h-5 (20px)
- Padding: px-5

### 4. PerformancePanel
- Value: text-2xl (24px)
- Label: text-xs (12px) + font-medium
- Unit: text-sm (14px)

### 5. Chart Components (OB/DL/Seq)
- Axis tick fontSize: 11 → 12px
- Tooltip fontSize: 12 → 13px
- CardTitle: text-sm (14px) → text-base (16px)
- Legend: fontSize 12 → 13px
- Bar radius: [4,4,4,4] consistent

### 6. HerbCategoryChart & PeptideActivityChart
- Legend text: text-xs (12px) → text-sm (14px)
- Chart title: text-base (16px)
- Tooltip fontSize: 12 → 13px
