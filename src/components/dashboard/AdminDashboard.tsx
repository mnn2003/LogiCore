import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Clock, FileText, CalendarCheck } from 'lucide-react';
import BirthdayWidget from './BirthdayWidget';

const AdminDashboard = () => {
  const { userRole, user, organizationId } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingLeaves: 0,
    todayAttendance: 0,
  });
  const [widgetPreferences, setWidgetPreferences] = useState({
    birthdayWidget: true,
    statsCards: true,
    quickActions: true,
    recentActivity: true,
  });

  useEffect(() => {
    fetchStats();
    loadWidgetPreferences();
  }, [user, organizationId]);

  const loadWidgetPreferences = async () => {
    if (!user) return;
    try {
      const prefsDoc = await getDocs(query(collection(db, 'user_preferences'), where('userId', '==', user.uid)));
      if (!prefsDoc.empty && prefsDoc.docs[0].data().dashboardWidgets) {
        setWidgetPreferences(prefsDoc.docs[0].data().dashboardWidgets);
      }
    } catch (error) {
      console.error('Error loading widget preferences:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Total employees - filter by organizationId
      const employeesQuery = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
        : collection(db, 'employees');
      const employeesSnap = await getDocs(employeesQuery);
      const totalEmployees = employeesSnap.size;

      // Pending leaves - filter by organizationId
      const leavesConstraints = [where('status', '==', 'PENDING')];
      if (organizationId) {
        leavesConstraints.push(where('organizationId', '==', organizationId));
      }
      const leavesQuery = query(collection(db, 'leaves'), ...leavesConstraints);
      const leavesSnap = await getDocs(leavesQuery);
      const pendingLeaves = leavesSnap.size;

      // Today's attendance - filter by organizationId
      const today = new Date().toISOString().split('T')[0];
      const attendanceConstraints = [where('date', '==', today)];
      if (organizationId) {
        attendanceConstraints.push(where('organizationId', '==', organizationId));
      }
      const attendanceQuery = query(collection(db, 'attendance'), ...attendanceConstraints);
      const attendanceSnap = await getDocs(attendanceQuery);
      const todayAttendance = attendanceSnap.size;

      setStats({ totalEmployees, pendingLeaves, todayAttendance });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-4 md:space-y-6">
        {/* Overview Content */}
        {widgetPreferences.statsCards && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">Active in system</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingLeaves}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayAttendance}</div>
                <p className="text-xs text-muted-foreground">Employees present</p>
              </CardContent>
            </Card>
          </div>
        )}

        {widgetPreferences.birthdayWidget && <BirthdayWidget />}

        {(widgetPreferences.quickActions || widgetPreferences.recentActivity) && (
          <div className="grid gap-4 md:grid-cols-2">
            {widgetPreferences.quickActions && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {userRole === 'hr' && (
                    <Button 
                      onClick={() => navigate('/employees')}
                      variant="outline"
                      className="w-full justify-start h-auto p-3"
                    >
                      <div className="text-left">
                        <div className="font-medium">Manage Employees</div>
                        <div className="text-sm text-muted-foreground">Add, edit, or remove employees</div>
                      </div>
                    </Button>
                  )}
                  <Button 
                    onClick={() => navigate('/leave-approvals')}
                    variant="outline"
                    className="w-full justify-start h-auto p-3"
                  >
                    <div className="text-left">
                      <div className="font-medium">Review Leave Requests</div>
                      <div className="text-sm text-muted-foreground">Approve or reject pending leaves</div>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            )}

            {widgetPreferences.recentActivity && (
              <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {stats.pendingLeaves > 0 && (
                    <div className="flex items-start gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500 mt-1.5" />
                      <div>
                        <p className="font-medium">{stats.pendingLeaves} leave request(s) pending</p>
                        <p className="text-muted-foreground">Requires your attention</p>
                      </div>
                    </div>
                  )}
                  {stats.todayAttendance > 0 && (
                    <div className="flex items-start gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                      <div>
                        <p className="font-medium">{stats.todayAttendance} employee(s) checked in today</p>
                        <p className="text-muted-foreground">Attendance recorded</p>
                      </div>
                    </div>
                  )}
                  {stats.pendingLeaves === 0 && stats.todayAttendance === 0 && (
                    <p className="text-muted-foreground">No recent activity</p>
                  )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
