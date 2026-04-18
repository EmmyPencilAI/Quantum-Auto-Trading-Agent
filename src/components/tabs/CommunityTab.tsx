import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Heart, Share2, Send, Plus, Image as ImageIcon, MoreHorizontal, TrendingUp, Users } from 'lucide-react';
import { cn, getRank } from '../../lib/utils';
import { User, Post, Comment } from '../../types';
import { supabase } from '../../lib/supabase';

interface CommunityTabProps {
  user: User | null;
}

export default function CommunityTab({ user }: CommunityTabProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [activeComments, setActiveComments] = useState<string | null>(null); // Post ID
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users:uid(username, avatar)')
        .order('createdAt', { ascending: false })
        .limit(50);

      if (data) {
        const formattedPosts = data.map((post: any) => ({
          postId: post.id,
          ...post,
          username: post.users?.username,
          avatar: post.users?.avatar
        }));
        setPosts(formattedPosts as Post[]);
      }
      setLoading(false);
    };

    fetchPosts();

    const fetchSuggested = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('tradeVolume', { ascending: false })
        .limit(5);
      if (data) setSuggestedUsers(data as User[]);
    };
    fetchSuggested();

    // Set up real-time subscription for posts
    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreatePost = async () => {
    if (!user || !newPostContent.trim()) return;
    setIsPosting(true);
    try {
      const { error } = await supabase.from('posts').insert({
        uid: user.uid,
        content: newPostContent,
        likeCount: 0,
        commentCount: 0,
      });
      if (error) throw error;
      setNewPostContent('');
    } catch (error) {
      console.error("Failed to create post", error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    try {
      const post = posts.find(p => p.postId === postId);
      if (!post) return;

      const isLiked = post.likedBy?.includes(user.uid);
      const newLikedBy = isLiked 
        ? post.likedBy?.filter(id => id !== user.uid)
        : [...(post.likedBy || []), user.uid];

      const { error } = await supabase
        .from('posts')
        .update({ 
          likedBy: newLikedBy,
          likeCount: isLiked ? post.likeCount - 1 : post.likeCount + 1
        })
        .eq('id', postId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to like post", error);
    }
  };

  const handleFollow = async (targetUid: string) => {
    if (!user) return;
    try {
      const isFollowing = user.following?.includes(targetUid);
      const newFollowing = isFollowing
        ? user.following?.filter(id => id !== targetUid)
        : [...(user.following || []), targetUid];

      const { error } = await supabase
        .from('users')
        .update({ following: newFollowing })
        .eq('uid', user.uid);
      
      if (error) throw error;
      // In a real app we'd also update the target user's followers list
    } catch (error) {
      console.error("Failed to follow", error);
    }
  };

  const handleComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;
    setIsCommenting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        postId,
        uid: user.uid,
        content: newComment,
      });

      if (error) throw error;

      await supabase.rpc('increment_comment_count', { row_id: postId });
      setNewComment("");
      fetchComments(postId);
    } catch (error) {
      console.error("Failed to post comment", error);
    } finally {
      setIsCommenting(false);
    }
  };

  const fetchComments = async (postId: string) => {
    const { data } = await supabase
      .from('comments')
      .select('*, users:uid(username, avatar)')
      .eq('postId', postId)
      .order('createdAt', { ascending: true });
    
    if (data) {
      const formatted = data.map((c: any) => ({
        ...c,
        commentId: c.id,
        username: c.users?.username,
        avatar: c.users?.avatar
      }));
      setComments(prev => ({ ...prev, [postId]: formatted }));
    }
  };

  const toggleComments = (postId: string) => {
    if (activeComments === postId) {
      setActiveComments(null);
    } else {
      setActiveComments(postId);
      if (!comments[postId]) fetchComments(postId);
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
                      <p className={cn(
                        "text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded",
                        getRank(post.uid === user?.uid ? user?.tradeVolume : 0).bg,
                        getRank(post.uid === user?.uid ? user?.tradeVolume : 0).color
                      )}>
                        {getRank(post.uid === user?.uid ? user?.tradeVolume : 0).name}
                      </p>
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
                    className={cn(
                      "flex items-center gap-2 transition-all group/btn",
                      post.likedBy?.includes(user?.uid || '') ? "text-red-500" : "text-white/40 hover:text-red-500"
                    )}
                  >
                    <div className="p-2 rounded-lg group-hover/btn:bg-red-500/10 transition-all">
                      <Heart className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">{post.likeCount}</span>
                  </button>
                  <button 
                    onClick={() => toggleComments(post.postId)}
                    className="flex items-center gap-2 text-white/40 hover:text-orange-500 transition-all group/btn"
                  >
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

                {/* Comments Section */}
                <AnimatePresence>
                  {activeComments === post.postId && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 pt-6 border-t border-white/5 space-y-4 overflow-hidden"
                    >
                      <div className="flex gap-3">
                        <img src={user?.avatar} className="w-8 h-8 rounded-full" />
                        <div className="flex-1 relative">
                          <input 
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-500 transition-all"
                            onKeyDown={(e) => e.key === 'Enter' && handleComment(post.postId)}
                          />
                          <button 
                            onClick={() => handleComment(post.postId)}
                            disabled={isCommenting || !newComment.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-400 disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 pt-2">
                        {comments[post.postId]?.map((comment) => (
                          <div key={comment.commentId} className="flex gap-3 group/cmt">
                            <img src={comment.avatar} className="w-8 h-8 rounded-full border border-white/5" />
                            <div className="flex-1">
                              <div className="bg-white/5 rounded-2xl p-3">
                                <p className="font-bold text-[10px] text-white/40 mb-1">{comment.username}</p>
                                <p className="text-sm text-white/90">{comment.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block space-y-6">
        {/* Trending Topics */}
        <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
          <h3 className="font-display text-lg uppercase tracking-tighter mb-6 flex items-center gap-2">
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
          <h3 className="font-display text-lg uppercase tracking-tighter mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" /> Suggested
          </h3>
          <div className="space-y-4">
            {suggestedUsers.filter(u => u.uid !== user?.uid).map(u => {
              const rank = getRank(u.tradeVolume);
              const isFollowing = user?.following?.includes(u.uid);
              return (
                <div key={u.uid} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={u.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-white/10" />
                    <div>
                      <h4 className="font-bold text-xs tracking-tight">{u.username}</h4>
                      <p className={cn("text-[8px] uppercase tracking-widest font-black", rank.color)}>{rank.name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleFollow(u.uid)}
                    className={cn(
                      "px-4 py-1.5 rounded-full font-bold text-[10px] transition-all shadow-sm",
                      isFollowing ? "bg-white/10 text-white" : "bg-white text-black hover:bg-orange-500 hover:text-white"
                    )}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
