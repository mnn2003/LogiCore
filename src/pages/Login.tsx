import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth';

const Login = () => {
  const [step, setStep] = useState<'company' | 'login'>('company');
  const [companySearch, setCompanySearch] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [systemSettings, setSystemSettings] = useState({
    systemName: 'HR Management System',
    logoUrl: ''
  });
  const { login, logout, setOrganization, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadSystemSettings();
    checkCachedOrganization();
  }, []);

  const checkCachedOrganization = async () => {
    const cachedOrgId = localStorage.getItem('organizationId');
    const cachedOrgName = localStorage.getItem('organizationName');
    if (cachedOrgId && cachedOrgName) {
      try {
        // Fetch full organization data including logo
        const orgDoc = await getDoc(doc(db, 'organizations', cachedOrgId));
        if (orgDoc.exists()) {
          setSelectedOrganization({ id: cachedOrgId, ...orgDoc.data() });
        } else {
          setSelectedOrganization({ id: cachedOrgId, name: cachedOrgName });
        }
      } catch (error) {
        console.error('Error loading cached organization:', error);
        setSelectedOrganization({ id: cachedOrgId, name: cachedOrgName });
      }
      setStep('login');
    }
  };

  const loadSystemSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'system_settings', 'general'));
      if (settingsDoc.exists()) {
        setSystemSettings(settingsDoc.data() as any);
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  };

  const searchOrganizations = async () => {
    if (!companySearch.trim()) {
      toast.error('Please enter company name or code');
      return;
    }
    
    try {
      const { collection, query, where, getDocs, or } = await import('firebase/firestore');
      const orgsRef = collection(db, 'organizations');
      const q = query(
        orgsRef,
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const orgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((org: any) => 
          org.name.toLowerCase().includes(companySearch.toLowerCase()) ||
          org.code?.toLowerCase().includes(companySearch.toLowerCase())
        );
      
      setOrganizations(orgs);
      
      if (orgs.length === 0) {
        toast.error('No active organizations found');
      }
    } catch (error) {
      console.error('Error searching organizations:', error);
      toast.error('Failed to search organizations');
    }
  };

  const selectOrganization = async (org: any) => {
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', org.id));
      const orgData = orgDoc.exists() ? { id: org.id, ...orgDoc.data() } : org;
      console.log('Selected organization data:', orgData);
      setSelectedOrganization(orgData);
      setOrganization(org.id, org.name);
      setStep('login');
    } catch (error) {
      console.error('Error fetching organization details:', error);
      setSelectedOrganization(org);
      setOrganization(org.id, org.name);
      setStep('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let loginEmail = employeeCode;
      
      // If not an email format, lookup employee by code
      if (!employeeCode.includes('@')) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const employeesRef = collection(db, 'employees');
        const q = query(
          employeesRef,
          where('employeeCode', '==', employeeCode.trim()),
          where('organizationId', '==', selectedOrganization?.id || '')
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const employeeData = snapshot.docs[0].data();
          loginEmail = employeeData.email || `${employeeCode}@company.local`;
        } else {
          // Fallback for old format users
          loginEmail = `${employeeCode}@company.local`;
        }
      }
      
      // Login with Firebase Auth
      await login(loginEmail, password);
      
      // Get current user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error('Login failed');
        return;
      }
      
      // Check user role
      const roleDoc = await getDoc(doc(db, 'user_roles', currentUser.uid));
      const isSuperAdmin = roleDoc.exists() && roleDoc.data().role === 'super-admin';
      
      // Super-admin can login without selecting organization
      if (isSuperAdmin) {
        toast.success('Welcome Super Admin!');
        navigate('/dashboard');
        return;
      }
      
      // Regular users must select organization
      if (!selectedOrganization) {
        toast.error('Please select an organization first');
        await logout();
        return;
      }
      
      // Check if user belongs to selected organization
      const employeeDoc = await getDoc(doc(db, 'employees', currentUser.uid));
      if (!employeeDoc.exists()) {
        toast.error('Employee record not found');
        await logout();
        return;
      }
      
      const employeeData = employeeDoc.data();
      
      // Check if user is blocked
      if (employeeData.isBlocked) {
        toast.error('Your account has been blocked. Please contact HR.');
        await logout();
        return;
      }
      
      // Check organization match
      if (employeeData.organizationId !== selectedOrganization.id) {
        toast.error('You do not belong to this organization');
        await logout();
        return;
      }
      
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Invalid credentials');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let emailToReset = resetEmail.trim();
      
      // If not an email format, lookup employee by code
      if (!emailToReset.includes('@')) {
        if (!selectedOrganization) {
          toast.error('Please select your organization first');
          setShowForgotPassword(false);
          setStep('company');
          return;
        }
        
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const employeesRef = collection(db, 'employees');
        const q = query(
          employeesRef,
          where('employeeCode', '==', emailToReset),
          where('organizationId', '==', selectedOrganization.id)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const employeeData = snapshot.docs[0].data();
          if (!employeeData.email) {
            toast.error('No email address found for this employee code. Please contact HR.');
            return;
          }
          emailToReset = employeeData.email;
        } else {
          toast.error('Employee not found. Please check your employee code.');
          return;
        }
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailToReset)) {
        toast.error('Invalid email address format.');
        return;
      }
      
      // Send password reset email without custom redirect URL
      await sendPasswordResetEmail(auth, emailToReset);
      toast.success('Password reset email sent! Please check your inbox and spam folder. Follow the link in the email to reset your password.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email. Please contact your HR administrator.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address format.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your internet connection.');
      } else if (error.code === 'auth/unauthorized-continue-uri') {
        toast.error('Configuration error. Please contact your system administrator.');
      } else {
        toast.error('Failed to send reset email. Please try again or contact your HR administrator.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center gap-4">
            {step === 'login' && selectedOrganization && (
              <>
                {selectedOrganization.logoUrl ? (
                  <img 
                    src={selectedOrganization.logoUrl} 
                    alt={selectedOrganization.name} 
                    className="w-20 h-20 object-contain"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {selectedOrganization.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </>
            )}
            <CardTitle className="text-2xl text-center">
              {step === 'company' ? 'Select Your Organization' : 
               step === 'login' && selectedOrganization ? selectedOrganization.name : 
               'HR Management System'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'company' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Search Organization</label>
                <Input
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Company name or code"
                  onKeyDown={(e) => e.key === 'Enter' && searchOrganizations()}
                />
              </div>
              <Button onClick={searchOrganizations} className="w-full">
                Search
              </Button>
              
              {organizations.length > 0 && (
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium">Select Organization</label>
                  {organizations.map((org) => (
                    <Button
                      key={org.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => selectOrganization(org)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{org.name}</div>
                        {org.code && <div className="text-xs text-muted-foreground">Code: {org.code}</div>}
                      </div>
                    </Button>
                  ))}
                </div>
              )}
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSelectedOrganization(null);
                  setStep('login');
                }}
              >
                Login as Super Admin
              </Button>
            </div>
          ) : !showForgotPassword ? (
            <div className="space-y-4">
              {selectedOrganization && (
                <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{selectedOrganization?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedOrganization?.code && `Code: ${selectedOrganization.code}`}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setStep('company');
                      setOrganizations([]);
                      setCompanySearch('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
              
              {!selectedOrganization && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Super Admin Login</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Use your email address to login
                  </p>
                </div>
              )}
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    {selectedOrganization ? 'Employee Code or Email' : 'Email'}
                  </label>
                  <Input
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder={selectedOrganization ? "e.g., W0115 or admin@company.com" : "admin@example.com"}
                    type="text"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Login
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot Password?
                </Button>
                
                {!selectedOrganization && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setStep('company')}
                  >
                    Back to Organization Selection
                  </Button>
                )}
              </form>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email Address or Employee Code</label>
                <Input
                  type="text"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email or employee code"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your registered email address or employee code to receive password reset instructions.
                </p>
              </div>
              <Button type="submit" className="w-full">
                Send Reset Link
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
              >
                Back to Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
