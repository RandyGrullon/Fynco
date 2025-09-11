"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FormattedMessageProps {
  content: string;
  className?: string;
}

export function FormattedMessage({ content, className }: FormattedMessageProps) {
  // Función para procesar y formatear el texto
  const formatText = (text: string) => {
    // Dividir el texto en párrafos
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, index) => {
      const trimmedParagraph = paragraph.trim();
      
      // Detectar listas con viñetas (- o •)
      if (trimmedParagraph.includes('\n-') || trimmedParagraph.includes('\n•')) {
        const lines = trimmedParagraph.split('\n');
        const title = lines[0];
        const listItems = lines.slice(1).filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'));
        
        return (
          <div key={index} className="mb-4">
            {title && (
              <p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">
                {formatInlineText(title)}
              </p>
            )}
            <ul className="space-y-2 ml-2">
              {listItems.map((item, itemIndex) => (
                <li key={itemIndex} className="text-gray-700 dark:text-gray-200 flex items-start gap-3">
                  <span className="text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0 font-medium">•</span>
                  <span className="leading-relaxed">{formatInlineText(item.replace(/^[-•]\s*/, ''))}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      }
      
      // Detectar títulos (líneas que terminan en :)
      if (trimmedParagraph.endsWith(':') && trimmedParagraph.length < 100) {
        return (
          <h4 key={index} className="font-bold text-blue-800 dark:text-blue-200 mb-3 text-base border-l-3 border-blue-400 pl-3">
            {formatInlineText(trimmedParagraph)}
          </h4>
        );
      }
      
      // Detectar números al inicio (listas numeradas)
      if (/^\d+\./.test(trimmedParagraph)) {
        return (
          <div key={index} className="mb-4 flex gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
            <span className="font-bold text-blue-700 dark:text-blue-300 flex-shrink-0 text-base">
              {trimmedParagraph.match(/^\d+\./)?.[0]}
            </span>
            <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
              {formatInlineText(trimmedParagraph.replace(/^\d+\.\s*/, ''))}
            </p>
          </div>
        );
      }
      
      // Párrafo normal
      return (
        <p key={index} className="text-gray-700 dark:text-gray-200 leading-relaxed mb-4 last:mb-0">
          {formatInlineText(trimmedParagraph)}
        </p>
      );
    });
  };
  
  // Función para formatear texto en línea (negritas, cursivas, etc.)
  const formatInlineText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Buscar texto en negritas (**texto**)
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Agregar texto antes de la negrita
      if (match.index > currentIndex) {
        parts.push(text.slice(currentIndex, match.index));
      }
      
      // Agregar texto en negrita
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold text-blue-800 dark:text-blue-200 bg-blue-100/60 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-md">
          {match[1]}
        </strong>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Agregar el resto del texto
    if (currentIndex < text.length) {
      parts.push(text.slice(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };
  
  return (
    <div className={cn("text-sm", className)}>
      {formatText(content)}
    </div>
  );
}
