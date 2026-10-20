/**
 * Token 可视化文档页面
 * 显示所有设计 token 的可视化预览
 */

import React from 'react';
import { TokenGallery } from '@/components/TokenGallery';

const TokenDocumentation: React.FC = () => {
  return (
    <div className="min-h-screen">
      <TokenGallery />
    </div>
  );
};

export default TokenDocumentation;
