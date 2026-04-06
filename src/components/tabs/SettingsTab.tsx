import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Settings, Shield, Bell, Globe, Trash2, RefreshCcw, Plus, Wallet, ChevronRight, Camera, Check, LogOut, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { User as UserType, ModeType } from '../../types';
import { AVATARS, APP_CONFIG } from '../../config';
import { db, auth } from '../../lib/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { web3auth } from '../../lib/web3auth';

interface SettingsTabProps {
  user: UserType | null;
  setUser: (user: UserType | null) => void;
  mode: ModeType;
}

export default function SettingsTab({ user, setUser, mode }: SettingsTabProps) {
  const [username, setUsername] = useState(user?.username || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username,
        updatedAt: serverTimestamp()
      });
      setUser({ ...user, username });
      // alert("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAvatar = async (avatar: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        avatar,
        updatedAt: serverTimestamp()
      });
      setUser({ ...user, avatar });
      setShowAvatarPicker(false);
    } catch (error) {
      console.error("Failed to update avatar", error);
    }
  };

  const handleResetDemoBalance = async () => {
    if (!user) return;
    // if (confirm("Are you sure you want to reset your demo balance to $10,000?")) {
      try {
        await updateDoc(doc(db, 'demo_wallets', user.uid), {
          demoBalance: 10000,
          updatedAt: serverTimestamp()
        });
        // alert("Demo balance reset!");
      } catch (error) {
        console.error("Failed to reset demo balance", error);
      }
    // }
  };

  const handleEmptyDemoBalance = async () => {
    if (!user) return;
    // if (confirm("Are you sure you want to empty your demo wallet?")) {
      try {
        await updateDoc(doc(db, 'demo_wallets', user.uid), {
          demoBalance: 0,
          updatedAt: serverTimestamp()
        });
        // alert("Demo wallet emptied!");
      } catch (error) {
        console.error("Failed to empty demo wallet", error);
      }
    // }
  };

  const handleLogout = async () => {
    await web3auth.logout();
    await signOut(auth);
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
            <img src={user?.avatar} alt="Avatar" className="w-32 h-32 rounded-full border-4 border-white/10 group-hover:border-orange-500 transition-all" />
            <button 
              onClick={() => setShowAvatarPicker(true)}
              className="absolute bottom-0 right-0 p-3 bg-orange-600 rounded-full text-white shadow-lg hover:scale-110 transition-all"
            >
              <Camera className="w-5 h-5" />
            </button>
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
                {user?.walletAddress}
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
            <button className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-xs transition-all border border-white/10">
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
            <div className="w-12 h-6 bg-orange-600 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
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
