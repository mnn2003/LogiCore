import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Building2, Users, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OrganizationStats {
  totalOrganizations: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
  totalEmployees: number;
  activeSubscriptions: number;
}

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OrganizationStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    inactiveOrganizations: 0,
    totalEmployees: 0,
    activeSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch organizations
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));
      const organizations = orgsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const activeOrgs = organizations.filter((org: any) => org.isActive);
      const inactiveOrgs = organizations.filter((org: any) => !org.isActive);
      const activeSubs = organizations.filter((org: any) => org.subscriptionStatus === 'active');
      
      // Fetch total employees across all organizations
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const totalEmployees = employeesSnapshot.size;

      setStats({
        totalOrganizations: organizations.length,
        activeOrganizations: activeOrgs.length,
        inactiveOrganizations: inactiveOrgs.length,
        totalEmployees,
        activeSubscriptions: activeSubs.length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    onClick 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    color: string;
    onClick?: () => void;
  }) => (
    <Card 
      className={onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? '...' : value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h2>
        <p className="text-muted-foreground mt-2">
          Overview of all organizations and system statistics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Organizations"
          value={stats.totalOrganizations}
          icon={Building2}
          color="text-blue-600"
          onClick={() => navigate('/admin/organizations')}
        />
        <StatCard
          title="Active Organizations"
          value={stats.activeOrganizations}
          icon={CheckCircle}
          color="text-green-600"
          onClick={() => navigate('/admin/organizations')}
        />
        <StatCard
          title="Inactive Organizations"
          value={stats.inactiveOrganizations}
          icon={XCircle}
          color="text-red-600"
          onClick={() => navigate('/admin/organizations')}
        />
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon={Users}
          color="text-purple-600"
        />
        <StatCard
          title="Active Subscriptions"
          value={stats.activeSubscriptions}
          icon={TrendingUp}
          color="text-emerald-600"
          onClick={() => navigate('/admin/organizations')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => navigate('/admin/organizations')}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Manage Organizations</p>
                  <p className="text-xs text-muted-foreground">Create and manage organizations</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">System Settings</p>
                  <p className="text-xs text-muted-foreground">Configure system preferences</p>
                </div>
              </div>
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <span className="text-sm font-medium text-green-600">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Authentication</span>
                <span className="text-sm font-medium text-green-600">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage</span>
                <span className="text-sm font-medium text-green-600">Operational</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
