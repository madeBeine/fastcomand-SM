
import React, { useState, useEffect } from 'react';
import type { User, Permissions, UserRole } from '../types';
import { DEFAULT_EMPLOYEE_PERMISSIONS, DEFAULT_VIEWER_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS } from '../constants';
import { X, Save, Eye, EyeOff, Mail, Lock, Shield, Loader2, AlertTriangle, Upload, User as UserIcon } from 'lucide-react';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User, email?: string, password?: string) => void;
    user: User | null;
    isSaving?: boolean;
}

const getInitialPermissions = (role: string = 'employee'): Permissions => {
    if (role === 'admin') return JSON.parse(JSON.stringify(DEFAULT_ADMIN_PERMISSIONS));
    if (role === 'viewer') return JSON.parse(JSON.stringify(DEFAULT_VIEWER_PERMISSIONS));
    return JSON.parse(JSON.stringify(DEFAULT_EMPLOYEE_PERMISSIONS));
};

const PermissionCheckbox: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="form-checkbox h-4 w-4 rounded text-primary focus:ring-primary-light" />
        <span>{label}</span>
    </label>
);

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, user, isSaving = false }) => {
    const [formData, setFormData] = useState<Partial<User>>({});
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const isEditing = !!user;

    useEffect(() => {
        if (isOpen) {
            if (user) {
                setFormData({ ...user });
                setAvatarPreview(user.avatar || null);
            } else {
                setFormData({
                    username: '',
                    role: 'employee' as any,
                    permissions: getInitialPermissions('employee'),
                    avatar: undefined
                });
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setAvatarPreview(null);
            }
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    // Helper to compress image
    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                if (!event.target?.result) return reject("Failed to read file");
                const img = new Image();
                img.src = event.target.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject("Canvas error");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const base64 = await compressImage(e.target.files[0]);
                setAvatarPreview(base64);
                setFormData(prev => ({ ...prev, avatar: base64 }));
            } catch (err) {
                alert("فشل رفع الصورة");
            }
        }
    };

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRole = e.target.value as any;
        setFormData(prev => ({
            ...prev,
            role: newRole,
            permissions: getInitialPermissions(newRole)
        }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePermissionChange = (category: keyof Permissions, permission: string, value: boolean) => {
        setFormData(prev => {
            if (!prev.permissions) return prev;
            const newPermissions = JSON.parse(JSON.stringify(prev.permissions)); // Deep copy
            const cat = newPermissions[category] as any;
            if (typeof cat === 'boolean') {
                (newPermissions as any)[category] = value;
            } else {
                cat[permission] = value;
            }
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleSave = () => {
        if (isSaving) return;

        if (!formData.username) {
            alert('اسم المستخدم مطلوب.');
            return;
        }

        let cleanEmail = email;
        let cleanPassword = password;

        if (!isEditing) {
            cleanEmail = email.trim();
            cleanPassword = password.trim();

            if (!cleanEmail || !cleanPassword) {
                alert('البريد الإلكتروني وكلمة المرور مطلوبان لإنشاء حساب.');
                return;
            }
            if (cleanPassword.length < 6) {
                alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
                return;
            }
            if (cleanPassword !== confirmPassword) {
                alert('كلمتا المرور غير متطابقتين.');
                return;
            }
        } else {
            // Even if editing, if password field is used (though it might just update auth separate), validate match
            if (password && password !== confirmPassword) {
                alert('كلمتا المرور غير متطابقتين.');
                return;
            }
        }
        
        onSave(formData as User, cleanEmail, cleanPassword);
    };

    const renderPermissionSet = (category: 'orders' | 'shipments' | 'clients' | 'storage', title: string) => {
        const permissions = formData.permissions?.[category];
        if (!permissions) return null;

        const allChecked = Object.values(permissions).every(Boolean);
        const handleToggleAll = (checked: boolean) => {
             setFormData(prev => {
                if (!prev.permissions) return prev;
                const newPermissions = { ...prev.permissions! };
                const newCat = { ...newPermissions[category] };
                Object.keys(newCat).forEach(key => (newCat as any)[key] = checked);
                newPermissions[category] = newCat as any;
                return { ...prev, permissions: newPermissions };
            });
        }

        return (
            <div className="p-3 bg-background-light dark:bg-background-dark rounded-md border dark:border-gray-700">
                <h5 className="font-semibold mb-2 flex justify-between items-center">
                    {title}
                     <PermissionCheckbox label="الكل" checked={allChecked} onChange={handleToggleAll} />
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <PermissionCheckbox label="عرض" checked={permissions.view} onChange={(v) => handlePermissionChange(category, 'view', v)} />
                    <PermissionCheckbox label="إنشاء" checked={permissions.create} onChange={(v) => handlePermissionChange(category, 'create', v)} />
                    <PermissionCheckbox label="تعديل" checked={permissions.edit} onChange={(v) => handlePermissionChange(category, 'edit', v)} />
                    <PermissionCheckbox label="حذف" checked={permissions.delete} onChange={(v) => handlePermissionChange(category, 'delete', v)} />
                    {'changeStatus' in permissions && (
                        <PermissionCheckbox label="تغيير الحالة" checked={permissions.changeStatus} onChange={(v) => handlePermissionChange(category, 'changeStatus', v)} />
                    )}
                     {'revertStatus' in permissions && (
                        <PermissionCheckbox label="التراجع عن الحالة" checked={permissions.revertStatus} onChange={(v) => handlePermissionChange(category, 'revertStatus', v)} />
                    )}
                </div>
            </div>
        )
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold">{isEditing ? `تعديل المستخدم: ${user.username}` : 'إضافة مستخدم جديد'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    
                    {/* Profile Picture Upload */}
                    <div className="flex justify-center mb-4">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon size={40} className="text-gray-400" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full cursor-pointer hover:bg-primary-dark transition-colors shadow-sm">
                                <Upload size={14} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">اسم المستخدم (للعرض)*</label>
                            <input type="text" name="username" value={formData.username || ''} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
                        </div>
                        {isEditing && (
                             <div>
                                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                                <input type="text" value={user.email || ''} disabled className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-700 text-gray-500 cursor-not-allowed" />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1">الدور والصلاحيات*</label>
                            <select name="role" value={formData.role} onChange={handleRoleChange} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600">
                                <option value="employee">موظف (صلاحيات مخصصة)</option>
                                <option value="viewer">مشاهد (للقراءة فقط)</option>
                                <option value="admin">مدير النظام (صلاحيات كاملة)</option>
                            </select>
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800 space-y-3">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                <Shield size={18}/> إعداد بيانات الدخول
                            </h4>
                            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                                <p>هذه البيانات ستستخدم لتسجيل الدخول.</p>
                                <div className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                                    <AlertTriangle size={14} />
                                    <span>هام: تأكد من تعطيل "Confirm Email" في إعدادات Supabase ليعمل الحساب فوراً.</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Mail size={14}/> البريد الإلكتروني*</label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600" placeholder="user@company.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Lock size={14}/> كلمة المرور*</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600" placeholder="******" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Lock size={14}/> تأكيد كلمة المرور*</label>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`w-full p-2 border rounded dark:bg-gray-800 ${confirmPassword && password !== confirmPassword ? 'border-red-500' : 'dark:border-gray-600'}`} placeholder="******" />
                                    {confirmPassword && password !== confirmPassword && <p className="text-xs text-red-500 mt-1">كلمتا المرور غير متطابقتين</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    <h4 className="text-lg font-bold pt-4 border-t dark:border-gray-700">تخصيص الصلاحيات</h4>
                    {formData.role === 'admin' ? (
                        <p className="text-sm text-gray-500 italic">المدير لديه كافة الصلاحيات تلقائياً.</p>
                    ) : (
                        <div className="space-y-3">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-background-light dark:bg-background-dark rounded-md border dark:border-gray-700">
                                <PermissionCheckbox label="الوصول للإعدادات" checked={formData.permissions?.canAccessSettings ?? false} onChange={(v) => handlePermissionChange('canAccessSettings', '', v)} />
                                <PermissionCheckbox label="إدارة المستخدمين" checked={formData.permissions?.canManageUsers ?? false} onChange={(v) => handlePermissionChange('canManageUsers', '', v)} />
                                <PermissionCheckbox label="عرض سجل النظام" checked={formData.permissions?.canViewAuditLog ?? false} onChange={(v) => handlePermissionChange('canViewAuditLog', '', v)} />
                            </div>
                            {renderPermissionSet('orders', 'الطلبات')}
                            {renderPermissionSet('shipments', 'الشحنات')}
                            {renderPermissionSet('clients', 'العملاء')}
                            {renderPermissionSet('storage', 'المخزن')}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 <div className="p-3 bg-background-light dark:bg-background-dark rounded-md border dark:border-gray-700">
                                    <h5 className="font-semibold mb-2">السحب والتسليم</h5>
                                    <div className="flex gap-4">
                                        <PermissionCheckbox label="عرض" checked={formData.permissions?.delivery.view ?? false} onChange={(v) => handlePermissionChange('delivery', 'view', v)} />
                                        <PermissionCheckbox label="معالجة" checked={formData.permissions?.delivery.process ?? false} onChange={(v) => handlePermissionChange('delivery', 'process', v)} />
                                    </div>
                                </div>
                                 <div className="p-3 bg-background-light dark:bg-background-dark rounded-md border dark:border-gray-700">
                                    <h5 className="font-semibold mb-2">الفوترة</h5>
                                    <div className="flex gap-4">
                                        <PermissionCheckbox label="عرض" checked={formData.permissions?.billing.view ?? false} onChange={(v) => handlePermissionChange('billing', 'view', v)} />
                                        <PermissionCheckbox label="طباعة" checked={formData.permissions?.billing.print ?? false} onChange={(v) => handlePermissionChange('billing', 'print', v)} />
                                    </div>
                                </div>
                            </div>

                             <div className="p-3 bg-background-light dark:bg-background-dark rounded-md border dark:border-gray-700">
                                <h5 className="font-semibold mb-2">صلاحيات الإعدادات</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                   <PermissionCheckbox label="تعديل الشركة" checked={formData.permissions?.settings.canEditCompany ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditCompany', v)} />
                                   <PermissionCheckbox label="تعديل النظام" checked={formData.permissions?.settings.canEditSystem ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditSystem', v)} />
                                   <PermissionCheckbox label="تعديل المتاجر" checked={formData.permissions?.settings.canEditStores ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditStores', v)} />
                                   <PermissionCheckbox label="تعديل الشحن" checked={formData.permissions?.settings.canEditShipping ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditShipping', v)} />
                                   <PermissionCheckbox label="تعديل العملات" checked={formData.permissions?.settings.canEditCurrencies ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditCurrencies', v)} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 pt-0 flex justify-end flex-shrink-0">
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary-dark dark:hover:bg-secondary-dark disabled:bg-gray-400 disabled:cursor-not-allowed">
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserFormModal;
