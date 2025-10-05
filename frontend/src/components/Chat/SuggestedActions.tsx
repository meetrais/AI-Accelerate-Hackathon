import React from 'react';
import { 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  TicketIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface SuggestedActionsProps {
  actions: string[];
  onActionClick: (action: string) => void;
}

export default function SuggestedActions({ actions, onActionClick }: SuggestedActionsProps) {
  const getActionIcon = (action: string) => {
    const lowerAction = action.toLowerCase();
    
    if (lowerAction.includes('search') || lowerAction.includes('find')) {
      return MagnifyingGlassIcon;
    }
    if (lowerAction.includes('filter') || lowerAction.includes('modify') || lowerAction.includes('change')) {
      return AdjustmentsHorizontalIcon;
    }
    if (lowerAction.includes('book') || lowerAction.includes('select')) {
      return TicketIcon;
    }
    return InformationCircleIcon;
  };

  const getActionColor = (action: string) => {
    const lowerAction = action.toLowerCase();
    
    if (lowerAction.includes('book') || lowerAction.includes('select')) {
      return 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100';
    }
    if (lowerAction.includes('search') || lowerAction.includes('find')) {
      return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
  };

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => {
        const Icon = getActionIcon(action);
        const colorClass = getActionColor(action);
        
        return (
          <button
            key={index}
            onClick={() => onActionClick(action)}
            className={`inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium border rounded-full transition-colors duration-200 ${colorClass}`}
          >
            <Icon className="h-3 w-3" />
            <span>{action}</span>
          </button>
        );
      })}
    </div>
  );
}