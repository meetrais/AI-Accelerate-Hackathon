import React from 'react';
import { format } from 'date-fns';
import { UserIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { ChatMessage as ChatMessageType } from '../../types';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isLoading = message.content === 'Thinking...' || message.content === 'Searching for flights...';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-2' : 'mr-2'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-primary-600 text-white' 
              : 'bg-gray-200 text-gray-600'
          }`}>
            {isUser ? (
              <UserIcon className="h-4 w-4" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
          </div>
        </div>

        {/* Message content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-2 rounded-lg max-w-full ${
            isUser
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}>
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="loading-dots">
                  <div className="loading-dot bg-gray-400"></div>
                  <div className="loading-dot bg-gray-400"></div>
                  <div className="loading-dot bg-gray-400"></div>
                </div>
                <span className="text-sm">{message.content}</span>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                {isUser ? (
                  <p className="text-white m-0">{message.content}</p>
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="m-0 text-gray-900">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside mt-2 mb-0 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mt-2 mb-0 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-gray-900">{children}</li>,
                      code: ({ children }) => (
                        <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {format(message.timestamp, 'HH:mm')}
          </div>
        </div>
      </div>
    </div>
  );
}