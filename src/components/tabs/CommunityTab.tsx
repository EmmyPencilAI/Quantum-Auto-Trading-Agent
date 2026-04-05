import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Heart, Share2, Send, Plus, Image as ImageIcon, MoreHorizontal, TrendingUp, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { User, Post, Comment } from '../../types';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from 'firebase/firestore';

interface CommunityTabProps {
  user: User | null;
}

export default function CommunityTab({ user }: CommunityTabProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ postId: doc.id, ...doc.data() } as Post));
      
      // Fetch user info for each post
      const postsWithUser = await Promise.all(postsData.map(async (post) => {
        const userDoc = await getDoc(doc(db, 'users', post.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return { ...post, username: userData.username, avatar: userData.avatar };
        }
        return post;
      }));

      setPosts(postsWithUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreatePost = async () => {
    if (!user || !newPostContent.trim()) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        content: newPostContent,
        createdAt: serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
      });
      setNewPostContent('');
    } catch (error) {
      console.error("Failed to create post", error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        likeCount: increment(1)
      });
    } catch (error) {
      console.error("Failed to like post", error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Feed */}
      <div className="lg:col-span-2 space-y-6">
        {/* Create Post */}
        <div className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
          <div className="flex gap-4 mb-4">
            <img src={user?.avatar} alt="Avatar" className="w-12 h-12 rounded-full border border-white/10" />
            <textarea 
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="What's happening in the Quantum world?" 
              className="flex-1 bg-transparent border-none resize-none focus:ring-0 text-lg placeholder:text-white/20 min-h-[100px]"
            />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/5 rounded-lg text-orange-500 transition-all">
                <ImageIcon className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-orange-500 transition-all">
                <TrendingUp className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={handleCreatePost}
              disabled={isPosting || !newPostContent.trim()}
              className={cn(
                "px-8 py-2 bg-orange-600 rounded-full font-bold text-sm transition-all active:scale-95 shadow-lg shadow-orange-600/20",
                (isPosting || !newPostContent.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-6">
          {loading ? (
            <div className="py-20 text-center text-white/20 animate-pulse font-mono tracking-widest uppercase">Loading Quantum Feed...</div>
          ) : posts.length === 0 ? (
            <div className="py-20 text-center text-white/20 italic">No posts yet. Be the first to share!</div>
          ) : (
            posts.map((post) => (
              <motion.div 
                key={post.postId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={post.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-white/10" />
                    <div>
                      <h4 className="font-bold text-sm tracking-tight">{post.username}</h4>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Quantum Trader</p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-white/5 rounded-lg text-white/20 hover:text-white transition-all">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-white/80 leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>

                <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                  <button 
                    onClick={() => handleLike(post.postId)}
                    className="flex items-center gap-2 text-white/40 hover:text-red-500 transition-all group/btn"
                  >
                    <div className="p-2 rounded-lg group-hover/btn:bg-red-500/10 transition-all">
                      <Heart className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">{post.likeCount}</span>
                  </button>
                  <button className="flex items-center gap-2 text-white/40 hover:text-orange-500 transition-all group/btn">
                    <div className="p-2 rounded-lg group-hover/btn:bg-orange-500/10 transition-all">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">{post.commentCount}</span>
                  </button>
                  <button className="flex items-center gap-2 text-white/40 hover:text-green-500 transition-all group/btn ml-auto">
                    <div className="p-2 rounded-lg group-hover/btn:bg-green-500/10 transition-all">
                      <Share2 className="w-5 h-5" />
                    </div>
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block space-y-6">
        {/* Trending Topics */}
        <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
          <h3 className="font-bold text-lg uppercase tracking-tighter mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" /> Trending
          </h3>
          <div className="space-y-4">
            {[
              { tag: '#BNBChain', posts: '12.4k' },
              { tag: '#QuantumFinance', posts: '8.2k' },
              { tag: '#BTC', posts: '45.1k' },
              { tag: '#AutomatedTrading', posts: '3.5k' },
            ].map((topic, i) => (
              <div key={i} className="group cursor-pointer">
                <p className="text-sm font-bold group-hover:text-orange-500 transition-colors">{topic.tag}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{topic.posts} posts</p>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Users */}
        <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
          <h3 className="font-bold text-lg uppercase tracking-tighter mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" /> Suggested
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="Avatar" className="w-10 h-10 rounded-full border border-white/10" />
                  <div>
                    <h4 className="font-bold text-xs tracking-tight">Trader_{i}</h4>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Elite</p>
                  </div>
                </div>
                <button className="px-4 py-1.5 bg-white text-black rounded-full font-bold text-[10px] hover:bg-orange-500 hover:text-white transition-all">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
