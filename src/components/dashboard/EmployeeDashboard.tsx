import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Phone, Mail, DollarSign, Clock, TrendingUp, Home, Briefcase } from 'lucide-react';
import BirthdayWidget from './BirthdayWidget';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [stats, setStats] = useState({
    avgWorkHours: 0,
    weeklyTrend: '+0.5%',
    weeklyHours: [0, 0, 0, 0, 0, 0, 0]
  });

  useEffect(() => {
    fetchEmployeeData();
    fetchTodayAttendance();
    calculateWorkStats();
  }, [user]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {getGreeting()}, {employeeData?.name || user?.displayName || 'Employee'}!
        </h1>
        <p className="text-gray-600">Here's your dashboard overview</p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile & Attendance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Attendance */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-gray-900">Today's Attendance</h3>
                  <p className="text-sm text-gray-600">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {todayAttendance ? 'Present' : 'Not Checked In'}
                </Badge>
              </div>
              
              {todayAttendance && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      Punch In
                    </div>
                    <p className="text-xl font-semibold text-green-600">
                      {new Date(todayAttendance.punchIn).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  {todayAttendance.punchOut && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          Punch Out
                        </div>
                        <p className="text-xl font-semibold text-red-600">
                          {new Date(todayAttendance.punchOut).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          Total Hours
                        </div>
                        <p className="text-xl font-semibold text-blue-600">
                          {((new Date(todayAttendance.punchOut).getTime() - new Date(todayAttendance.punchIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} hrs
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work Hours Statistics */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-gray-900">Weekly Work Hours</CardTitle>
                <Badge className="bg-green-50 text-green-700 border-green-200">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {stats.weeklyTrend}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Average Hours / Day</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.avgWorkHours}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">This Week</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {(stats.weeklyHours.reduce((a, b) => a + b, 0)).toFixed(1)} hrs
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                  <div className="h-16 flex items-end gap-1">
                    {stats.weeklyHours.map((hours, i) => (
                      <div 
                        key={i} 
                        className="flex-1 bg-gradient-to-t from-blue-500 to-blue-600 rounded-t transition-all hover:opacity-90" 
                        style={{ 
                          height: hours > 0 ? `${Math.min((hours / 10) * 100, 100)}%` : '4%',
                          minHeight: '4px'
                        }} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button 
                  onClick={() => navigate('/attendance')}
                  className="flex flex-col h-20 gap-2 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 hover:border-blue-300 hover:from-blue-100 hover:to-blue-200"
                >
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Attendance</span>
                </Button>
                
                <Button 
                  onClick={() => navigate('/leave')}
                  className="flex flex-col h-20 gap-2 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 hover:border-green-300 hover:from-green-100 hover:to-green-200"
                >
                  <Calendar className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Leave</span>
                </Button>
                
                <Button 
                  onClick={() => navigate('/salary')}
                  className="flex flex-col h-20 gap-2 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 hover:border-amber-300 hover:from-amber-100 hover:to-amber-200"
                >
                  <DollarSign className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Salary</span>
                </Button>
                
                <Button 
                  onClick={() => navigate('/profile')}
                  className="flex flex-col h-20 gap-2 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 hover:border-purple-300 hover:from-purple-100 hover:to-purple-200"
                >
                  <Users className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Profile</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Profile & Team */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <Avatar className="w-24 h-24 border-4 border-white shadow-md">
                  <AvatarImage src={employeeData?.photoURL} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl">
                    {employeeData?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{employeeData?.name || 'Employee'}</h3>
                  <p className="text-gray-600">{employeeData?.designation || 'Staff'}</p>
                  <Badge className="mt-2 bg-blue-100 text-blue-700 hover:bg-blue-100">
                    {employeeData?.department || 'Department'}
                  </Badge>
                </div>
                
                <div className="flex gap-2 w-full">
                  <Button variant="outline" size="sm" className="flex-1 border-gray-300">
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Stats */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900">Team Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Briefcase className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Onsite</p>
                      <p className="text-sm text-gray-600">Team Members</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">80%</p>
                    <Badge className="bg-green-50 text-green-700 border-green-200">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +2.5%
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Home className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Remote</p>
                      <p className="text-sm text-gray-600">Team Members</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">20%</p>
                    <Badge className="bg-orange-50 text-orange-700 border-orange-200">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +1.8%
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Birthdays */}
          <BirthdayWidget />
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
