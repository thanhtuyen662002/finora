import React from 'react';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface DynamicIconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, size = 16, className, color }) => {
  const IconComponent = (LucideIcons as unknown as Record<string, LucideIcon>)[name] || LucideIcons.Circle;
  return <IconComponent size={size} className={className} color={color} />;
};
