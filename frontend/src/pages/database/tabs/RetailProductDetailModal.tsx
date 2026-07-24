/**
 * 零售产品详情弹窗
 *
 * 展示 OpenFoodFacts 产品的完整信息：基本信息、营养成分、食品安全、分类标签等。
 */
import React from 'react';
import { Modal, Descriptions, Tag, Space, Collapse, Divider, Typography } from 'antd';
import {
  InfoCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  TagsOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

import { type RetailProductDetail } from '../../../api/searchNew';

interface RetailProductDetailModalProps {
  visible: boolean;
  product: RetailProductDetail | null;
  onClose: () => void;
}

const RetailProductDetailModal: React.FC<RetailProductDetailModalProps> = ({
  visible,
  product,
  onClose,
}) => {
  if (!product) return null;

  const nutrition = (product.key_ingredients as Record<string, unknown>)?.nutrition as
    | Record<string, unknown>
    | undefined;
  const novaGroup = (product.key_ingredients as Record<string, unknown>)?.nova_group as
    | number
    | undefined;
  const nutritionGrade = (product.key_ingredients as Record<string, unknown>)?.nutrition_grade as
    | string
    | undefined;
  const labels = (product.key_ingredients as Record<string, unknown>)?.labels as
    | string[]
    | undefined;
  const countries = (product.key_ingredients as Record<string, unknown>)?.countries as
    | string[]
    | undefined;
  const servingSize = (product.key_ingredients as Record<string, unknown>)?.serving_size as
    | string
    | undefined;

  const getEcoscoreColor = (grade?: string): string => {
    switch (grade) {
      case 'a': return 'green';
      case 'b': return 'cyan';
      case 'c': return 'blue';
      case 'd': return 'gold';
      default: return 'default';
    }
  };

  const renderNutritionTable = () => {
    if (!nutrition || Object.keys(nutrition).length === 0) return <Text type="secondary">暂无数据</Text>;

    const rows = Object.entries(nutrition as Record<string, number>).map(([key, value]) => ({
      label: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: `${Number(value ?? 0).toFixed(1)} g`,
    }));

    return (
      <Descriptions size="small" column={2} bordered>
        {rows.map((row) => (
          <Descriptions.Item key={row.label} label={row.label}>
            {row.value}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  return (
    <Modal
      title={product.product_name || '产品详情'}
      open={visible}
      onCancel={onClose}
      width={720}
      footer={null}
      destroyOnClose
    >
      {/* 头部信息 */}
      <div style={{ marginBottom: 16 }}>
        {product.image_urls && product.image_urls.length > 0 && (
          <img
            src={product.image_urls[0]}
            alt={product.product_name}
            style={{ maxWidth: 200, maxHeight: 150, objectFit: 'contain', marginBottom: 8 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Tag color="blue">{product.brand}</Tag>
            {product.category && <Tag>{product.category}</Tag>}
            {product.formulation_type && <Tag color="green">{product.formulation_type}</Tag>}
          </Space>
          {novaGroup && (
            <Tag color={novaGroup <= 2 ? 'green' : novaGroup <= 3 ? 'orange' : 'red'}>
              NOVA {novaGroup} ({novaGroup <= 2 ? '未加工' : novaGroup <= 3 ? '加工程度低' : '超加工食品'})
            </Tag>
          )}
          {nutritionGrade && (
            <Tag color={
              ['a', 'b'].includes(nutritionGrade) ? 'green' :
                ['c', 'd'].includes(nutritionGrade) ? 'orange' : 'default'
            }>
              营养等级: {nutritionGrade.toUpperCase()}
            </Tag>
          )}
          {product.ecoscore_grade && (
            <Tag color={getEcoscoreColor(product.ecoscore_grade)}>
              生态评分: {product.ecoscore_grade.toUpperCase()}
            </Tag>
          )}
        </Space>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 折叠面板 */}
      <Collapse defaultActiveKey={['basic', 'nutrition', 'safety']} style={{ background: 'transparent' }}>
        <Panel header={<><InfoCircleOutlined /> 基本信息</>} key="basic">
          <Descriptions size="small" column={1} bordered>
            {product.package_size && <Descriptions.Item label="规格">{product.package_size}</Descriptions.Item>}
            {product.volume_ml && <Descriptions.Item label="容量">{product.volume_ml} ml</Descriptions.Item>}
            {product.weight_g && <Descriptions.Item label="净重">{product.weight_g} g</Descriptions.Item>}
            {servingSize && <Descriptions.Item label="份量">{servingSize}</Descriptions.Item>}
            {product.price != null && <Descriptions.Item label="价格">{product.price} {product.currency}</Descriptions.Item>}
            {product.avg_rating && <Descriptions.Item label="评分">{Number(product.avg_rating).toFixed(1)}</Descriptions.Item>}
            {product.review_count != null && <Descriptions.Item label="评价数">{product.review_count}</Descriptions.Item>}
            {labels && labels.length > 0 && <Descriptions.Item label="认证标签">{labels.join(', ')}</Descriptions.Item>}
            {countries && countries.length > 0 && <Descriptions.Item label="销售地区">{countries.join(', ')}</Descriptions.Item>}
            {product.sales_channels && product.sales_channels.length > 0 && (
              <Descriptions.Item label="销售渠道">{product.sales_channels.join(', ')}</Descriptions.Item>
            )}
          </Descriptions>
        </Panel>

        <Panel header={<><FileTextOutlined /> 营养成分</>} key="nutrition">
          {renderNutritionTable()}
        </Panel>

        <Panel header={<><WarningOutlined /> 食品安全</>} key="safety">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {product.allergens_tags && product.allergens_tags.length > 0 && (
              <div>
                <Text strong>过敏原：</Text>
                <Space wrap>
                  {product.allergens_tags.map((tag) => (
                    <Tag key={tag} color="red">{tag}</Tag>
                  ))}
                </Space>
              </div>
            )}
            {product.additives_tags && product.additives_tags.length > 0 && (
              <div>
                <Text strong>添加剂：</Text>
                <Space wrap>
                  {product.additives_tags.map((tag) => (
                    <Tag key={tag} color="orange">{tag}</Tag>
                  ))}
                </Space>
              </div>
            )}
            {product.traces_tags && product.traces_tags.length > 0 && (
              <div>
                <Text strong>潜在交叉污染：</Text>
                <Space wrap>
                  {product.traces_tags.map((tag) => (
                    <Tag key={tag} color="volcano">{tag}</Tag>
                  ))}
                </Space>
              </div>
            )}
            {!product.allergens_tags?.length && !product.additives_tags?.length && !product.traces_tags?.length && (
              <Text type="secondary">无安全警告信息</Text>
            )}
          </Space>
        </Panel>

        <Panel header={<><TagsOutlined /> 成分表</>} key="ingredients">
          <Paragraph ellipsis={{ rows: 5, expandable: true }}>
            {product.full_ingredients || '暂无成分数据'}
          </Paragraph>
        </Panel>

        <Panel header={<><ShoppingCartOutlined /> 市场信息</>} key="market">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="数据来源">{product.source || 'openfoodfacts_api'}</Descriptions.Item>
            <Descriptions.Item label="数据质量">{product.data_quality ? `${(product.data_quality * 100).toFixed(0)}%` : '-'}</Descriptions.Item>
          </Descriptions>
        </Panel>
      </Collapse>
    </Modal>
  );
};

export default RetailProductDetailModal;
