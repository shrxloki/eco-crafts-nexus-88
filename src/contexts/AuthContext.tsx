import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// User profile type
interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  verified?: boolean;
  rating?: number;
  totalSales?: number;
  totalPurchases?: number;
  memberSince?: string;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setUserProfile({
          id: data.id,
          email: user?.email || '',
          firstName: data.first_name,
          lastName: data.last_name,
          avatar: data.avatar_url,
          bio: data.bio,
          location: data.location,
          verified: data.verified || false,
          rating: data.rating || 0,
          totalSales: data.total_sales || 0,
          totalPurchases: data.total_purchases || 0,
          memberSince: data.created_at
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
        
        if (session?.user) {
          fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: fullName ? {
          full_name: fullName
        } : undefined
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link to complete your signup.",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    });

    if (error) {
      toast({
        title: "Google sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: "Sign out failed", 
        description: error.message,
        variant: "destructive",
      });
    }

  return { error };
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: { message: 'No user logged in' } };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: updates.firstName,
          last_name: updates.lastName,
          avatar_url: updates.avatar,
          bio: updates.bio,
          location: updates.location
        })
        .eq('id', user.id);

      if (error) {
        toast({
          title: "Update failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...updates } : null);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const value = {
    user,
    userProfile,
    session,
    isAuthenticated,
    isLoading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};