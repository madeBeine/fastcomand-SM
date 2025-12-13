import React, { useState, useMemo, useEffect, useContext } from 'react';
import type { Client, Order } from '../types';
import { supabase, getErrorMessage } from '../supabaseClient';
import { User, Phone, Search, PlusCircle, Edit, Trash2, X, Save, Eye, MapPin, ShoppingCart, DollarSign, ListOrdered, BarChart3, TrendingUp, Users, BadgePercent, Loader2, ShieldCheck, ChevronDown, FileSpreadsheet, MessageCircle, ExternalLink } from 'lucide-react';
import { STATUS_DETAILS } from '../constants';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import ImportClientsModal from './ImportClientsModal';

interface ClientsPageProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    orders: Order[];
}

const PasswordModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => Promise<void>;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    const { t } = useLanguage();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await onConfirm(password);
            onClose();
            setPassword('');
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70]" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message}</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('password')}
                        className="w-full p-2 border rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border-gray-300 dark:border-gray-600 mb-2"
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg">{t('cancel')}</button>
                        <button type="submit" disabled={!password || loading} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                            {loading ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}
                            {t('confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ClientFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (client: Partial<Client>) => void;
    client: Client | null;
    isSaving: boolean;
}> = ({ isOpen, onClose, onSave, client, isSaving }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState<Partial<Client>>({});
    const [showWhatsappInput, setShowWhatsappInput] = useState(false);

    useEffect(() => {
        const initialData = client || { name: '', phone: '', whatsappNumber: '', address: '', gender: 'male' };
        setFormData(initialData);
        setShowWhatsappInput(!!(client && client.whatsappNumber && client.whatsappNumber !== client.phone));
    }, [client, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (formData.name && formData.phone && formData.gender) {
            onSave(formData);
        } else {
            alert(t('required'));
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const clearWhatsapp = () => {
        setFormData(prev => ({ ...prev, whatsappNumber: '' }));
        setShowWhatsappInput(false);
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold">{client ? t('edit') : t('addClient')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('clientName')}*</label>
                        <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 text-text-light dark:text-text-dark" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{t('phone')}*</label>
                        <input type="tel" name="phone" value={formData.phone || ''} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 text-text-light dark:text-text-dark" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('gender')}*</label>
                        <select name="gender" value={formData.gender || 'male'} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 text-text-light dark:text-text-dark">
                            <option value="male">{t('male')}</option>
                            <option value="female">{t('female')}</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{t('whatsapp')}</label>
                        {!showWhatsappInput ? (
                            <button onClick={() => setShowWhatsappInput(true)} className="w-full text-sm p-2 border-2 border-dashed rounded dark:border-gray-600 hover:border-primary dark:hover:border-secondary transition-colors">
                                + {t('addClient')}
                            </button>
                        ) : (
                             <div className="relative">
                                <input type="tel" name="whatsappNumber" value={formData.whatsappNumber || ''} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 text-text-light dark:text-text-dark" placeholder={t('optional')}/>
                                <button onClick={clearWhatsapp} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500">
                                    <X size={16}/>
                                </button>
                            </div>
                        )}
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{t('address')}</label>
                        <textarea name="address" value={formData.address || ''} onChange={handleInputChange} rows={2} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 text-text-light dark:text-text-dark"></textarea>
                    </div>
                </div>
                <div className="p-6 pt-0 flex justify-end flex-shrink-0">
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary dark:hover:bg-secondary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ClientsPage: React.FC<ClientsPageProps> = ({ clients, setClients, orders }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    const filteredClients = useMemo(() => {
        return clients.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.phone.includes(searchTerm)
        );
    }, [clients, searchTerm]);

    const handleSaveClient = async (clientData: Partial<Client>) => {
        if (!supabase) return;
        setIsSaving(true);
        try {
            const payload = {
                name: clientData.name,
                phone: clientData.phone,
                whatsapp_number: clientData.whatsappNumber,
                address: clientData.address,
                gender: clientData.gender
            };

            let res;
            if (clientData.id) {
                res = await (supabase.from('Clients') as any).update(payload).eq('id', clientData.id).select().single();
            } else {
                res = await (supabase.from('Clients') as any).insert(payload).select().single();
            }

            if (res.error) throw res.error;

            const savedClient = {
                ...res.data,
                whatsappNumber: res.data.whatsapp_number
            };

            if (clientData.id) {
                setClients(prev => prev.map(c => c.id === savedClient.id ? savedClient : c));
            } else {
                setClients(prev => [savedClient, ...prev]);
            }
            showToast(t('success'), 'success');
            setIsModalOpen(false);
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClient = async (password: string) => {
        if (!supabase || !clientToDelete || !currentUser?.email) return;
        
        // Verify password
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password
        });

        if (authError) {
            throw new Error(t('error'));
        }

        const { error } = await supabase.from('Clients').delete().eq('id', clientToDelete.id);
        if (error) throw new Error(getErrorMessage(error));

        setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
        showToast(t('success'), 'success');
        setDeleteModalOpen(false);
        setClientToDelete(null);
    };

    return (
        <div className="space-y-6">
            <PasswordModal 
                isOpen={deleteModalOpen} 
                onClose={() => setDeleteModalOpen(false)} 
                onConfirm={handleDeleteClient}
                title={t('confirmDelete')}
                message={t('deleteWarning')}
            />
            
            <ClientFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSaveClient} 
                client={selectedClient} 
                isSaving={isSaving} 
            />

            <ImportClientsModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onSuccess={() => window.location.reload()} 
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-bold text-text-light dark:text-text-dark">{t('manageClients')}</h2>
                <div className="flex gap-2">
                    {currentUser?.permissions.clients.create && (
                        <>
                            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors">
                                <FileSpreadsheet size={20}/> {t('importExcel')}
                            </button>
                            <button onClick={() => { setSelectedClient(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary-dark transition-colors">
                                <PlusCircle size={20}/> {t('addClient')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="relative">
                <input 
                    type="text" 
                    placeholder={t('searchPlaceholder')} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map(client => {
                    const clientOrders = orders.filter(o => o.clientId === client.id);
                    const totalSpend = clientOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
                    
                    return (
                        <div key={client.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col justify-between group hover:shadow-md transition-all">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white ${client.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'}`}>
                                            {client.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{client.name}</h3>
                                            <p className="text-sm text-gray-500">{client.phone}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    {client.address && <p className="flex items-center gap-2"><MapPin size={14}/> {client.address}</p>}
                                    <p className="flex items-center gap-2"><ShoppingCart size={14}/> {clientOrders.length} {t('ordersCount')}</p>
                                    <p className="flex items-center gap-2"><DollarSign size={14}/> {totalSpend.toLocaleString()} MRU</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                                {currentUser?.permissions.clients.edit && (
                                    <button onClick={() => { setSelectedClient(client); setIsModalOpen(true); }} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                        <Edit size={18}/>
                                    </button>
                                )}
                                {currentUser?.permissions.clients.delete && (
                                    <button onClick={() => { setClientToDelete(client); setDeleteModalOpen(true); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                                        <Trash2 size={18}/>
                                    </button>
                                )}
                                <a 
                                    href={`https://wa.me/${client.whatsappNumber || client.phone}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                >
                                    <MessageCircle size={18}/>
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ClientsPage;