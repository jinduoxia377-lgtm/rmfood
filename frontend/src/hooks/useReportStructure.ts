import { useState, useCallback } from 'react';
import { DetailLevel } from '../types/report.types';
import type { ReportSection } from '../types/report.types';

export interface UseReportStructureReturn {
  sections: ReportSection[];
  addSection: (section: ReportSection, parentId?: string) => void;
  removeSection: (sectionId: string) => void;
  updateSection: (sectionId: string, updates: Partial<ReportSection>) => void;
  moveSection: (sectionId: string, direction: 'up' | 'down') => void;
  moveSectionToIndex: (sectionId: string, newIndex: number) => void;
  reorderSections: (startIndex: number, endIndex: number) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  setSectionDetailLevel: (sectionId: string, level: DetailLevel) => void;
  duplicateSection: (sectionId: string) => void;
  resetToTemplate: (templateSections: ReportSection[]) => void;
  getVisibleSections: () => ReportSection[];
  getFlatSections: () => ReportSection[];
  getSectionById: (sectionId: string) => ReportSection | undefined;
  exportStructure: () => ReportSection[];
  importStructure: (sections: ReportSection[]) => void;
}

export function useReportStructure(
  initialSections: ReportSection[] = [],
): UseReportStructureReturn {
  const [sections, setSections] = useState<ReportSection[]>(initialSections);

  const addSection = useCallback((newSection: ReportSection, parentId?: string) => {
    if (parentId) {
      setSections(prev =>
        prev.map(section => {
          if (section.id === parentId) {
            const children = section.children || [];
            return {
              ...section,
              children: [...children, { ...newSection, order: children.length }],
            };
          }
          return section;
        }),
      );
    } else {
      setSections(prev => [
        ...prev,
        { ...newSection, order: prev.length },
      ]);
    }
  }, []);

  const removeSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  }, []);

  const updateSection = useCallback((sectionId: string, updates: Partial<ReportSection>) => {
    const updateRecursive = (secs: ReportSection[]): ReportSection[] => {
      return secs.map(section => {
        if (section.id === sectionId) {
          return { ...section, ...updates };
        }
        if (section.children) {
          return {
            ...section,
            children: updateRecursive(section.children),
          };
        }
        return section;
      });
    };

    setSections(updateRecursive);
  }, []);

  const moveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
    setSections(prev => {
      const index = prev.findIndex(s => s.id === sectionId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newSections = [...prev];
      [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];

      return newSections.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const moveSectionToIndex = useCallback((sectionId: string, newIndex: number) => {
    setSections(prev => {
      const currentIndex = prev.findIndex(s => s.id === sectionId);
      if (currentIndex === -1 || currentIndex === newIndex) return prev;

      const newSections = [...prev];
      const [removed] = newSections.splice(currentIndex, 1);
      newSections.splice(newIndex, 0, removed);

      return newSections.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const reorderSections = useCallback((startIndex: number, endIndex: number) => {
    setSections(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);

      return result.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const toggleSectionVisibility = useCallback((sectionId: string) => {
    updateSection(sectionId, { visible: !getSectionByIdHelper(sections, sectionId)?.visible });
  }, [updateSection, sections]);

  const setSectionDetailLevel = useCallback((sectionId: string, level: DetailLevel) => {
    updateSection(sectionId, { detailLevel: level });
  }, [updateSection]);

  const duplicateSection = useCallback((sectionId: string) => {
    const sectionToDuplicate = getSectionByIdHelper(sections, sectionId);
    if (!sectionToDuplicate) return;

    const duplicated: ReportSection = {
      ...sectionToDuplicate,
      id: `${sectionId}-copy-${Date.now()}`,
      title: `${sectionToDuplicate.title} (副本)`,
      order: sections.length,
    };

    setSections(prev => [...prev, duplicated]);
  }, [sections]);

  const resetToTemplate = useCallback((templateSections: ReportSection[]) => {
    setSections(templateSections);
  }, []);

  const getVisibleSections = useCallback((): ReportSection[] => {
    return sections.filter(s => s.visible).sort((a, b) => a.order - b.order);
  }, [sections]);

  const getFlatSections = useCallback((): ReportSection[] => {
    const flatten = (secs: ReportSection[], depth = 0): ReportSection[] => {
      return secs.reduce<ReportSection[]>((acc, section) => {
        acc.push({ ...section, level: depth });
        if (section.children && section.children.length > 0) {
          acc.push(...flatten(section.children, depth + 1));
        }
        return acc;
      }, []);
    };

    return flatten(sections).sort((a, b) => a.order - b.order);
  }, [sections]);

  const getSectionById = useCallback((sectionId: string): ReportSection | undefined => {
    return getSectionByIdHelper(sections, sectionId);
  }, [sections]);

  const exportStructure = useCallback((): ReportSection[] => {
    return JSON.parse(JSON.stringify(sections));
  }, [sections]);

  const importStructure = useCallback((importedSections: ReportSection[]) => {
    setSections(importedSections);
  }, []);

  return {
    sections,
    addSection,
    removeSection,
    updateSection,
    moveSection,
    moveSectionToIndex,
    reorderSections,
    toggleSectionVisibility,
    setSectionDetailLevel,
    duplicateSection,
    resetToTemplate,
    getVisibleSections,
    getFlatSections,
    getSectionById,
    exportStructure,
    importStructure,
  };
}

function getSectionByIdHelper(
  sections: ReportSection[],
  sectionId: string,
): ReportSection | undefined {
  for (const section of sections) {
    if (section.id === sectionId) return section;
    if (section.children) {
      const found = getSectionByIdHelper(section.children, sectionId);
      if (found) return found;
    }
  }
  return undefined;
}
