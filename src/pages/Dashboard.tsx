import { useAuth } from '@/contexts/AuthContext';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, Shield, Users, User, Loader2, Activity } from 'lucide-react';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const { userRole, user, loading } = useAuth();

  // Loading state
  if (loading) {
    return (
      <Layout pageTitle="Dashboard">
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            
            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/50 backdrop-blur-sm border border-gray-200">
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Content Area Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="bg-white/50 backdrop-blur-sm border border-gray-200">
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Role-based dashboard selection with role-specific headers
  const renderDashboardHeader = () => {
    if (!userRole) return null;

    const roleConfig = {
      'super-admin': {
        title: 'Super Admin Dashboard',
        description: 'Manage system-wide settings, organizations, and users',
        icon: Shield,
        color: 'from-purple-600 to-pink-600'
      },
      'hr': {
        title: 'HR Dashboard',
        description: 'Manage employees, attendance, leaves, and payroll',
        icon: Users,
        color: 'from-blue-600 to-cyan-600'
      },
      'hod': {
        title: 'Department Head Dashboard',
        description: 'Manage team members, approvals, and department activities',
        icon: User,
        color: 'from-green-600 to-emerald-600'
      },
      'employee': {
        title: 'Employee Dashboard',
        description: 'Your personal dashboard with work overview and activities',
        icon: User,
        color: 'from-orange-500 to-red-500'
      }
    };

    const config = roleConfig[userRole] || roleConfig.employee;
    const IconComponent = config.icon;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className={`p-3 bg-gradient-to-br ${config.color} rounded-xl shadow-lg`}>
            <IconComponent className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{config.title}</h1>
            <p className="text-gray-600 mt-1">{config.description}</p>
          </div>
        </div>
        
        {/* Welcome message and user info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
          <div className="text-sm text-gray-600">
            Welcome back, <span className="font-semibold text-gray-900">{user?.displayName || 'User'}</span>
            {user?.email && (
              <span className="text-gray-500 ml-2">• {user.email}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
              <Activity className="h-3 w-3 text-green-500" />
              <span className="text-xs font-medium text-gray-700">Active</span>
            </div>
            <div className="text-xs px-3 py-1.5 bg-gray-100 rounded-full text-gray-700">
              Role: <span className="font-semibold capitalize">{userRole.replace('-', ' ')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout pageTitle="Dashboard">
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Dashboard Header */}
          {userRole && renderDashboardHeader()}

          {/* Role-based Dashboard Content */}
          {!userRole ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md mx-auto border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-center space-y-6">
                    <div className="p-4 bg-red-100 rounded-full">
                      <AlertCircle className="h-12 w-12 text-red-600" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-900">Role Not Assigned</h3>
                      <p className="text-gray-600">
                        Your account doesn't have a role assigned yet. Please contact your administrator.
                      </p>
                      <div className="text-sm text-gray-500 mt-4 space-y-1">
                        <p className="font-mono text-xs bg-gray-100 px-3 py-2 rounded">
                          User ID: {user?.uid}
                        </p>
                        {user?.email && (
                          <p className="font-mono text-xs bg-gray-100 px-3 py-2 rounded">
                            Email: {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pt-4">
                      <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <Loader2 className="h-4 w-4" />
                        Refresh Page
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Additional Help */}
              <div className="mt-8 text-center max-w-md">
                <p className="text-sm text-gray-500">
                  If you believe this is an error, please contact your HR department or system administrator.
                </p>
              </div>
            </div>
          ) : userRole === 'super-admin' ? (
            <SuperAdminDashboard />
          ) : userRole === 'hr' || userRole === 'hod' ? (
            <AdminDashboard />
          ) : (
            <EmployeeDashboard />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
