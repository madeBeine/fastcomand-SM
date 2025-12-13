
import React, { useState, useMemo } from 'react';
import type { Order, Client, Store, CompanyInfo, Currency } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { 
    Search, Printer, FileText, 
    AlertCircle, DollarSign, 
    Wallet, MessageCircle, Filter, PieChart, CheckCircle2, Clock
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import PrintLanguageModal, { PrintLanguage } from './PrintLanguageModal';
import { generateInvoiceHTML as generateHTML } from './BillingPage'; // Self-reference workaround not needed if logic is inside

// --- Helper Functions ---

export const generateInvoiceHTML = (
    title: string,
    order: Order,
    date: string,
    client: { name: string; phone: string; address?: string },
    company: CompanyInfo,
    store: Store,
    footerNote: string,
    lang: 'ar' | 'en' | 'fr'
) => {
    const isRtl = lang === 'ar';
    const alignLeft = isRtl ? 'right' : 'left';
    const alignRight = isRtl ? 'left' : 'right';

    // Calculate details
    const unitPrice = (order.priceInMRU || 0) / (order.quantity || 1);
    const commRateText = order.commissionType === 'percentage' ? `(${order.commissionRate}%)` : '';
    const totalLine = (order.priceInMRU || 0) + (order.commission || 0); // Price + Commission
    
    // Total calculation
    const subtotal = totalLine;
    const shipping = order.shippingCost || 0;
    const totalDue = subtotal + shipping;
    const paid = order.amountPaid || 0;
    const remaining = totalDue - paid;

    const logoHtml = company.logo 
        ? `<img src="${company.logo}" style="height: 80px; object-fit: contain; margin-bottom: 10px;" />` 
        : `<h1 style="margin: 0; font-size: 24px; color: #333;">${company.name}</h1>`;

    // Labels based on language
    const labels = {
        store: lang === 'ar' ? 'المتجر' : 'Store',
        globalId: lang === 'ar' ? 'رقم الطلب العالمي' : 'Global Order ID',
        qty: lang === 'ar' ? 'العدد' : 'Qty',
        orgPrice: lang === 'ar' ? `السعر (${order.currency})` : `Price (${order.currency})`,
        mruPrice: lang === 'ar' ? 'السعر (أوقية)' : 'Price (MRU)',
        comm: lang === 'ar' ? 'العمولة' : 'Commission',
        total: lang === 'ar' ? 'الإجمالي' : 'Total',
        shipping: lang === 'ar' ? 'الشحن' : 'Shipping',
        paid: lang === 'ar' ? 'المدفوع' : 'Paid',
        remaining: lang === 'ar' ? 'المتبقي' : 'Due',
        terms: lang === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions',
        desc: lang === 'ar' ? 'البيان' : 'Description'
    };

    return `
        <!DOCTYPE html>
        <html dir="${isRtl ? 'rtl' : 'ltr'}">
        <head>
            <meta charset="UTF-8">
            <title>${title} - ${order.localOrderId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                body { font-family: 'Cairo', sans-serif; padding: 40px; color: #333; max-width: 900px; margin: 0 auto; background: #fff; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                .company-info p { margin: 2px 0; font-size: 12px; color: #555; }
                .invoice-details { text-align: ${alignRight}; }
                .invoice-title { font-size: 24px; font-weight: bold; color: #000; text-transform: uppercase; margin: 0 0 5px 0; }
                .client-box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background-color: #f1f5f9; padding: 10px; font-size: 11px; font-weight: bold; border-bottom: 2px solid #ddd; text-align: center; white-space: nowrap; }
                td { padding: 10px; font-size: 12px; border-bottom: 1px solid #eee; text-align: center; }
                th:first-child, td:first-child { text-align: ${alignLeft}; }
                .totals { width: 280px; margin-${alignRight}: 0; margin-${alignLeft}: auto; }
                .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
                .totals-final { border-top: 2px solid #000; padding-top: 10px; margin-top: 5px; font-weight: bold; font-size: 16px; }
                .footer { text-align: center; margin-top: 50px; font-size: 10px; color: #777; border-top: 1px solid #eee; padding-top: 15px; }
                .terms { margin-top: 20px; font-size: 11px; color: #666; text-align: ${alignLeft}; white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-info">
                    ${logoHtml}
                    <p><strong>${company.name}</strong></p>
                    <p>${company.address}</p>
                    <p dir="ltr">${company.phone}</p>
                </div>
                <div class="invoice-details">
                    <h2 class="invoice-title">${title}</h2>
                    <p style="font-size: 16px; margin: 0; font-weight:bold;">#${order.localOrderId}</p>
                    <p style="font-size: 12px; color: #666;">Date: ${date}</p>
                </div>
            </div>

            <div class="client-box">
                <p style="margin: 0 0 5px 0; font-size: 10px; color: #666; text-transform: uppercase;">Bill To / إلى</p>
                <h3 style="margin: 0 0 5px 0; font-size: 16px;">${client.name}</h3>
                <p style="margin: 0; font-size: 12px;">${client.phone}</p>
                ${client.address ? `<p style="margin: 0; font-size: 12px;">${client.address}</p>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>${labels.desc}</th>
                        <th>${labels.globalId}</th>
                        <th>${labels.qty}</th>
                        <th>${labels.orgPrice}</th>
                        <th>${labels.mruPrice}</th>
                        <th>${labels.comm}</th>
                        <th>${labels.total}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${store.name}</td>
                        <td style="font-family: monospace;">${order.globalOrderId || '-'}</td>
                        <td>${order.quantity}</td>
                        <td>${order.price}</td>
                        <td>${Math.round(order.priceInMRU || 0).toLocaleString()}</td>
                        <td>${Math.round(order.commission || 0).toLocaleString()} <span style="font-size:9px">${commRateText}</span></td>
                        <td style="font-weight: bold;">${Math.round(totalLine).toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

            <div class="totals">
                <div class="totals-row">
                    <span>Subtotal / المجموع:</span>
                    <span>${Math.round(subtotal).toLocaleString()}</span>
                </div>
                ${shipping > 0 ? `
                <div class="totals-row">
                    <span>${labels.shipping} (${order.weight}kg):</span>
                    <span>${Math.round(shipping).toLocaleString()}</span>
                </div>
                ` : ''}
                <div class="totals-row" style="color: #166534;">
                    <span>${labels.paid}:</span>
                    <span>${Math.round(paid).toLocaleString()}</span>
                </div>
                <div class="totals-row totals-final">
                    <span>${labels.remaining}:</span>
                    <span>${Math.round(remaining).toLocaleString()} MRU</span>
                </div>
            </div>

            <div class="terms">
                <strong>${labels.terms}:</strong><br>
                ${company.invoiceTerms || ''}
            </div>

            <div class="footer">
                <p>${footerNote}</p>
                ${company.invoiceSignature ? `<p style="margin-top: 10px; font-weight: bold;">Authorized by: ${company.invoiceSignature}</p>` : ''}
            </div>
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
    `;
};

const shareInvoiceOnWhatsApp = (order: Order, client: Client | undefined, store: Store | undefined, company: CompanyInfo, lang: PrintLanguage = 'ar') => {
    const total = (order.priceInMRU || 0) + (order.commission || 0);
    const shipping = order.shippingCost || 0;
    const grandTotal = total + shipping;
    const paid = order.amountPaid || 0;
    const remaining = grandTotal - paid;

    let message = '';

    if (lang === 'ar') {
        message = `
*${company.name} - فاتورة*
------------------------
*رقم الطلب:* ${order.localOrderId}
*العميل:* ${client?.name || '---'}
------------------------
*المتجر:* ${store?.name || '---'}
*رقم الطلب العالمي:* ${order.globalOrderId || '---'}
*العدد:* ${order.quantity}
*السعر الأصلي:* ${order.price} ${order.currency}
*السعر (أوقية):* ${Math.round(order.priceInMRU || 0)}
*العمولة:* ${Math.round(order.commission || 0)}
------------------------
*المجموع:* ${Math.round(total)} MRU
*الشحن:* ${Math.round(shipping)} MRU
------------------------
*الإجمالي المستحق:* ${Math.round(remaining)} MRU
------------------------
${company.invoiceTerms || ''}
`.trim();
    } else {
        message = `
*${company.name} - Invoice*
------------------------
*Order ID:* ${order.localOrderId}
*Client:* ${client?.name || '---'}
------------------------
*Store:* ${store?.name || '---'}
*Global ID:* ${order.globalOrderId || '---'}
*Qty:* ${order.quantity}
*Original Price:* ${order.price} ${order.currency}
*Price (MRU):* ${Math.round(order.priceInMRU || 0)}
*Commission:* ${Math.round(order.commission || 0)}
------------------------
*Subtotal:* ${Math.round(total)} MRU
*Shipping:* ${Math.round(shipping)} MRU
------------------------
*Total Due:* ${Math.round(remaining)} MRU
------------------------
`.trim();
    }

    const url = `https://wa.me/${client?.phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
};

// --- Main Component ---

interface BillingPageProps {
  orders: Order[];
  clients: Client[];
  stores: Store[];
  currencies: Currency[];
  companyInfo: CompanyInfo;
  settings: any;
}

type PaymentFilter = 'all' | 'paid' | 'partial' | 'unpaid';

const BillingPage: React.FC<BillingPageProps> = ({ orders, clients, stores, companyInfo }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
    const { showToast } = useToast();
    const [printOrder, setPrintOrder] = useState<Order | null>(null);

    // 1. Filter Orders: Include everything that is NOT new or cancelled
    //    We want to show invoices for Ordered, Shipped, Arrived, Stored, and Completed.
    const relevantOrders = useMemo(() => {
        return orders.filter(o => 
            o.status !== OrderStatus.NEW && 
            o.status !== OrderStatus.CANCELLED
        ).sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }, [orders]);

    // 2. Enhance Orders with Financial Status
    const enhancedOrders = useMemo(() => {
        return relevantOrders.map(order => {
            const productTotal = (order.priceInMRU || 0) + (order.commission || 0);
            const shipping = order.shippingCost || 0;
            const grandTotal = productTotal + shipping;
            const paid = order.amountPaid || 0;
            const remaining = grandTotal - paid;
            
            let paymentStatus: PaymentFilter = 'unpaid';
            if (remaining <= 0 && grandTotal > 0) paymentStatus = 'paid';
            else if (paid > 0 && remaining > 0) paymentStatus = 'partial';
            else paymentStatus = 'unpaid';

            return { ...order, grandTotal, paid, remaining, paymentStatus };
        });
    }, [relevantOrders]);

    // 3. Apply Filters (Search + Payment Tab)
    const filteredOrders = useMemo(() => {
        return enhancedOrders.filter(o => {
            const matchesSearch = 
                o.localOrderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                clients.find(c => c.id === o.clientId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesTab = paymentFilter === 'all' || o.paymentStatus === paymentFilter;

            return matchesSearch && matchesTab;
        });
    }, [enhancedOrders, searchTerm, paymentFilter, clients]);

    // 4. Calculate Stats (Based on ALL relevant orders, not just filtered view for accuracy)
    const stats = useMemo(() => {
        return enhancedOrders.reduce((acc, curr) => {
            acc.totalRevenue += curr.grandTotal;
            acc.totalCollected += curr.paid;
            acc.totalOutstanding += Math.max(0, curr.remaining);
            if (curr.paymentStatus === 'paid') acc.countPaid++;
            else if (curr.paymentStatus === 'partial') acc.countPartial++;
            else acc.countUnpaid++;
            return acc;
        }, { totalRevenue: 0, totalCollected: 0, totalOutstanding: 0, countPaid: 0, countPartial: 0, countUnpaid: 0 });
    }, [enhancedOrders]);

    const collectionRate = stats.totalRevenue > 0 
        ? Math.round((stats.totalCollected / stats.totalRevenue) * 100) 
        : 0;

    const handlePrint = (order: Order, lang: PrintLanguage) => {
        const client = clients.find(c => c.id === order.clientId) || { id: '', name: 'Unknown', phone: '' };
        const store = stores.find(s => s.id === order.storeId) || { id: '', name: '', estimatedDeliveryDays: 0 };
        
        const html = generateInvoiceHTML(
            lang === 'ar' ? 'فاتورة' : 'Invoice',
            order,
            new Date(order.orderDate).toLocaleDateString('en-GB'),
            client,
            companyInfo,
            store,
            lang === 'ar' ? 'شكراً لتعاملكم معنا' : 'Thank you for your business',
            lang
        );

        const win = window.open('', '_blank', 'width=900,height=800');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            showToast('يرجى السماح بالنوافذ المنبثقة', 'error');
        }
        setPrintOrder(null);
    };

    const handleShare = (order: Order, lang: PrintLanguage) => {
        const client = clients.find(c => c.id === order.clientId);
        const store = stores.find(s => s.id === order.storeId);
        shareInvoiceOnWhatsApp(order, client, store, companyInfo, lang);
        setPrintOrder(null);
    }

    return (
        <div className="space-y-6">
            <PrintLanguageModal 
                isOpen={!!printOrder}
                onClose={() => setPrintOrder(null)}
                onConfirm={(lang) => printOrder && handlePrint(printOrder, lang)}
                onShare={(lang) => printOrder && handleShare(printOrder, lang)}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">الفوترة والتقارير المالية</h2>
                <div className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    {enhancedOrders.length} فاتورة نشطة
                </div>
            </div>

            {/* Smart Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">إجمالي المستحقات</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={18}/></div>
                    </div>
                    <p className="text-2xl font-black font-mono text-gray-800 dark:text-white">{stats.totalRevenue.toLocaleString()}</p>
                    <span className="text-xs text-gray-400">القيمة الكلية للفواتير</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">المحصل الفعلي</span>
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Wallet size={18}/></div>
                    </div>
                    <p className="text-2xl font-black font-mono text-green-600">{stats.totalCollected.toLocaleString()}</p>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-green-500 h-full" style={{width: `${collectionRate}%`}}></div>
                    </div>
                    <span className="text-[10px] text-green-600 font-bold mt-1 block">{collectionRate}% نسبة التحصيل</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">الديون المتبقية</span>
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertCircle size={18}/></div>
                    </div>
                    <p className="text-2xl font-black font-mono text-red-600">{stats.totalOutstanding.toLocaleString()}</p>
                    <span className="text-xs text-gray-400">مبالغ لم يتم سدادها بعد</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">توزيع الفواتير</span>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><PieChart size={18}/></div>
                    </div>
                    <div className="flex justify-between text-xs font-semibold mt-2">
                        <span className="text-green-600">{stats.countPaid} مكتمل</span>
                        <span className="text-orange-500">{stats.countPartial} جزئي</span>
                        <span className="text-red-500">{stats.countUnpaid} غير مدفوع</span>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                
                {/* Controls */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-900/20">
                    <div className="flex gap-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-xl w-full lg:w-auto overflow-x-auto">
                        {(['all', 'paid', 'partial', 'unpaid'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setPaymentFilter(filter)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                                    paymentFilter === filter 
                                    ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' 
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                            >
                                {filter === 'all' && 'الكل'}
                                {filter === 'paid' && 'مدفوع كلياً'}
                                {filter === 'partial' && 'جزئي'}
                                {filter === 'unpaid' && 'غير مدفوع'}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full lg:w-80">
                        <input 
                            type="text" 
                            placeholder="بحث برقم الفاتورة أو العميل..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border-none rounded-xl bg-white dark:bg-gray-700 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600 focus:ring-2 focus:ring-primary text-gray-700 dark:text-gray-200"
                        />
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                </div>
                
                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-bold border-b dark:border-gray-700">
                            <tr>
                                <th className="p-4">رقم الطلب</th>
                                <th className="p-4">العميل</th>
                                <th className="p-4 text-center">حالة الطلب</th>
                                <th className="p-4 text-center">حالة الدفع</th>
                                <th className="p-4">الإجمالي</th>
                                <th className="p-4">المدفوع</th>
                                <th className="p-4">المتبقي</th>
                                <th className="p-4 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredOrders.length > 0 ? filteredOrders.map(order => {
                                const client = clients.find(c => c.id === order.clientId);
                                const progress = Math.min(100, (order.paid / order.grandTotal) * 100);
                                
                                let statusBadgeClass = '';
                                let statusText = '';
                                switch(order.status) {
                                    case OrderStatus.ORDERED: statusBadgeClass = 'bg-purple-100 text-purple-700'; statusText = 'تم الطلب'; break;
                                    case OrderStatus.SHIPPED_FROM_STORE: statusBadgeClass = 'bg-indigo-100 text-indigo-700'; statusText = 'تم الشحن'; break;
                                    case OrderStatus.ARRIVED_AT_OFFICE: statusBadgeClass = 'bg-pink-100 text-pink-700'; statusText = 'وصل المكتب'; break;
                                    case OrderStatus.STORED: statusBadgeClass = 'bg-blue-100 text-blue-700'; statusText = 'بالمخزن'; break;
                                    case OrderStatus.COMPLETED: statusBadgeClass = 'bg-green-100 text-green-700'; statusText = 'مكتمل'; break;
                                    default: statusBadgeClass = 'bg-gray-100 text-gray-700'; statusText = 'قيد المعالجة';
                                }

                                return (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                        <td className="p-4">
                                            <span className="font-mono font-bold text-base text-primary block">{order.localOrderId}</span>
                                            <span className="text-xs text-gray-400 font-mono">{new Date(order.orderDate).toLocaleDateString()}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-gray-700 dark:text-gray-200 block">{client?.name || '---'}</span>
                                            <span className="text-xs text-gray-400 font-mono">{client?.phone}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${statusBadgeClass}`}>{statusText}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1">
                                                {order.paymentStatus === 'paid' && <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> مدفوع</span>}
                                                {order.paymentStatus === 'partial' && <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><Clock size={12}/> جزئي</span>}
                                                {order.paymentStatus === 'unpaid' && <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle size={12}/> غير مدفوع</span>}
                                                
                                                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className={`h-full ${order.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-orange-400'}`} style={{width: `${progress}%`}}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono font-bold">{Math.round(order.grandTotal).toLocaleString()}</td>
                                        <td className="p-4 font-mono text-green-600">{Math.round(order.paid).toLocaleString()}</td>
                                        <td className={`p-4 font-mono font-bold ${order.remaining > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {Math.round(order.remaining).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleShare(order, 'ar')}
                                                    className="p-2 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                                                    title="إرسال واتساب"
                                                >
                                                    <MessageCircle size={16}/>
                                                </button>
                                                <button 
                                                    onClick={() => setPrintOrder(order)}
                                                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                                    title="طباعة"
                                                >
                                                    <Printer size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-gray-400">
                                        <FileText size={48} className="mx-auto mb-2 opacity-20"/>
                                        <p>لا توجد فواتير مطابقة للبحث</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BillingPage;
