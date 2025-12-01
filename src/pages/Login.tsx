import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { Building, User, Lock, Mail, Search, ArrowLeft, Eye, EyeOff, CheckCircle, Globe } from 'lucide-react';

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
    systemName: 'LogiCore',
    logoUrl: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg mb-4">
            <Globe className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">HR Management System</h1>
          <p className="text-gray-600 mt-2">Sign in to access your account</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center text-gray-900">
              {step === 'company' ? 'Select Your Company' : 'Sign In to Your Account'}
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              {step === 'company' 
                ? 'Search for your organization to continue' 
                : selectedOrganization 
                  ? `Continue to ${selectedOrganization.name}` 
                  : 'Enter your credentials to continue'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {step === 'company' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companySearch" className="text-sm font-medium text-gray-700">
                    Search Your Company
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="companySearch"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Company name or code"
                      onKeyDown={(e) => e.key === 'Enter' && searchOrganizations()}
                      className="pl-10 bg-gray-50 border-gray-200"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={searchOrganizations} 
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search Organization
                </Button>
                
                {organizations.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <div className="text-sm font-medium text-gray-700">Select Organization</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {organizations.map((org) => (
                        <div
                          key={org.id}
                          onClick={() => selectOrganization(org)}
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Building className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{org.name}</div>
                            {org.code && (
                              <div className="text-xs text-gray-500">Code: {org.code}</div>
                            )}
                          </div>
                          <div className="p-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue as</span>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full border-gray-300 hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => {
                    setSelectedOrganization(null);
                    setStep('login');
                  }}
                >
                  <User className="h-4 w-4 mr-2" />
                  Super Admin / System Admin
                </Button>
              </div>
            ) : !showForgotPassword ? (
              <div className="space-y-4">
                {/* Organization Display */}
                {selectedOrganization && (
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border border-blue-200">
                          <Building className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-blue-900">{selectedOrganization.name}</div>
                          <div className="text-xs text-blue-700">
                            {selectedOrganization.code && `Code: ${selectedOrganization.code}`}
                          </div>
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
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Change
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Super Admin Notice */}
                {!selectedOrganization && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border border-purple-200">
                        <User className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium text-purple-900">Super Admin Login</div>
                        <div className="text-xs text-purple-700">Use your system administrator credentials</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeCode" className="text-sm font-medium text-gray-700">
                      {selectedOrganization ? 'Employee Code or Email' : 'Email Address'}
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="employeeCode"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        placeholder={selectedOrganization ? "e.g., W0115 or admin@company.com" : "admin@example.com"}
                        className="pl-10 bg-gray-50 border-gray-200"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 bg-gray-50 border-gray-200"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-blue-600 hover:text-blue-800"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm"
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
                      className="w-full border-gray-300 hover:border-blue-300 hover:bg-blue-50"
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
                    className="p-0 h-auto"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h3 className="font-semibold text-gray-900">Reset Password</h3>
                    <p className="text-sm text-gray-600">Enter your details to receive reset instructions</p>
                  </div>
                </div>
                
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail" className="text-sm font-medium text-gray-700">
                      Email Address or Employee Code
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="resetEmail"
                        type="text"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Enter your email or employee code"
                        className="pl-10 bg-gray-50 border-gray-200"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      We'll send a password reset link to your registered email address
                    </p>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
          
          <div className="px-6 pb-6">
            <div className="text-center text-xs text-gray-500">
              <p>© {new Date().getFullYear()} LogiCore – Intelligent Workforce Management. All rights reserved.</p>
              <p className="mt-1">Secure login with enterprise-grade authentication</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
