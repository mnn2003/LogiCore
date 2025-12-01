import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

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
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const orgsRef = collection(db, 'organizations');
      const q = query(orgsRef, where('isActive', '==', true));

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
      toast.success(
        'Password reset email sent! Please check your inbox and spam folder. Follow the link in the email to reset your password.'
      );
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

  const isCompanyStep = step === 'company';
  const isLoginStep = step === 'login';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/15 via-background to-accent/20 relative overflow-hidden flex items-center justify-center">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 h-60 w-60 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {systemSettings.logoUrl ? (
              <div className="h-10 w-10 overflow-hidden rounded-xl bg-background/70 shadow-sm ring-1 ring-border/40">
                <img
                  src={systemSettings.logoUrl}
                  alt={systemSettings.systemName}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30">
                <span className="text-lg font-semibold">
                  {systemSettings.systemName?.charAt(0)?.toUpperCase() || 'H'}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Welcome to
              </p>
              <h1 className="text-base font-semibold leading-tight">
                {systemSettings.systemName || 'HR Management System'}
              </h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-background/70 px-3 py-1.5 rounded-full border border-border/60 shadow-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            Secure employee & HR portal
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr,1fr] items-stretch">
          {/* Left / Marketing panel */}
          <Card className="hidden lg:flex flex-col justify-between bg-background/80 border-border/60 backdrop-blur-xl shadow-xl">
            <CardContent className="pt-6 pb-6 flex flex-col gap-6">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  HR Suite
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Multi-organization
                </p>

                <h2 className="mt-4 text-2xl font-semibold leading-snug">
                  Modern HR, single login.
                  <span className="block text-base font-normal text-muted-foreground mt-1.5">
                    Switch organizations, manage teams, and access your HR tools from one clean interface.
                  </span>
                </h2>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/40 p-3.5">
                  <div className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Select your organization</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Quickly find your company by name or code. Super admins can skip this step.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/40 p-3.5">
                  <div className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Sign in securely</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Use your employee code or email. Your organization and access level are verified automatically.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/40 p-3.5">
                  <div className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    ✓
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Smart access control</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Blocked users, mismatched organizations, and invalid accounts are automatically handled.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Protected with organizational role checks</span>
                <span className="rounded-full border border-border/70 px-2 py-0.5 bg-background/80">
                  Super admin • HR • Employee
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Right / Auth panel */}
          <Card className="bg-background/90 border-border/70 backdrop-blur-xl shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold">
                    {isCompanyStep
                      ? 'Select your organization'
                      : showForgotPassword
                      ? 'Reset your password'
                      : selectedOrganization
                      ? 'Sign in to your account'
                      : 'Super admin login'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {isCompanyStep
                      ? 'Start by finding your company. We’ll remember this next time.'
                      : showForgotPassword
                      ? 'Enter your email or employee code to receive reset instructions.'
                      : selectedOrganization
                      ? 'Use your employee code or registered email to continue.'
                      : 'Use your email address registered as super admin.'}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-1 rounded-full border border-border/50 px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted/60">
                  <span
                    className={`px-1.5 py-0.5 rounded-full ${
                      isCompanyStep ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    Organization
                  </span>
                  <span className="text-muted-foreground/50">→</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full ${
                      isLoginStep ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    Login
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-2 space-y-5">
              {/* Step: Organization selection */}
              {isCompanyStep && !showForgotPassword && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Search organization
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={companySearch}
                        onChange={e => setCompanySearch(e.target.value)}
                        placeholder="Type company name or code"
                        onKeyDown={e => e.key === 'Enter' && searchOrganizations()}
                        className="text-sm"
                      />
                      <Button
                        onClick={searchOrganizations}
                        className="shrink-0 text-sm font-medium"
                      >
                        Search
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      We’ll filter only active organizations. Your selection will be remembered on
                      this device.
                    </p>
                  </div>

                  {organizations.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Choose from results
                      </label>
                      <div className="max-h-56 space-y-1 overflow-auto pr-1">
                        {organizations.map(org => (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => selectOrganization(org)}
                            className="w-full text-left rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-sm transition-all hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-medium">{org.name}</div>
                                {org.code && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    Code: {org.code}
                                  </div>
                                )}
                              </div>
                              <span className="text-[11px] rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                Select
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-dashed border-border/70" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-background/90 px-3 text-muted-foreground">
                        Or continue as super admin
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full text-sm font-medium"
                    onClick={() => {
                      setSelectedOrganization(null);
                      setStep('login');
                    }}
                  >
                    Login with super admin email
                  </Button>
                </div>
              )}

              {/* Step: Login + Forgot password */}
              {!isCompanyStep && !showForgotPassword && (
                <div className="space-y-5">
                  {selectedOrganization && (
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {selectedOrganization.logoUrl ? (
                          <div className="h-9 w-9 overflow-hidden rounded-full bg-background/70 ring-1 ring-border/40">
                            <img
                              src={selectedOrganization.logoUrl}
                              alt={selectedOrganization.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {selectedOrganization.name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium leading-tight">
                            {selectedOrganization.name}
                          </p>
                          {selectedOrganization.code && (
                            <p className="text-[11px] text-muted-foreground leading-tight">
                              Code: {selectedOrganization.code}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs px-2 py-1 h-auto"
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
                    <div className="rounded-lg border border-blue-300/40 bg-blue-50/70 p-3 text-xs dark:border-blue-800/60 dark:bg-blue-950/70">
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Super admin login
                      </p>
                      <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-300">
                        Sign in using the email address assigned to your super admin account.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {selectedOrganization ? 'Employee code or email' : 'Email'}
                      </label>
                      <Input
                        value={employeeCode}
                        onChange={e => setEmployeeCode(e.target.value)}
                        placeholder={
                          selectedOrganization
                            ? 'e.g. W0115 or admin@company.com'
                            : 'admin@example.com'
                        }
                        type="text"
                        required
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-muted-foreground">Password</label>
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => setShowForgotPassword(true)}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="text-sm"
                      />
                    </div>

                    <Button type="submit" className="w-full text-sm font-medium">
                      Continue
                    </Button>

                    {!selectedOrganization && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full text-xs font-medium mt-1.5"
                        onClick={() => setStep('company')}
                      >
                        Back to organization selection
                      </Button>
                    )}
                  </form>
                </div>
              )}

              {showForgotPassword && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Email address or employee code
                    </label>
                    <Input
                      type="text"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="Enter your email or employee code"
                      required
                      className="text-sm"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      We’ll send a secure link to your registered email address. If you use an
                      employee code, make sure you’ve selected the correct organization.
                    </p>
                  </div>

                  <Button type="submit" className="w-full text-sm font-medium">
                    Send reset link
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-xs"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Back to login
                  </Button>
                </form>
              )}

              {!showForgotPassword && (
                <div className="pt-2 border-t border-dashed border-border/70 mt-2">
                  <p className="text-[11px] text-muted-foreground text-center">
                    Having trouble signing in? Contact your HR or system administrator for access.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
