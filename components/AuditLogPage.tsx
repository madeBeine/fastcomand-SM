
import React, { useState, useMemo } from 'react';
import type { GlobalActivityLog } from '../types';
import { Search, Calendar, User, ListFilter } from 'lucide-react';

interface AuditLogPageProps {
    log: GlobalActivityLog[];
}

const AuditLogPage: React.FC<AuditLogPageProps> = ({ log }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [dateFilter, setDateFilter] = useState(todayStr); // Default to today

    // Ensure log is always an array to prevent crashes
    const safeLog = useMemo(() => Array.isArray(log) ? log : [], [log]);

    const filteredLog = useMemo(() => {
        return safeLog.filter(entry => {
            if (!entry) return false;
            
            const lowerSearchTerm = searchTerm.toLowerCase();
            const matchesSearch = (entry.details || '').toLowerCase().includes(lowerSearchTerm) ||
                                  (entry.action || '').toLowerCase().includes(lowerSearchTerm) ||
                                  (entry.entityId || '').toLowerCase().includes(lowerSearchTerm);

            const matchesUser = userFilter ? entry.user === userFilter : true;
            
            // Allow matching full timestamp if dateFilter is set
            const matchesDate = dateFilter && entry.timestamp ? entry.timestamp.startsWith(dateFilter) : true;
            
            return matchesSearch && matchesUser && matchesDate;
        });
    }, [safeLog, searchTerm, userFilter, dateFilter]);

    // Extract unique usernames correctly, filtering out undefined/nulls
    const uniqueUsers = useMemo(() => {
        return [...new Set(safeLog.map(entry => entry.user).filter(user => typeof user === 'string' && user.trim() !== ''))];
    }, [safeLog]);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-text-light dark:text-text-dark">سجل تدقيق النظام</h2>
            <div className="bg-content-light dark:bg-content-dark p-4 rounded-xl shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="ابحث في التفاصيل..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light text-text-light dark:text-text-dark"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    </div>
                    <div className="relative">
                        <select
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                             className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light text-text-light dark:text-text-dark"
                        >
                            <option value="">كل المستخدمين</option>
                            {uniqueUsers.map(user => <option key={user} value={user}>{user}</option>)}
                        </select>
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    </div>
                     <div className="relative flex items-center gap-2">
                        <div className="relative w-full">
                            <input 
                                type="date" 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light text-text-light dark:text-text-dark"
                            />
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        </div>
                        {dateFilter && (
                            <button 
                                onClick={() => setDateFilter('')}
                                className="text-xs text-red-500 whitespace-nowrap hover:underline"
                            >
                                عرض الكل
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-right">التاريخ والوقت</th>
                                <th scope="col" className="px-6 py-3 text-right">المستخدم</th>
                                <th scope="col" className="px-6 py-3 text-right">الإجراء</th>
                                <th scope="col" className="px-6 py-3 text-right">الكيان</th>
                                <th scope="col" className="px-6 py-3 text-right">التفاصيل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLog.map(entry => (
                                <tr key={entry.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 whitespace-nowrap text-right" dir="ltr">{entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-US') : 'N/A'}</td>
                                    <td className="px-6 py-4 font-bold text-primary dark:text-primary-dark text-right">{entry.user || 'System'}</td>
                                    <td className="px-6 py-4 text-right">{entry.action}</td>
                                    <td className="px-6 py-4 text-right">{entry.entityType} ({entry.entityId})</td>
                                    <td className="px-6 py-4 text-right">{entry.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredLog.length === 0 && (
                     <div className="text-center py-10 text-gray-500">
                        <ListFilter size={32} className="mx-auto mb-2"/>
                        <p>لا توجد سجلات تطابق معايير البحث.</p>
                        {dateFilter && <p className="text-xs mt-1">يتم عرض سجلات يوم {dateFilter} فقط.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogPage;
