import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Building, User, Lock, Mail, Search, ArrowLeft, Eye, EyeOff, CheckCircle, ChevronRight, Key, Briefcase } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const { login, logout, setOrganization } = useAuth();
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
    
    setSearchLoading(true);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
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
    } finally {
      setSearchLoading(false);
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
    setLoading(true);
    
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
        setLoading(false);
        return;
      }
      
      // Check user role
      const roleDoc = await getDoc(doc(db, 'user_roles', currentUser.uid));
      const isSuperAdmin = roleDoc.exists() && roleDoc.data().role === 'super-admin';
      
      // Super-admin can login without selecting organization
      if (isSuperAdmin) {
        toast.success('Welcome Super Admin!');
        navigate('/dashboard');
        setLoading(false);
        return;
      }
      
      // Regular users must select organization
      if (!selectedOrganization) {
        toast.error('Please select an organization first');
        await logout();
        setLoading(false);
        return;
      }
      
      // Check if user belongs to selected organization
      const employeeDoc = await getDoc(doc(db, 'employees', currentUser.uid));
      if (!employeeDoc.exists()) {
        toast.error('Employee record not found');
        await logout();
        setLoading(false);
        return;
      }
      
      const employeeData = employeeDoc.data();
      
      // Check if user is blocked
      if (employeeData.isBlocked) {
        toast.error('Your account has been blocked. Please contact HR.');
        await logout();
        setLoading(false);
        return;
      }
      
      // Check organization match
      if (employeeData.organizationId !== selectedOrganization.id) {
        toast.error('You do not belong to this organization');
        await logout();
        setLoading(false);
        return;
      }
      
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let emailToReset = resetEmail.trim();
      
      // If not an email format, lookup employee by code
      if (!emailToReset.includes('@')) {
        if (!selectedOrganization) {
          toast.error('Please select your organization first');
          setShowForgotPassword(false);
          setStep('company');
          setLoading(false);
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
            setLoading(false);
            return;
          }
          emailToReset = employeeData.email;
        } else {
          toast.error('Employee not found. Please check your employee code.');
          setLoading(false);
          return;
        }
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailToReset)) {
        toast.error('Invalid email address format.');
        setLoading(false);
        return;
      }
      
      // Send password reset email
      await sendPasswordResetEmail(auth, emailToReset);
      toast.success('Password reset email sent! Please check your inbox and spam folder.');
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
      } else {
        toast.error('Failed to send reset email. Please try again or contact your HR administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            {step === 'login' && selectedOrganization ? (
              <>
                {/* Organization Logo Display */}
                {selectedOrganization.logoUrl ? (
                  <div className="w-20 h-20 rounded-full border-2 border-primary/20 p-1">
                    <img 
                      src={selectedOrganization.logoUrl} 
                      alt={selectedOrganization.name} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/20 flex items-center justify-center">
                    <div className="text-3xl font-bold text-primary">
                      {selectedOrganization.name?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
              </>
            ) : step === 'login' && !selectedOrganization ? (
              // Super Admin Logo
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <User className="h-10 w-10 text-white" />
              </div>
            ) : (
              // Default System Logo
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Briefcase className="h-10 w-10 text-white" />
              </div>
            )}
            
            <CardTitle className="text-2xl font-bold text-center">
              {step === 'company' ? 'Select Your Organization' : 
               step === 'login' && selectedOrganization ? selectedOrganization.name : 
               'HR Management System'}
            </CardTitle>
            
            <p className="text-muted-foreground text-center text-sm">
              {step === 'company' 
                ? 'Search for your company to continue' 
                : step === 'login' && selectedOrganization
                  ? 'Enter your credentials to access your account'
                  : 'System Administrator Login'}
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          {step === 'company' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companySearch" className="text-sm font-medium">
                  Search Organization
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companySearch"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Company name or code"
                    onKeyDown={(e) => e.key === 'Enter' && searchOrganizations()}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button 
                onClick={searchOrganizations} 
                className="w-full bg-primary hover:bg-primary/90"
                disabled={searchLoading}
              >
                {searchLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search Organization
                  </>
                )}
              </Button>
              
              {organizations.length > 0 && (
                <div className="space-y-2 mt-4">
                  <Label className="text-sm font-medium">Select Organization</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {organizations.map((org) => (
                      <div
                        key={org.id}
                        onClick={() => selectOrganization(org)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-200"
                      >
                        <div className="flex-shrink-0">
                          {org.logoUrl ? (
                            <img 
                              src={org.logoUrl} 
                              alt={org.name}
                              className="w-10 h-10 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-semibold text-primary">
                                {org.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{org.name}</div>
                          {org.code && (
                            <div className="text-xs text-muted-foreground truncate">
                              Code: {org.code}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="relative my-4">
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
                className="w-full border-primary/30 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  setSelectedOrganization(null);
                  setStep('login');
                }}
              >
                <User className="h-4 w-4 mr-2" />
                Login as Super Admin
              </Button>
            </div>
          ) : !showForgotPassword ? (
            <div className="space-y-4">
              {/* Organization Display with Logo */}
              {selectedOrganization && (
                <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedOrganization.logoUrl ? (
                        <img 
                          src={selectedOrganization.logoUrl} 
                          alt={selectedOrganization.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xl font-bold text-primary">
                            {selectedOrganization.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-primary">
                          {selectedOrganization.name}
                        </div>
                        {selectedOrganization.code && (
                          <div className="text-xs text-muted-foreground">
                            Code: {selectedOrganization.code}
                          </div>
                        )}
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
                      className="text-muted-foreground hover:text-primary"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Super Admin Notice */}
              {!selectedOrganization && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-purple-900 dark:text-purple-100">Super Admin Login</div>
                      <div className="text-sm text-purple-700 dark:text-purple-300">
                        Use your email address to login
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeCode" className="text-sm font-medium">
                    {selectedOrganization ? 'Employee Code or Email' : 'Email Address'}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="employeeCode"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      placeholder={selectedOrganization ? "e.g., W0115 or admin@company.com" : "admin@example.com"}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 h-auto text-sm text-primary hover:text-primary/80"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    <Key className="h-3 w-3 mr-1" />
                    Forgot Password?
                  </Button>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
                
                {!selectedOrganization && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2 border-primary/30 hover:border-primary hover:bg-primary/5"
                    onClick={() => setStep('company')}
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Back to Organization Selection
                  </Button>
                )}
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Forgot Password Form */}
              <div className="flex items-center gap-2 mb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForgotPassword(false)}
                  className="p-0 h-auto text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h3 className="font-semibold text-lg">Reset Password</h3>
                  <p className="text-sm text-muted-foreground">Enter your details to receive reset instructions</p>
                </div>
              </div>
              
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail" className="text-sm font-medium">
                    Email Address or Employee Code
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="resetEmail"
                      type="text"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email or employee code"
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedOrganization 
                      ? "Enter your registered email address or employee code"
                      : "Enter your registered email address"
                    }
                  </p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Reset Link
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
