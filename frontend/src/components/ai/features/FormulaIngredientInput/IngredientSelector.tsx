import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui';
import { LoadingSpinner } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Search, Database } from 'lucide-react';
import type { FormulaIngredient } from './types';
import { DEFAULT_PARAMETERS } from './types';
import { generateId } from './utils';


import { logger } from '@/utils/safeLogger';
interface IngredientSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ingredient: FormulaIngredient) => void;
}

interface IngredientData {
  id: string;
  name: string;
  nameCn: string;
  category: string;
  description: string;
  properties: Array<{ name: string; value: string; unit: string }>;
}

export const IngredientSelector: React.FC<IngredientSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<IngredientData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/ingredients', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch ingredients');
      }
      
      const data = await response.json();
      setIngredients(data.data || []);
      setFilteredIngredients(data.data || []);
    } catch (err) {
      logger.error('Error fetching ingredients:', err);
      setError('无法连接到数据库，使用本地预设数据');
      setIngredients(getMockIngredients());
      setFilteredIngredients(getMockIngredients());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchIngredients();
    }
  }, [isOpen, fetchIngredients]);

  useEffect(() => {
    const filtered = ingredients.filter((ing) =>
      ing.nameCn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredIngredients(filtered);
  }, [searchTerm, ingredients]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSelect = (ing: IngredientData) => {
    const newIngredient: FormulaIngredient = {
      id: generateId(),
      name: ing.name,
      nameCn: ing.nameCn,
      ratio: 0,
      unit: 'percentage',
      dosage: 0,
      parameters: DEFAULT_PARAMETERS.map((p) => ({
        ...p,
        id: generateId(),
        value: null,
      })),
    };
    
    onSelect(newIngredient);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="ingredient-selector-overlay"  role="button" tabIndex={0} onClick={onClose}>
      <div className="ingredient-selector" ref={wrapperRef}  role="button" tabIndex={0} onClick={(e) => e.stopPropagation()}>
        <div className="selector-header">
          <h3 className="selector-title">
            <Database className="w-5 h-5" /> 选择成分
          </h3>
          <Input
            placeholder="搜索成分名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            prefix={<Search className="w-4 h-4" />}
            className="search-input"
            autoFocus
          />
        </div>

        <div className="selector-body">
          {loading ? (
            <div className="loading-container">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="error-message">
              <EmptyState title="连接错误" description={error} />
            </div>
          ) : filteredIngredients.length === 0 ? (
            <EmptyState title="未找到匹配的成分" />
          ) : (
            <div className="ingredient-list">
              {filteredIngredients.map((item) => (
                <div
                  key={item.id}
                  className="ingredient-item"
                  tabIndex={0}
                  onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSelect(item)}
                  role="button"
                >
                  <div className="ingredient-item-content">
                    <div className="ingredient-name">
                      <span className="name-cn">{item.nameCn}</span>
                      <span className="name-en">{item.name}</span>
                    </div>
                    <Badge className="ingredient-category">{item.category}</Badge>
                    {item.description && (
                      <p className="ingredient-desc">{item.description}</p>
                    )}
                    {item.properties.length > 0 && (
                      <div className="ingredient-properties">
                        {item.properties.slice(0, 3).map((prop, index) => (
                          <span key={index} className="property-tag">
                            {prop.name}: {prop.value}{prop.unit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const getMockIngredients = (): IngredientData[] => [
  { id: '1', name: 'Astragalus', nameCn: '黄芪', category: '补益类', description: '补气升阳，固表止汗', properties: [{ name: '水分', value: '12.5', unit: '%' }] },
  { id: '2', name: 'Angelica', nameCn: '当归', category: '活血类', description: '补血活血，调经止痛', properties: [{ name: '水分', value: '11.8', unit: '%' }] },
  { id: '3', name: 'Codonopsis', nameCn: '党参', category: '补益类', description: '补中益气，健脾益肺', properties: [{ name: '水分', value: '13.2', unit: '%' }] },
  { id: '4', name: 'Lycium', nameCn: '枸杞子', category: '补益类', description: '滋补肝肾，益精明目', properties: [{ name: '水分', value: '12.0', unit: '%' }] },
  { id: '5', name: 'Honeysuckle', nameCn: '金银花', category: '清热类', description: '清热解毒，疏散风热', properties: [{ name: '水分', value: '10.5', unit: '%' }] },
  { id: '6', name: 'Forsythia', nameCn: '连翘', category: '清热类', description: '清热解毒，消肿散结', properties: [{ name: '水分', value: '9.8', unit: '%' }] },
  { id: '7', name: 'Dandelion', nameCn: '蒲公英', category: '清热类', description: '清热解毒，消肿散结', properties: [{ name: '水分', value: '11.2', unit: '%' }] },
  { id: '8', name: 'Atractylodes', nameCn: '白术', category: '补益类', description: '健脾益气，燥湿利水', properties: [{ name: '水分', value: '12.0', unit: '%' }] },
  { id: '9', name: 'Poria', nameCn: '茯苓', category: '利水类', description: '利水渗湿，健脾宁心', properties: [{ name: '水分', value: '14.5', unit: '%' }] },
  { id: '10', name: 'Dioscorea', nameCn: '山药', category: '补益类', description: '补脾养胃，生津益肺', properties: [{ name: '水分', value: '15.0', unit: '%' }] },
];