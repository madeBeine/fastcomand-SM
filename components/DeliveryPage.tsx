
import React, { useState, useMemo, useContext, useEffect } from 'react';
import type { Order, Client, ActivityLog, Store, CompanyInfo } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { 
    Search, Upload, Check, User, Wallet, 
    Loader2, Store as StoreIcon, 
    ArrowRight, PackageCheck, CheckCircle2, ChevronLeft, Printer, AlertCircle, X, Plus
} from 'lucide-react';
import { supabase, getErrorMessage } from '../supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { STATUS_DETAILS } from '../constants';

interface DeliveryPageProps {
  orders: Order[];
  clients: Client[];
  stores: Store[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  companyInfo: CompanyInfo;
}

// --- Helper: Compress Image ---
const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async (event) => {
            if (!event.target?.result) return reject("Failed to read file");
            
            const originalBase64 = event.target.result as string;
            const img = new Image();
            img.src = originalBase64;
            
            try {
                await img.decode();
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas context failed");

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            } catch (e) {
                resolve(originalBase64);
            }
        };
        reader.onerror = (err) => reject(err);
    });
};

const DeliveryPage: React.FC<DeliveryPageProps> = ({ orders, clients, stores, setOrders, companyInfo }) => {
  const { currentUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [receiptImages, setReceiptImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const activeClients = useMemo(() => {
      const relevantOrders = orders.filter(o => 
          o.status !== OrderStatus.CANCELLED && 
          o.status !== OrderStatus.NEW &&
          o.status !== OrderStatus.COMPLETED
      );
      
      const lowerTerm = searchTerm.toLowerCase();

      const clientIds = Array.from(new Set(relevantOrders.map(o => o.clientId)));
      
      const clientsList = clientIds.map(id => {
          const client = clients.find(c => c.id === id);
          if (!client) return null;
          
          const clientOrders = relevantOrders.filter(o => o.clientId === id);
          const readyCount = clientOrders.filter(o => o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE).length;

          const nameMatch = client.name.toLowerCase().includes(lowerTerm);
          const phoneMatch = client.phone.includes(lowerTerm);
          const orderMatch = clientOrders.some(o => o.localOrderId.toLowerCase().includes(lowerTerm));

          if (!searchTerm || nameMatch || phoneMatch || orderMatch) {
              return { ...client, readyCount };
          }
          return null;
      }).filter(Boolean) as (Client & { readyCount: number })[];

      return clientsList.sort((a, b) => b.readyCount - a.readyCount);
  }, [orders, clients, searchTerm]);

  const clientOrders = useMemo(() => {
      if (!selectedClient) return [];
      return orders.filter(o => 
          o.clientId === selectedClient.id && 
          o.status !== OrderStatus.CANCELLED && 
          o.status !== OrderStatus.NEW &&
          o.status !== OrderStatus.COMPLETED
      ).sort((a, b) => {
          const aReady = a.status === OrderStatus.STORED || a.status === OrderStatus.ARRIVED_AT_OFFICE;
          const bReady = b.status === OrderStatus.STORED || b.status === OrderStatus.ARRIVED_AT_OFFICE;
          if (aReady && !bReady) return -1;
          if (!aReady && bReady) return 1;
          return 0;
      });
  }, [selectedClient, orders]);

  useEffect(() => {
      if (selectedClient && clientOrders.length > 0) {
          const readyIds = clientOrders
            .filter(o => (o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE) && (o.weight || 0) > 0)
            .map(o => o.id);
          setSelectedOrderIds(new Set(readyIds));
      } else {
          setSelectedOrderIds(new Set());
      }
      setReceiptImages([]);
  }, [selectedClient, clientOrders]);

  const handleToggleOrder = (orderId: string, hasWeight: boolean) => {
      if (!hasWeight) return; 
      
      setSelectedOrderIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(orderId)) newSet.delete(orderId);
          else newSet.add(orderId);
          return newSet;
      });
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        if (receiptImages.length + e.target.files.length > 3) {
            showToast("لا يمكن إضافة أكثر من 3 صور.", "warning");
            return;
        }

        setIsProcessingImages(true);
        const files = Array.from(e.target.files) as File[];
        
        try {
            const compressedImages = await Promise.all(files.map(file => compressImage(file)));
            setReceiptImages(prev => [...prev, ...compressedImages]);
        } catch (error) {
            console.error("Error compressing images", error);
        } finally {
            setIsProcessingImages(false);
        }
    }
  };

  const removeReceipt = (index: number) => {
      setReceiptImages(prev => prev.filter((_, i) => i !== index));
  };

  const totals = useMemo(() => {
      const selected = clientOrders.filter(o => selectedOrderIds.has(o.id));
      return selected.reduce((acc, order) => {
          const totalVal = (order.priceInMRU || 0) + (order.commission || 0);
          const paid = order.amountPaid || 0;
          const shipping = order.shippingCost || 0;
          const remainingProduct = Math.max(0, totalVal - paid);
          const totalDue = remainingProduct + shipping;

          acc.productRemaining += remainingProduct;
          acc.totalShipping += shipping;
          acc.totalDue += totalDue;
          return acc;
      }, { productRemaining: 0, totalShipping: 0, totalDue: 0 });
  }, [clientOrders, selectedOrderIds]);

  const handleConfirmDelivery = async () => {
      if (selectedOrderIds.size === 0) {
          showToast('يرجى تحديد طلب واحد على الأقل.', 'warning');
          return;
      }
      if (receiptImages.length === 0) {
          showToast('يرجى إرفاق صورة إيصال واحدة على الأقل.', 'warning');
          return;
      }

      setIsSubmitting(true);
      const now = new Date().toISOString();
      const user = currentUser?.username || 'System';

      try {
          const updates = Array.from(selectedOrderIds).map(id => {
              const order = orders.find(o => o.id === id);
              if(!order) return null;
              
              const newLog: ActivityLog = {
                  timestamp: now,
                  activity: `تم تسليم الطلب للعميل.`,
                  user
              };

              return {
                  id,
                  dbPayload: {
                      status: OrderStatus.COMPLETED,
                      receipt_images: receiptImages, // Save all images
                      receipt_image: receiptImages[0], // Save first as fallback
                      withdrawal_date: now,
                      history: [...(order.history || []), newLog]
                  },
                  localPayload: {
                      status: OrderStatus.COMPLETED,
                      receiptImages: receiptImages,
                      receiptImage: receiptImages[0],
                      withdrawalDate: now,
                      history: [...(order.history || []), newLog]
                  },
                  orderId: order.localOrderId
              };
          }).filter(Boolean);

          if (supabase) {
              for (const u of updates) {
                  if (u) {
                      await (supabase.from('Orders') as any).update(u.dbPayload).eq('id', u.id);
                  }
              }
              
              const logEntry = {
                  timestamp: now,
                  user,
                  action: 'Delivery',
                  entity_type: 'Order',
                  entity_id: updates.map(u => u!.id).join(','),
                  details: `Delivered ${updates.length} orders to ${selectedClient?.name}. IDs: ${updates.map(u => u!.orderId).join(', ')}`
              };
              await (supabase.from('GlobalActivityLog') as any).insert(logEntry);
          }

          setOrders(prev => prev.map(o => {
              const update = updates.find(u => u!.id === o.id);
              return update ? { ...o, ...update.localPayload } : o;
          }));

          showToast('تم تأكيد التسليم وحفظ الإيصالات بنجاح!', 'success');
          setSelectedClient(null); 
          
      } catch (e: any) {
          console.error(e);
          showToast('حدث خطأ: ' + getErrorMessage(e), 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handlePrintInvoice = () => {
      if (selectedOrderIds.size === 0 || !selectedClient) return;

      const printWindow = window.open('', 'Print Invoice', 'width=900,height=800');
      if (!printWindow) {
          showToast("يرجى السماح بالنوافذ المنبثقة.", "error");
          return;
      }

      const selectedOrders = clientOrders.filter(o => selectedOrderIds.has(o.id));
      const today = new Date().toLocaleDateString('en-GB');

      const itemsHtml = selectedOrders.map((order, index) => {
          const storeName = stores.find(s => s.id === order.storeId)?.name || '---';
          const productPrice = (order.priceInMRU || 0) + (order.commission || 0);
          const paid = order.amountPaid || 0;
          const remainingProduct = Math.max(0, productPrice - paid);
          const shipping = order.shippingCost || 0;
          const total = remainingProduct + shipping;
          const shippingType = order.shippingType === ShippingType.FAST ? 'سريع' : 'عادي';

          return `
            <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9f9f9'};">
                <td style="padding: 5px; border-bottom: 1px solid #ddd; font-weight:bold;">${order.localOrderId}<br><span style="font-size:10px; font-weight:normal; color:#666">${order.orderDate}</span></td>
                <td style="padding: 5px; border-bottom: 1px solid #ddd;">${storeName}</td>
                <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: center;">${order.storageLocation || '-'}</td>
                <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: center;">${order.weight || 0} kg <br> <span style="font-size:10px; color:#555">(${shippingType})</span></td>
                <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: center;">${Math.round(shipping).toLocaleString()}</td>
                <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: center;">${Math.round(remainingProduct).toLocaleString()}</td>
                <td style="padding: 5px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; color: #000;">${Math.round(total).toLocaleString()}</td>
            </tr>
          `;
      }).join('');

      const logoHtml = companyInfo.logo 
        ? `<img src="${companyInfo.logo}" style="height: 60px; object-fit: contain; margin-bottom: 5px;" />` 
        : `<h1 style="margin: 0; font-size: 20px;">${companyInfo.name}</h1>`;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>فاتورة تسليم - ${selectedClient.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                body { font-family: 'Cairo', sans-serif; padding: 15px; font-size: 11px; color: #333; max-width: 800px; margin: 0 auto; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                .company-details p { margin: 2px 0; font-size: 10px; }
                .invoice-title { text-align: center; margin: 0; font-size: 16px; font-weight: bold; text-transform: uppercase; }
                .client-box { border: 1px solid #ddd; padding: 8px; border-radius: 5px; margin-bottom: 15px; background: #fdfdfd; display: flex; justify-content: space-between; }
                table.items { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                table.items th { background-color: #f3f4f6; border-bottom: 2px solid #aaa; padding: 6px; font-size: 10px; font-weight: bold; text-align: center; }
                table.items td { padding: 5px; font-size: 11px; }
                .totals { float: left; width: 200px; border: 1px solid #ddd; padding: 8px; background: #f9f9f9; border-radius: 5px; }
                .totals div { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
                .total-final { font-weight: bold; font-size: 13px; border-top: 1px solid #ccc; padding-top: 4px; margin-top: 4px; }
                .footer { clear: both; margin-top: 30px; text-align: center; font-size: 9px; border-top: 1px solid #eee; padding-top: 10px; color: #666; }
                @media print { 
                    .no-print { display: none; } 
                    body { padding: 0; margin: 0; width: 100%; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-details">
                    ${logoHtml}
                    <p><strong>${companyInfo.name}</strong></p>
                    <p>${companyInfo.address}</p>
                    <p dir="ltr">${companyInfo.phone}</p>
                </div>
                <div style="text-align: left;">
                    <h2 class="invoice-title">فاتورة تسليم</h2>
                    <p style="margin:5px 0 0;">التاريخ: ${today}</p>
                </div>
            </div>

            <div class="client-box">
                <div>
                    <strong>العميل:</strong> ${selectedClient.name}
                </div>
                <div dir="ltr">
                    <strong>Tel:</strong> ${selectedClient.phone}
                </div>
            </div>

            <table class="items">
                <thead>
                    <tr>
                        <th style="text-align: right;">الطلب / التاريخ</th>
                        <th>المتجر</th>
                        <th>المكان</th>
                        <th>الوزن / النوع</th>
                        <th>الشحن</th>
                        <th>المتبقي</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="totals">
                <div><span>إجمالي الشحن:</span> <span>${Math.round(totals.totalShipping).toLocaleString()}</span></div>
                <div><span>إجمالي متبقي:</span> <span>${Math.round(totals.productRemaining).toLocaleString()}</span></div>
                <div class="total-final"><span>المستحق:</span> <span>${Math.round(totals.totalDue).toLocaleString()} MRU</span></div>
            </div>

            <div class="footer">
                <p>شكراً لتعاملكم معنا. ${companyInfo.invoiceTerms || ''}</p>
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 overflow-hidden">
        
        <div className={`w-full md:w-1/3 bg-content-light dark:bg-content-dark rounded-2xl shadow-lg flex flex-col overflow-hidden transition-all duration-300 ${selectedClient ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-5 border-b dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-white">
                    <PackageCheck className="text-primary"/> تسليم الطلبات
                </h2>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="ابحث عن عميل، هاتف، أو رقم طلب..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700/50 border-none rounded-xl focus:ring-2 focus:ring-primary text-gray-700 dark:text-gray-200"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-3 space-y-2">
                {activeClients.length > 0 ? activeClients.map(client => (
                    <button 
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 group
                            ${selectedClient?.id === client.id 
                                ? 'bg-primary text-white shadow-md transform scale-[1.02]' 
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-gray-100 dark:border-gray-700'
                            }
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${selectedClient?.id === client.id ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                                {client.name.charAt(0)}
                            </div>
                            <div className="text-right">
                                <p className={`font-bold text-sm ${selectedClient?.id === client.id ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{client.name}</p>
                                <p className={`text-xs font-mono ${selectedClient?.id === client.id ? 'text-white/80' : 'text-gray-500'}`}>{client.phone}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {client.readyCount > 0 && (
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${selectedClient?.id === client.id ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                    {client.readyCount} جاهز
                                </span>
                            )}
                            <ChevronLeft size={16} className={`transition-transform ${selectedClient?.id === client.id ? 'text-white translate-x-[-2px]' : 'text-gray-300 group-hover:text-primary'}`} />
                        </div>
                    </button>
                )) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <PackageCheck size={48} className="mb-4 opacity-20"/>
                        <p>لا توجد طلبات نشطة</p>
                    </div>
                )}
            </div>
        </div>

        <div className={`flex-grow flex flex-col md:flex-row gap-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl overflow-hidden transition-all duration-300 ${!selectedClient ? 'hidden md:flex opacity-50 pointer-events-none' : 'flex'}`}>
            
            {selectedClient ? (
                <>
                    <div className="flex-grow flex flex-col h-full bg-content-light dark:bg-content-dark md:rounded-2xl shadow-lg">
                        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedClient(null)} className="md:hidden p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                    <ArrowRight size={20}/>
                                </button>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">{selectedClient.name}</h3>
                                    <p className="text-xs text-gray-500">{clientOrders.length} طلبات (الكل)</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    const readyIds = clientOrders
                                        .filter(o => (o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE) && (o.weight || 0) > 0)
                                        .map(o => o.id);
                                    
                                    if (selectedOrderIds.size === readyIds.length) {
                                        setSelectedOrderIds(new Set());
                                    } else {
                                        setSelectedOrderIds(new Set(readyIds));
                                    }
                                }}
                                className="text-xs font-bold text-primary hover:underline"
                            >
                                تحديد كل الجاهز (مع الوزن)
                            </button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 space-y-3">
                            {clientOrders.map(order => {
                                const isStored = order.status === OrderStatus.STORED;
                                const isArrivedOffice = order.status === OrderStatus.ARRIVED_AT_OFFICE;
                                const isReady = isStored || isArrivedOffice;
                                const hasWeight = (order.weight || 0) > 0;
                                const isSelected = selectedOrderIds.has(order.id);
                                const store = stores.find(s => s.id === order.storeId);
                                const remaining = Math.max(0, ((order.priceInMRU||0) + (order.commission||0)) - (order.amountPaid||0));
                                const statusName = STATUS_DETAILS[order.status]?.name || order.status;
                                
                                let containerClasses = "";
                                if (!isReady) {
                                    containerClasses = "bg-gray-100 dark:bg-gray-800 border-dashed border-gray-300 dark:border-gray-700 opacity-60 pointer-events-none";
                                } else if (!hasWeight) {
                                    containerClasses = "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 cursor-not-allowed opacity-80";
                                } else if (isSelected) {
                                    containerClasses = "border-primary bg-primary/5 dark:bg-primary/10 cursor-pointer";
                                } else {
                                    if (isArrivedOffice) {
                                        containerClasses = "border-purple-200 bg-purple-50 dark:bg-purple-900/10 dark:border-purple-800 hover:border-purple-400 cursor-pointer";
                                    } else {
                                        containerClasses = "border-transparent bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700 shadow-sm cursor-pointer";
                                    }
                                }

                                return (
                                    <div 
                                        key={order.id} 
                                        onClick={() => isReady && handleToggleOrder(order.id, hasWeight)}
                                        className={`relative p-4 rounded-xl border-2 transition-all flex flex-col gap-2 group ${containerClasses}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'} ${!isReady || !hasWeight ? 'bg-gray-200 dark:bg-gray-700 border-none' : ''}`}>
                                                    {isSelected && <Check size={14} className="text-white"/>}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-lg font-mono tracking-tight text-gray-800 dark:text-gray-200">
                                                        {order.localOrderId}
                                                        {!isReady && <span className="mr-2 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 font-sans">{statusName}</span>}
                                                        {isArrivedOffice && <span className="mr-2 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded font-sans">وصل المكتب</span>}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <StoreIcon size={10}/> {store?.name}
                                                    </p>
                                                </div>
                                            </div>
                                            {isReady && !hasWeight ? (
                                                <span className="text-xs text-red-600 font-bold bg-red-100 px-2 py-1 rounded flex items-center gap-1">
                                                    <AlertCircle size={12}/> يجب تحديد الوزن
                                                </span>
                                            ) : isStored ? (
                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1">
                                                    {order.storageLocation || 'غير محدد'}
                                                </span>
                                            ) : isArrivedOffice ? (
                                                <span className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                    <CheckCircle2 size={10}/> بانتظار التخزين
                                                </span>
                                            ) : (
                                                <span className="text-xs text-orange-500 flex items-center gap-1">
                                                    وصول متوقع: {order.expectedArrivalDate}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <div className="bg-white dark:bg-gray-700/50 p-2 rounded border border-gray-100 dark:border-gray-700/50">
                                                <span className="text-[10px] text-gray-400 block">شحن ({order.weight || 0}kg)</span>
                                                <span className="text-sm font-bold font-mono">{(order.shippingCost||0).toLocaleString('en-US')} MRU</span>
                                            </div>
                                            <div className="bg-white dark:bg-gray-700/50 p-2 rounded border border-gray-100 dark:border-gray-700/50">
                                                <span className="text-[10px] text-gray-400 block">متبقي السعر</span>
                                                <span className={`text-sm font-bold font-mono ${remaining > 0 ? 'text-red-500' : 'text-green-500'}`}>{remaining.toLocaleString('en-US')} MRU</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="w-full md:w-80 bg-white dark:bg-gray-800 md:rounded-2xl shadow-lg p-5 flex flex-col border-l dark:border-gray-700">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                            <Wallet className="text-primary"/> ملخص الدفع
                        </h3>

                        <div className="space-y-3 mb-6 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">عدد الطلبات</span>
                                <span className="font-bold font-mono">{selectedOrderIds.size}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">إجمالي الشحن</span>
                                <span className="font-bold font-mono">{Math.round(totals.totalShipping).toLocaleString('en-US')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">متبقي سعر المنتج</span>
                                <span className="font-bold font-mono">{Math.round(totals.productRemaining).toLocaleString('en-US')}</span>
                            </div>
                            <div className="border-t dark:border-gray-700 my-2"></div>
                            <div className="flex justify-between items-center text-lg">
                                <span className="font-bold text-gray-800 dark:text-white">المجموع</span>
                                <span className="font-extrabold text-primary font-mono">{Math.round(totals.totalDue).toLocaleString('en-US')} <span className="text-xs">MRU</span></span>
                            </div>
                        </div>

                        <button
                            onClick={handlePrintInvoice}
                            disabled={selectedOrderIds.size === 0}
                            className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                        >
                            <Printer size={18}/> طباعة فاتورة التسليم
                        </button>

                        <div className="mt-auto space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">إيصالات الدفع (Max 3)</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {receiptImages.map((src, idx) => (
                                        <div key={idx} className="relative group aspect-square">
                                            <img src={src} alt="Receipt" className="w-full h-full object-cover rounded-lg border dark:border-gray-700" />
                                            <button 
                                                onClick={() => removeReceipt(idx)} 
                                                className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12}/>
                                            </button>
                                        </div>
                                    ))}
                                    {receiptImages.length < 3 && (
                                        <label className={`flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isProcessingImages ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-primary'}`}>
                                            {isProcessingImages ? <Loader2 size={20} className="animate-spin text-gray-400"/> : <Plus size={20} className="text-gray-400"/>}
                                            <input type="file" accept="image/*" multiple onChange={handleReceiptUpload} className="hidden" disabled={isProcessingImages}/>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={handleConfirmDelivery}
                                disabled={selectedOrderIds.size === 0 || receiptImages.length === 0 || isSubmitting}
                                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-transform transform active:scale-95"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin"/> : <Check size={20}/>}
                                تأكيد واستلام
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-400">
                    <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <User size={40} className="opacity-20"/>
                    </div>
                    <p className="text-lg font-medium">اختر عميلاً للبدء</p>
                    <p className="text-sm opacity-60">ستظهر تفاصيل الطلبات هنا</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default DeliveryPage;
