import { useAuth } from '@/contexts/AuthContext';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';

const Dashboard = () => {
  const { userRole, user } = useAuth();

  return (
    <Layout pageTitle="Dashboard">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
              {!userRole ? (
                <Card className="max-w-md mx-auto mt-8">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                      <AlertCircle className="h-12 w-12 text-destructive" />
                      <div>
                        <h3 className="font-semibold text-lg">Role Not Assigned</h3>
                        <p className="text-sm text-muted-foreground mt-2">Your account doesn't have a role assigned.</p>
                        <p className="text-xs text-muted-foreground mt-2">User ID: {user?.uid}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : userRole === 'super-admin' ? (
                <SuperAdminDashboard />
              ) : userRole === 'hr' || userRole === 'hod' ? (
                <AdminDashboard />
              ) : (
                <EmployeeDashboard />
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
