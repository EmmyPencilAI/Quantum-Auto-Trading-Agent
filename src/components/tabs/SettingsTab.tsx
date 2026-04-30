import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Settings, Shield, Bell, Globe, Trash2, RefreshCcw, Plus, Wallet, ChevronRight, Camera, Check, LogOut, X, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { User as UserType, ModeType } from '../../types';
import { AVATARS, APP_CONFIG } from '../../config';
import { supabase } from '../../lib/supabase';
import { web3auth } from '../../lib/web3auth';

interface SettingsTabProps {
  user: UserType | null;
  setUser: (user: UserType | null) => void;
  mode: ModeType;
  onLogout: () => void;
}

export default function SettingsTab({ user, setUser, mode, onLogout }: SettingsTabProps) {
  const [username, setUsername] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('quantum_notifications');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [showWeb3AuthModal, setShowWeb3AuthModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user?.username]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCrop = async () => {
    if (!tempImage || !user) return;
    setIsSaving(true);
    setShowCropModal(false);
    
    try {
      // Simulate upload process
      setUploadProgress(0);
      for (let i = 0; i <= 100; i += 20) {
        setUploadProgress(i);
        await new Promise(r => setTimeout(r, 200));
      }

      const { error } = await supabase
        .from('users')
        .update({ avatar: tempImage })
        .eq('uid', user.uid);
      
      if (error) throw error;
      
      setUser({ ...user, avatar: tempImage });
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
      setTempImage(null);
    }
  };

  const handleBackup = async () => {
    try {
      if (!web3auth.provider) {
        alert("Web3Auth provider not available. Please ensure you are logged in.");
        return;
      }
      
      const privateKey = await web3auth.provider.request({
        method: "private_key",
      });

      if (privateKey) {
        alert(`CRITICAL SECURITY INFO\n\nYour Secret Phrase (Private Key):\n${privateKey}\n\nWARNING: NEVER share this with anyone. Quantum Engine will NEVER ask for this key.`);
      } else {
        alert("Unable to fetch private key. This might be due to your login method configuration.");
      }
    } catch (error) {
      console.error("Backup failed", error);
      alert("Security Protocol failed to fetch key. Check console for details.");
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ username })
        .eq('uid', user.uid);
      
      if (error) throw error;
      
      setUser({ ...user, username });
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAvatar = async (avatar: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar })
        .eq('uid', user.uid);

      if (error) throw error;
      
      setUser({ ...user, avatar });
      setShowAvatarPicker(false);
    } catch (error) {
      console.error("Failed to update avatar", error);
    }
  };

  const handleResetDemoBalance = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('demo_wallets')
        .update({
          demo_balance: 10000,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.uid);
      
      if (error) throw error;
    } catch (error) {
      console.error("Failed to reset demo balance", error);
    }
  };

  const handleEmptyDemoBalance = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('demo_wallets')
        .update({
          demo_balance: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.uid);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to empty demo wallet", error);
    }
  };

  const handleLogout = async () => {
    onLogout();
  };

  const toggleNotifications = () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    localStorage.setItem('quantum_notifications', newVal.toString());
  };

  const handleAddFunds = async () => {
    if (!user) return;
    try {
      const { data: demoDoc } = await supabase.from('demo_wallets').select('demo_balance').eq('id', user.uid).single();
      const currentBal = demoDoc ? demoDoc.demo_balance : 13300;
      const { error } = await supabase
        .from('demo_wallets')
        .update({
          demo_balance: currentBal + 5000,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.uid);
      
      if (error) throw error;
      alert("SUCCESS: +5,000 USDT added to Demo Wallet.");
    } catch (error) {
      console.error("Failed to add funds", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Section */}
      <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
        <h3 className="font-display text-xl uppercase tracking-tighter mb-8 flex items-center gap-2">
          <User className="w-5 h-5 text-orange-500" /> Profile Settings
        </h3>

        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full border-4 border-white/10 group-hover:border-orange-500 transition-all overflow-hidden relative">
              <img src={user?.avatar} alt="Avatar" className="w-full h-full object-cover" />
              {uploadProgress !== null && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity flex-col gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-orange-600 rounded-lg text-white hover:scale-110 transition-all">
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowAvatarPicker(true)}
              className="absolute bottom-0 right-0 p-3 bg-orange-600 rounded-full text-white shadow-lg hover:scale-110 transition-all"
            >
              <Camera className="w-5 h-5" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileSelect}
            />
          </div>

          <div className="flex-1 space-y-6 w-full">
            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm font-bold focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Wallet Address</label>
              <div className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-xs font-mono text-white/40 break-all">
                {user?.wallet_address}
              </div>
            </div>
            <button 
              onClick={handleUpdateProfile}
              disabled={isSaving}
              className="px-8 py-3 bg-orange-600 rounded-xl font-bold text-sm hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Demo Wallet Controls */}
      <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
        <h3 className="font-display text-xl uppercase tracking-tighter mb-8 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-orange-500" /> Demo Wallet Controls
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={handleAddFunds}
            className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-green-500/10 hover:border-green-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-600/10 rounded-2xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
                <Plus className="w-6 h-6 text-green-500 group-hover:text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-bold">Add Funds</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">+ $5,000 USDT</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/20" />
          </button>

          <button 
            onClick={handleResetDemoBalance}
            className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-orange-500/10 hover:border-orange-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                <RefreshCcw className="w-6 h-6 text-orange-500 group-hover:text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-bold">Reset Balance</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Set to $10,000</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/20" />
          </button>

          <button 
            onClick={handleEmptyDemoBalance}
            className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center group-hover:bg-red-600 transition-colors">
                <Trash2 className="w-6 h-6 text-red-500 group-hover:text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-bold">Empty Wallet</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Set to $0</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/20" />
          </button>
        </div>
      </div>

      {/* Security & Account */}
      <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
        <h3 className="font-display text-xl uppercase tracking-tighter mb-8 flex items-center gap-2">
          <Shield className="w-5 h-5 text-orange-500" /> Security & Account
        </h3>

        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h4 className="font-bold">Web3Auth Management</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Backup & Recovery</p>
              </div>
            </div>
            <button 
              onClick={handleBackup}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-xs transition-all border border-white/10"
            >
              Manage
            </button>
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h4 className="font-bold">Notifications</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Trade Alerts & Updates</p>
              </div>
            </div>
            <button 
              onClick={toggleNotifications}
              className={cn(
                "w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300",
                notificationsEnabled ? "bg-orange-600" : "bg-white/10"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                notificationsEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full p-6 rounded-3xl bg-red-500/5 border border-red-500/10 flex items-center justify-between hover:bg-red-500/10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center group-hover:bg-red-600 transition-colors">
                <LogOut className="w-6 h-6 text-red-500 group-hover:text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-red-500">Logout</h4>
                <p className="text-[10px] text-red-500/40 uppercase tracking-widest">Sign out of Quantum Finance</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-500/20" />
          </button>
        </div>
      </div>

      {/* Crop Modal */}
      <AnimatePresence>
        {showCropModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-[3rem] max-w-md w-full text-center">
              <h3 className="text-xl font-display uppercase tracking-tight mb-6">Crop Profile Picture</h3>
              <div className="w-48 h-48 mx-auto rounded-full overflow-hidden border-2 border-orange-500 mb-8 relative">
                <img src={tempImage || ''} className="w-full h-full object-cover scale-125" alt="Preview" />
                <div className="absolute inset-0 border-[20px] border-black/40" />
              </div>
              <p className="text-xs text-white/40 mb-8">Quantum AI is auto-scaling your image for perfect profile fit.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowCropModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold">Cancel</button>
                <button onClick={handleConfirmCrop} className="flex-1 py-3 bg-orange-600 rounded-xl font-bold">Apply & Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setShowAvatarPicker(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0a0a0a] border border-white/10 p-8 rounded-[3rem] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-display tracking-tighter uppercase">Choose Avatar</h3>
                <button onClick={() => setShowAvatarPicker(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                {AVATARS.map((avatar, i) => (
                  <button 
                    key={i}
                    onClick={() => handleUpdateAvatar(avatar)}
                    className={cn(
                      "relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:scale-110",
                      user?.avatar === avatar ? "border-orange-500 bg-orange-500/10" : "border-white/5 hover:border-white/20"
                    )}
                  >
                    <img src={avatar} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                    {user?.avatar === avatar && (
                      <div className="absolute inset-0 flex items-center justify-center bg-orange-500/20">
                        <Check className="w-6 h-6 text-orange-500" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
