import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Calendar, Phone, Mail, DollarSign } from 'lucide-react';
import BirthdayWidget from './BirthdayWidget';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [widgetPreferences, setWidgetPreferences] = useState({
    birthdayWidget: true,
    todayAttendance: true,
    profileCard: true,
    workStats: true,
    teamStats: true,
    quickActions: true,
  });
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [stats, setStats] = useState({
    avgWorkHours: 0,
    weeklyTrend: '+0.5%',
    onsiteTeam: 80,
    remoteTeam: 20,
    weeklyHours: [0, 0, 0, 0, 0, 0, 0]
  });
  const [todayAttendance, setTodayAttendance] = useState<any>(null);

  useEffect(() => {
    fetchEmployeeData();
    calculateWorkStats();
    fetchTodayAttendance();
    loadWidgetPreferences();
  }, [user]);

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

  const fetchTodayAttendance = async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        where('date', '==', today)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setTodayAttendance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };

  const fetchEmployeeData = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setEmployeeData({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const calculateWorkStats = async () => {
    if (!user) return;
    try {
      // Get last 7 days of attendance
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      
      const records = snapshot.docs.map(doc => doc.data());
      const weeklyHours = [0, 0, 0, 0, 0, 0, 0];
      let totalHours = 0;
      let daysWorked = 0;

      records.forEach((record: any) => {
        if (record.punchIn && record.punchOut) {
          const hours = (new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime()) / (1000 * 60 * 60);
          const recordDate = new Date(record.date);
          const daysDiff = Math.floor((new Date().getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff >= 0 && daysDiff < 7) {
            weeklyHours[6 - daysDiff] = hours;
            totalHours += hours;
            daysWorked++;
          }
        }
      });

      const avgHours = daysWorked > 0 ? totalHours / daysWorked : 0;
      
      setStats(prev => ({
        ...prev,
        avgWorkHours: parseFloat(avgHours.toFixed(1)),
        weeklyHours
      }));
    } catch (error) {
      console.error('Error calculating work stats:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
          {getGreeting()} {employeeData?.name || user?.email?.split('@')[0] || 'User'}
        </h1>
      </div>

      <div className="space-y-4 md:space-y-6">
        {/* Overview Content */}
        {widgetPreferences.birthdayWidget && <BirthdayWidget />}

        {/* Today's Punch Status */}
        {widgetPreferences.todayAttendance && todayAttendance && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Today's Attendance</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6 flex-wrap">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Punch In</p>
                      <p className="text-xl font-bold text-green-600">
                        {new Date(todayAttendance.punchIn).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                    </div>
                    {todayAttendance.punchOut && (
                      <>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Punch Out</p>
                          <p className="text-xl font-bold text-red-600">
                            {new Date(todayAttendance.punchOut).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
                          <p className="text-xl font-bold text-primary">
                            {((new Date(todayAttendance.punchOut).getTime() - new Date(todayAttendance.punchIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} hrs
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Profile Card */}
          {widgetPreferences.profileCard && (
            <Card className="lg:col-span-1 bg-gradient-to-br from-secondary/20 to-primary/10 border-primary/20">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className="w-32 h-32">
                    <AvatarImage src={employeeData?.photoURL} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {employeeData?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{employeeData?.name || 'Employee'}</h3>
                    <p className="text-muted-foreground">{employeeData?.designation || 'Staff'}</p>
                  </div>
                  <Badge className="bg-foreground text-background px-4 py-2">
                    {employeeData?.experience || '0'}+ years experience
                  </Badge>
                  <div className="flex gap-2 w-full">
                    <Button size="icon" variant="outline" className="rounded-full flex-1">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="rounded-full flex-1 bg-foreground text-background">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Stats */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {widgetPreferences.workStats && (
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{stats.avgWorkHours}</div>
                      <Badge variant="secondary" className="bg-accent text-accent-foreground">
                        {stats.weeklyTrend}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">avg hours / week</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">2 Hours</span>
                      <span className="text-muted-foreground">10 Hours</span>
                    </div>
                    <div className="h-16 flex items-end gap-1">
                      {stats.weeklyHours.map((hours, i) => (
                        <div 
                          key={i} 
                          className="flex-1 bg-secondary rounded-t transition-all" 
                          style={{ height: hours > 0 ? `${Math.min((hours / 10) * 100, 100)}%` : '4%' }} 
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {widgetPreferences.teamStats && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg">Team Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-secondary" />
                        <span className="text-sm">Onsite team</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{stats.onsiteTeam}%</span>
                        <Badge variant="secondary" className="bg-accent text-accent-foreground">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +2.6%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-info" />
                        <span className="text-sm">Remote team</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{stats.remoteTeam}%</span>
                        <Badge variant="secondary" className="bg-accent text-accent-foreground">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +2.6%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {widgetPreferences.quickActions && (
              <Card className="md:col-span-2 border-primary/20">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <Button onClick={() => navigate('/attendance')} className="h-auto py-3 md:py-4 flex-col gap-2">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs">Attendance</span>
                  </Button>
                  <Button onClick={() => navigate('/leave')} variant="outline" className="h-auto py-3 md:py-4 flex-col gap-2">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs">Leave Request</span>
                  </Button>
                  <Button onClick={() => navigate('/salary')} variant="outline" className="h-auto py-3 md:py-4 flex-col gap-2">
                    <DollarSign className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs">Salary</span>
                  </Button>
                  <Button onClick={() => navigate('/profile')} variant="outline" className="h-auto py-3 md:py-4 flex-col gap-2">
                    <Users className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs">Profile</span>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
