
import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, RotateCcw, Copy, Check, ChevronDown, ChevronUp, List, Share2 } from 'lucide-react';
import type { Currency, AppSettings } from '../types';
import { ShippingType } from '../types';

interface QuickCalculatorProps {
    currencies: Currency[];
    settings: AppSettings;
    isFloating?: boolean; // New prop to adjust styling for floating mode
    onClose?: () => void; // Optional close handler for floating mode
}

const QuickCalculator: React.FC<QuickCalculatorProps> = ({ currencies, settings, isFloating, onClose }) => {
    const [amount, setAmount] = useState<number | ''>('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>(settings.defaultCurrency || 'AED');
    const [weight, setWeight] = useState<number | ''>(0);
    const [shippingType, setShippingType] = useState<ShippingType>(ShippingType.NORMAL);
    const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
    const [commissionValue, setCommissionValue] = useState<number>(settings.commissionRate);
    const [copied, setCopied] = useState(false);
    
    // New States for Details
    const [showDetails, setShowDetails] = useState(false);
    const [detailsCopied, setDetailsCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Sync selected currency if default settings change (e.g., after loading)
    useEffect(() => {
        if (settings.defaultCurrency) {
            setSelectedCurrency(settings.defaultCurrency);
        }
    }, [settings.defaultCurrency]);

    // Find rate
    const currentCurrency = useMemo(() => currencies.find(c => c.code === selectedCurrency), [selectedCurrency, currencies]);
    const exchangeRate = currentCurrency ? currentCurrency.rate : 1; 

    // Calculate
    const results = useMemo(() => {
        const numAmount = typeof amount === 'number' ? amount : 0;
        const numWeight = typeof weight === 'number' ? weight : 0;
        
        // 1. Product Price in MRU
        const productMRU = numAmount * exchangeRate;
        
        // 2. Shipping Cost
        const shippingRate = shippingType === ShippingType.FAST ? settings.shippingRates.fast : settings.shippingRates.normal;
        const shippingCost = numWeight * shippingRate;

        // 3. Commission
        let commissionMRU = 0;
        if (commissionType === 'percentage') {
            commissionMRU = productMRU * (commissionValue / 100);
        } else {
            commissionMRU = commissionValue;
        }

        const totalMRU = Math.round(productMRU + shippingCost + commissionMRU);

        return { productMRU, shippingCost, commissionMRU, totalMRU };
    }, [amount, exchangeRate, weight, shippingType, settings.shippingRates, commissionType, commissionValue]);

    const handleCopy = () => {
        // Appended " MRU" to the copied text as requested
        navigator.clipboard.writeText(`${results.totalMRU} MRU`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyDetails = () => {
        const lines = [
            `تفاصيل الحساب:`,
            `----------------`,
            `سعر الصرف: 1 ${selectedCurrency} = ${exchangeRate} MRU`,
            `قيمة المنتج: ${amount || 0} ${selectedCurrency}`,
            `القيمة بالأوقية: ${Math.round(results.productMRU).toLocaleString()} MRU`
        ];

        if (results.shippingCost > 0) {
            lines.push(`الشحن (${weight || 0}kg - ${shippingType === ShippingType.FAST ? 'سريع' : 'عادي'}): ${Math.round(results.shippingCost).toLocaleString()} MRU`);
        }

        lines.push(`العمولة (${commissionType === 'percentage' ? commissionValue + '%' : 'ثابتة'}): ${Math.round(results.commissionMRU).toLocaleString()} MRU`);
        lines.push(`----------------`);
        lines.push(`المجموع النهائي: ${results.totalMRU.toLocaleString()} MRU`);

        const text = lines.join('\n');
        navigator.clipboard.writeText(text);
        setDetailsCopied(true);
        setTimeout(() => setDetailsCopied(false), 2000);
    };

    const handleShareLink = () => {
        // Use short link if provided in settings, otherwise use current full URL origin + /calculator
        const url = settings.calculatorShortLink || `${window.location.origin}/calculator`;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const handleReset = () => {
        setAmount('');
        setWeight(0);
        setCommissionType('percentage');
        setCommissionValue(settings.commissionRate);
        setSelectedCurrency(settings.defaultCurrency || 'AED');
        setShowDetails(false);
    };

    const containerClasses = isFloating 
        ? "bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 w-full max-w-sm mx-auto overflow-hidden transition-all duration-300" 
        : "bg-gradient-to-r from-blue-900 to-indigo-900 dark:from-slate-800 dark:to-slate-900 p-4 rounded-2xl shadow-lg text-white mb-6 border border-blue-800 dark:border-slate-700 transition-all duration-300";

    return (
        <div className={containerClasses} onClick={e => e.stopPropagation()}>
            <div className={`flex ${isFloating ? 'justify-between' : 'flex-col lg:flex-row'} gap-4 items-end mb-2`}>
                {/* Title */}
                <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    <div className="flex items-center gap-2 text-blue-200">
                        <Calculator size={20}/> 
                        <span className="font-bold">حاسبة الأسعار</span>
                    </div>
                    
                    <button 
                        onClick={handleShareLink} 
                        className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] text-blue-100 transition-colors"
                        title="نسخ رابط الحاسبة للعملاء"
                    >
                        {linkCopied ? <Check size={12} className="text-green-400"/> : <Share2 size={12}/>}
                        <span>{linkCopied ? 'تم النسخ' : 'رابط العملاء'}</span>
                    </button>
                </div>

                {isFloating && onClose && (
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-white/70">
                        ✕
                    </button>
                )}
            </div>

            {/* Inputs Row */}
            <div className={`grid ${isFloating ? 'grid-cols-1 gap-3' : 'grid-cols-2 md:grid-cols-4 gap-2'} flex-grow w-full`}>
                {/* Price */}
                <div>
                    <label className="text-[10px] text-blue-300 block mb-1">سعر المنتج</label>
                    <div className="flex">
                        <input 
                            type="number" 
                            value={amount} 
                            onChange={e => setAmount(parseFloat(e.target.value))} 
                            className="w-full bg-black/20 border border-white/10 rounded-r-lg p-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="0.00"
                        />
                        <select 
                            value={selectedCurrency} 
                            onChange={e => setSelectedCurrency(e.target.value)}
                            className="bg-black/40 border border-l-0 border-white/10 rounded-l-lg px-1 text-xs text-white focus:outline-none"
                        >
                            <option value="MRU">MRU</option>
                            {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                        </select>
                    </div>
                </div>

                {/* Weight & Type */}
                <div>
                    <label className="text-[10px] text-blue-300 block mb-1">الوزن والشحن</label>
                    <div className="flex">
                        <input 
                            type="number" 
                            value={weight} 
                            onChange={e => setWeight(parseFloat(e.target.value))} 
                            className="w-full bg-black/20 border border-white/10 rounded-r-lg p-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="KG"
                        />
                        <button 
                            onClick={() => setShippingType(prev => prev === ShippingType.NORMAL ? ShippingType.FAST : ShippingType.NORMAL)}
                            className={`px-2 text-[10px] font-bold rounded-l-lg border border-l-0 border-white/10 flex items-center justify-center min-w-[50px] transition-colors ${shippingType === ShippingType.FAST ? 'bg-red-500/80 text-white' : 'bg-blue-500/80 text-white'}`}
                        >
                            {shippingType === ShippingType.FAST ? 'سريع' : 'عادي'}
                        </button>
                    </div>
                </div>

                {/* Commission */}
                <div>
                    <label className="text-[10px] text-blue-300 block mb-1">العمولة</label>
                    <div className="flex">
                        <input 
                            type="number" 
                            value={commissionValue} 
                            onChange={e => setCommissionValue(parseFloat(e.target.value))} 
                            className="w-full bg-black/20 border border-white/10 rounded-r-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button 
                            onClick={() => setCommissionType(prev => prev === 'percentage' ? 'fixed' : 'percentage')}
                            className="px-2 text-[10px] font-bold bg-black/40 text-white rounded-l-lg border border-l-0 border-white/10 min-w-[40px]"
                        >
                            {commissionType === 'percentage' ? '%' : 'MRU'}
                        </button>
                    </div>
                </div>

                {/* Results Display (Mini) */}
                <div className="flex flex-col justify-end">
                    <div className="bg-black/30 rounded-lg p-2 flex justify-between items-center border border-white/10 h-[38px]">
                        <span className="text-xs font-bold text-yellow-400">الإجمالي:</span>
                        <span className="font-mono font-bold text-lg">{results.totalMRU.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Actions & Details Toggle */}
            <div className={`flex flex-col gap-2 ${isFloating ? 'mt-4' : 'mt-3 lg:mt-0 lg:border-t-0 lg:pt-0 pt-3 border-t border-white/10'}`}>
                
                <div className="flex justify-between items-center">
                    <button 
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-[10px] text-blue-300 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        {showDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        {showDetails ? 'إخفاء التفاصيل' : 'تفاصيل أكثر'}
                    </button>

                    <div className="flex gap-2">
                        <button onClick={handleReset} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors" title="تصفير">
                            <RotateCcw size={16}/>
                        </button>
                        <button onClick={handleCopy} className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2">
                            {copied ? <Check size={14}/> : <Copy size={14}/>}
                            <span>نسخ الإجمالي</span>
                        </button>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                {showDetails && (
                    <div className="mt-2 bg-black/40 rounded-xl border border-white/10 p-3 text-xs space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                            <span className="text-blue-200">سعر الصرف:</span>
                            <span className="font-mono text-white">1 {selectedCurrency} = {exchangeRate} MRU</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-blue-200">قيمة المنتج:</span>
                            <span className="font-mono text-white">{amount || 0} {selectedCurrency}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-blue-200">القيمة بالأوقية:</span>
                            <span className="font-mono text-white">{Math.round(results.productMRU).toLocaleString()} MRU</span>
                        </div>
                        {results.shippingCost > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-blue-200">الشحن ({weight || 0}kg):</span>
                                <span className="font-mono text-white">{Math.round(results.shippingCost).toLocaleString()} MRU</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                            <span className="text-blue-200">العمولة ({commissionType === 'percentage' ? commissionValue + '%' : 'ثابتة'}):</span>
                            <span className="font-mono text-white">{Math.round(results.commissionMRU).toLocaleString()} MRU</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span className="font-bold text-yellow-400">المجموع النهائي:</span>
                            <span className="font-bold font-mono text-yellow-400 text-sm">{results.totalMRU.toLocaleString()} MRU</span>
                        </div>
                        
                        <button 
                            onClick={handleCopyDetails}
                            className="w-full mt-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center gap-2 text-xs transition-colors"
                        >
                            {detailsCopied ? <Check size={14} className="text-green-400"/> : <List size={14}/>}
                            {detailsCopied ? 'تم نسخ التفاصيل' : 'نسخ التفاصيل كاملة'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickCalculator;