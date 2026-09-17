/**
 * SafetyReportExporter - PDF export for safety check reports
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SafetyCheckResult } from '@/types';

interface ExportOptions {
  ingredients: string[];
  result: SafetyCheckResult;
  complianceRate: number;
}

function getRiskColor(level: string): [number, number, number] {
  switch (level) {
    case 'danger':
    case 'critical':
    case 'contraindicated':
      return [220, 38, 38];
    case 'warning':
    case 'caution':
      return [217, 119, 6];
    case 'info':
      return [37, 99, 235];
    default:
      return [34, 197, 94];
  }
}

export function exportSafetyReport(options: ExportOptions): void {
  const { ingredients, result, complianceRate } = options;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 15;

  const PRIMARY: [number, number, number] = [59, 130, 246];
  const DANGER: [number, number, number] = [220, 38, 38];
  const SUCCESS: [number, number, number] = [34, 197, 94];
  const GRAY: [number, number, number] = [100, 116, 139];
  const DARK: [number, number, number] = [15, 23, 42];

  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Safety Compliance Report', margin, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('RMFOOD Formula R\&D Platform', margin, 27);
  doc.text(new Date().toLocaleString('zh-CN'), margin, 33);
  y = 48;

  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Overview', margin, y);
  y += 2;
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.line(margin, y, margin + 40, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('Ingredients:', margin, y);
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  const ingLines = doc.splitTextToSize(ingredients.join(', '), contentW);
  doc.text(ingLines, margin, y);
  y += ingLines.length * 5 + 6;

  const passed = (result as any).passed ?? true;
  const badgeColor = passed ? SUCCESS : DANGER;
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.roundedRect(margin, y - 4, 22, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(passed ? 'PASS' : 'FAIL', margin + 11, y + 1.5);
  doc.setFontSize(11);
  doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.text('Compliance: ' + complianceRate.toFixed(1) + '%', margin + 28, y + 1.5);
  y += 14;

  const warnings: any[] = (result as any).warnings || [];
  const errors: any[] = result.errors || [];
  const details: Record<string, any> = (result as any).details || {};

  const dangerCount = warnings.filter((w: any) => ['danger','critical','contraindicated'].includes(w.level)).length;
  const warningCount = warnings.filter((w: any) => ['warning','caution'].includes(w.level)).length;

  if (dangerCount > 0 || warningCount > 0) {
    doc.setFontSize(9);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Risks: ' + dangerCount + ' danger, ' + warningCount + ' warnings', margin, y);
    y += 6;
  }

  const allIssues = [
    ...warnings.map((w: any) => ({
      type: w.level === 'danger' ? 'DANGER' : 'WARNING',
      ingredient: w.ingredient || w.name || '-',
      message: (w.message || w.reason || String(w)).slice(0, 80),
    })),
    ...errors.map((e: any) => ({
      type: 'ERROR',
      ingredient: '-',
      message: (typeof e === 'string' ? e : e.message || String(e)).slice(0, 80),
    })),
  ];

  if (allIssues.length > 0) {
    y += 4;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text('Issues', margin, y);
    y += 2;
    doc.line(margin, y, margin + 30, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 35 },
        2: { cellWidth: 'auto' },
      },
      head: [['Type', 'Ingredient', 'Detail']],
      headStyles: { fillColor: GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: DARK },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3, lineColor: [226, 232, 240] },
      body: allIssues.map((issue) => [issue.type, issue.ingredient, issue.message]),
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  const checkKeys = Object.keys(details);
  if (checkKeys.length > 0) {
    y += 4;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text('Check Items', margin, y);
    y += 2;
    doc.line(margin, y, margin + 30, y);
    y += 8;

    const checkData = checkKeys.map((key) => {
      const val = details[key];
      const isPassed = val?.passed ?? true;
      return [key.replace(/_/g, ' '), isPassed ? 'Pass' : 'Fail', val?.message || ''];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 25 },
        2: { cellWidth: 'auto' },
      },
      head: [['Item', 'Result', 'Note']],
      headStyles: { fillColor: GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: DARK },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3, lineColor: [226, 232, 240] },
      body: checkData,
    });
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageH - 20, pageW, 20, 'F');
  doc.setFontSize(8);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('Generated by RMFOOD AI Assistant - For reference only', margin, pageH - 12);

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save('safety_report_' + ingredients.slice(0, 3).join('-') + '_' + dateStr + '.pdf');
}
