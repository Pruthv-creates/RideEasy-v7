
import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type UserRole = "rider" | "driver" | "admin" | null;

interface AuthContextType {
    user: User | null;
    role: UserRole;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    loading: true,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserRole(session.user);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserRole(session.user);
            } else {
                setRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchUserRole = async (user: User) => {
        const userId = user.id;
        try {
            // Process intended role from OAuth sign-ups
            const intendedRole = localStorage.getItem('intended_role');
            
            // Always ensure a profile exists for the logged in user
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userId)
                .single();

            if (!existingProfile || intendedRole) {
                const { error: upsertError } = await supabase
                    .from("profiles")
                    .upsert({ 
                        id: userId, 
                        role: intendedRole || existingProfile?.role || 'rider',
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.user_metadata?.name,
                    }, { onConflict: 'id' });
                
                if (!upsertError) {
                    if (intendedRole) {
                        console.log(`[Auth] Assigned user ${userId} to intended role: ${intendedRole}`);
                    }
                    localStorage.removeItem('intended_role');
                } else {
                    console.error("[Auth] Profile sync error:", upsertError);
                }
            }

            // Finally, fetch the role to update state
            const { data, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userId)
                .single();

            if (error) {
                console.error("Error fetching role:", error);
            } else {
                setRole(data?.role as UserRole);
            }
        } catch (err) {
            console.error("Error in fetchUserRole:", err);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setRole(null);
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
