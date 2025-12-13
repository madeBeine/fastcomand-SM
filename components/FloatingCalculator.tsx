
import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import QuickCalculator from './QuickCalculator';
import type { Currency, AppSettings } from '../types';

interface FloatingCalculatorProps {
    currencies: Currency[];
    settings: AppSettings;
}

const FloatingCalculator: React.FC<FloatingCalculatorProps> = ({ currencies, settings }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Floating Button - Positioned higher on mobile (bottom-24) to clear browser bars */}
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 left-4 md:bottom-8 md:left-6 z-[90] bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95 border-2 border-white dark:border-slate-800"
                title="الحاسبة السريعة"
            >
                <Calculator size={24} />
            </button>

            {/* Overlay Modal */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <QuickCalculator 
                        currencies={currencies} 
                        settings={settings} 
                        isFloating={true}
                        onClose={() => setIsOpen(false)}
                    />
                </div>
            )}
        </>
    );
};

export default FloatingCalculator;
