import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserRole = 'staff' | 'hr' | 'hod' | 'intern' | 'super-admin';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  register: (email: string, password: string, role: UserRole, employeeData: any) => Promise<void>;
  setOrganization: (orgId: string, orgName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load organization from localStorage on mount
  useEffect(() => {
    const storedOrgId = localStorage.getItem('organizationId');
    const storedOrgName = localStorage.getItem('organizationName');
    if (storedOrgId && storedOrgName) {
      setOrganizationId(storedOrgId);
      setOrganizationName(storedOrgName);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const roleDoc = await getDoc(doc(db, 'user_roles', user.uid));
        if (roleDoc.exists()) {
          const roleData = roleDoc.data();
          const role = roleData.role;
          // Handle legacy 'employee' role as 'staff'
          setUserRole(role === 'employee' ? 'staff' : role);
          
          // Set organization if available and not super-admin
          if (roleData.organizationId && role !== 'super-admin') {
            const orgDocRef = doc(db, 'organizations', roleData.organizationId);
            const orgSnap = await getDoc(orgDocRef);
            if (orgSnap.exists()) {
              const orgData = orgSnap.data();
              setOrganizationId(roleData.organizationId);
              setOrganizationName(orgData.name);
            }
          }
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    // Keep organization in localStorage for next login
    // Only clear the context state
    setOrganizationId(null);
    setOrganizationName(null);
  };

  const setOrganization = (orgId: string, orgName: string) => {
    setOrganizationId(orgId);
    setOrganizationName(orgName);
    localStorage.setItem('organizationId', orgId);
    localStorage.setItem('organizationName', orgName);
  };

  const changePassword = async (newPassword: string) => {
    if (user) {
      await updatePassword(user, newPassword);
    }
  };

  const register = async (email: string, password: string, role: UserRole, employeeData: any) => {
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc, addDoc, collection } = await import('firebase/firestore');
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    // Set user role
    await addDoc(collection(db, 'user_roles'), {
      userId,
      role,
      organizationId: employeeData.organizationId || organizationId,
      createdAt: new Date().toISOString()
    });
    
    // Create employee record
    await setDoc(doc(db, 'employees', userId), {
      ...employeeData,
      userId,
      organizationId: employeeData.organizationId || organizationId,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userRole, 
      organizationId, 
      organizationName, 
      loading, 
      login, 
      logout, 
      changePassword, 
      register,
      setOrganization 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
