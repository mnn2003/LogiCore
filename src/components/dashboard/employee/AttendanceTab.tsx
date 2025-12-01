import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, getDocs, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, MapPin, CalendarDays, AlertCircle, CheckCircle, XCircle, TrendingUp, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface AttendanceTabProps {
  onAttendanceUpdate?: () => void;
}

const AttendanceTab = ({ onAttendanceUpdate }: AttendanceTabProps) => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showEditRequestDialog, setShowEditRequestDialog] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState('');
  const [editRequestPunchOut, setEditRequestPunchOut] = useState('');
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    averageHours: 0,
    thisWeek: 0
  });

  useEffect(() => {
    fetchAttendance();
    fetchHolidays();
    fetchEmployeeData();
  }, [user]);

  useEffect(() => {
    calculateStats();
  }, [attendanceRecords]);

  const fetchEmployeeData = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setEmployeeData({ id: snapshot.docs[0].id, ...data });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const calculateStats = () => {
    if (attendanceRecords.length === 0) {
      setStats({ present: 0, absent: 0, averageHours: 0, thisWeek: 0 });
      return;
    }

    let presentCount = 0;
    let totalHours = 0;
    let thisWeekHours = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    attendanceRecords.forEach(record => {
      if (record.punchIn) {
        presentCount++;
        
        if (record.punchOut) {
          const hours = (new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime()) / (1000 * 60 * 60);
          totalHours += hours;
          
          const recordDate = new Date(record.date);
          if (recordDate >= oneWeekAgo) {
            thisWeekHours += hours;
          }
        }
      }
    });

    const averageHours = presentCount > 0 ? totalHours / presentCount : 0;
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const businessDays = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), i + 1);
      return date.getDay() !== 0; // Exclude Sundays
    }).filter(Boolean).length;

    const absentCount = businessDays - presentCount;

    setStats({
      present: presentCount,
      absent: Math.max(0, absentCount),
      averageHours: parseFloat(averageHours.toFixed(1)),
      thisWeek: parseFloat(thisWeekHours.toFixed(1))
    });
  };

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'holidays'));
      const holidayList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHolidays(holidayList);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setAttendanceRecords(records);
      
      const today = new Date().toISOString().split('T')[0];
      const todayRec = records.find((r: any) => r.date === today);
      setTodayRecord(todayRec);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const getLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }),
        (error) => reject(error)
      );
    });
  };

  const handlePunchIn = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      if (todayRecord) {
        toast.error('You have already punched in today!');
        return;
      }

      const location = await getLocation();
      await addDoc(collection(db, 'attendance'), {
        employeeId: user!.uid,
        date: today,
        punchIn: new Date().toISOString(),
        punchInLocation: location,
        punchOut: null,
        punchOutLocation: null,
        employeeName: employeeData?.name || user!.email,
        employeeCode: employeeData?.employeeCode || ''
      });
      toast.success('Punched in successfully!');
      fetchAttendance();
      onAttendanceUpdate?.();
    } catch (error: any) {
      if (error.message === 'Geolocation not supported') {
        toast.error('Please enable location services to punch in');
      } else {
        toast.error('Failed to punch in');
      }
    }
  };

  const handlePunchOut = async () => {
    try {
      if (!todayRecord) {
        toast.error('No punch in record found for today!');
        return;
      }

      if (todayRecord.punchOut) {
        toast.error('You have already punched out today!');
        return;
      }

      const location = await getLocation();
      
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        punchOut: new Date().toISOString(),
        punchOutLocation: location
      });
      toast.success('Punched out successfully!');
      fetchAttendance();
      onAttendanceUpdate?.();
    } catch (error) {
      console.error('Punch out error:', error);
      toast.error('Failed to punch out. Please try again.');
    }
  };

  const handleDateClick = (dateStr: string) => {
    const holiday = holidays.find((h: any) => h.date === dateStr);
    const attendance = attendanceRecords.find((r: any) => r.date === dateStr);
    
    if (holiday) {
      setSelectedHoliday(holiday);
      setShowHolidayDialog(true);
    } else if (attendance) {
      setSelectedAttendance(attendance);
      setShowAttendanceDialog(true);
    }
  };

  const handleRequestEdit = (attendance: any) => {
    setSelectedAttendance(attendance);
    setEditRequestPunchOut('');
    setEditRequestReason('');
    setShowEditRequestDialog(true);
  };

  const submitEditRequest = async () => {
    if (!selectedAttendance || !editRequestPunchOut || !editRequestReason) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const hrQuery = query(collection(db, 'user_roles'), where('role', '==', 'hr'));
      const hodQuery = query(collection(db, 'user_roles'), where('role', '==', 'hod'));
      
      const [hrSnapshot, hodSnapshot] = await Promise.all([
        getDocs(hrQuery),
        getDocs(hodQuery)
      ]);

      const approverIds = [
        ...hrSnapshot.docs.map(doc => doc.data().userId),
        ...hodSnapshot.docs.map(doc => doc.data().userId)
      ];

      if (approverIds.length === 0) {
        toast.error('No HR or HOD found to approve request');
        return;
      }

      await addDoc(collection(db, 'attendance_edit_requests'), {
        attendanceId: selectedAttendance.id,
        employeeId: user!.uid,
        employeeName: employeeData?.name || user!.email,
        date: selectedAttendance.date,
        currentPunchIn: selectedAttendance.punchIn,
        currentPunchOut: selectedAttendance.punchOut,
        requestedPunchOut: editRequestPunchOut,
        reason: editRequestReason,
        status: 'pending',
        approverIds,
        createdAt: new Date().toISOString()
      });

      toast.success('Edit request submitted successfully!');
      setShowEditRequestDialog(false);
      setEditRequestPunchOut('');
      setEditRequestReason('');
    } catch (error) {
      console.error('Error submitting edit request:', error);
      toast.error('Failed to submit edit request');
    }
  };

  const getAttendanceStatus = (record: any) => {
    if (!record.punchIn) return { label: 'Absent', color: 'bg-red-100 text-red-800 border-red-200' };
    if (record.punchIn && !record.punchOut) return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'Present', color: 'bg-green-100 text-green-800 border-green-200' };
  };

  const getCurrentMonthDates = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      return {
        dateStr: date.toISOString().split('T')[0],
        date,
        day: date.getDate(),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' })
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Attendance Management</h1>
        <p className="text-gray-600">Track your daily attendance and view history</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Present Days</p>
                <p className="text-2xl font-bold text-gray-900">{stats.present}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Absent Days</p>
                <p className="text-2xl font-bold text-gray-900">{stats.absent}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Hours/Day</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageHours}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">{stats.thisWeek}h</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Attendance Card */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Today's Attendance</CardTitle>
              <CardDescription className="text-gray-600">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric' 
                })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Clock className="h-4 w-4" />
                    Punch In
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    {new Date(todayRecord.punchIn).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
                
                {todayRecord.punchOut ? (
                  <div className="space-y-2 p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 text-sm text-red-700">
                      <Clock className="h-4 w-4" />
                      Punch Out
                    </div>
                    <p className="text-2xl font-bold text-red-700">
                      {new Date(todayRecord.punchOut).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 text-sm text-yellow-700">
                      <Clock className="h-4 w-4" />
                      Status
                    </div>
                    <p className="text-2xl font-bold text-yellow-700">Working</p>
                  </div>
                )}
                
                {todayRecord.punchOut ? (
                  <div className="space-y-2 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <Clock className="h-4 w-4" />
                      Total Hours
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      {((new Date(todayRecord.punchOut).getTime() - new Date(todayRecord.punchIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} hrs
                    </p>
                  </div>
                ) : (
                  <Button 
                    onClick={handlePunchOut} 
                    className="h-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                  >
                    <MapPin className="mr-2 h-5 w-5" />
                    Punch Out
                  </Button>
                )}
              </div>
              
              {!todayRecord.punchOut && (
                <div className="text-center">
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Currently working - Please remember to punch out
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="mb-4">
                <Clock className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="font-semibold text-lg text-gray-900 mb-2">Ready to Start Your Day?</h3>
                <p className="text-gray-600 mb-6">Click the button below to record your punch in</p>
              </div>
              <Button 
                onClick={handlePunchIn} 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm px-8 py-3"
                size="lg"
              >
                <MapPin className="mr-2 h-5 w-5" />
                Punch In Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attendance */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CalendarDays className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Recent Attendance</CardTitle>
                <CardDescription className="text-gray-600">Your last 7 days attendance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-3">Loading attendance...</p>
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No attendance records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attendanceRecords.slice(0, 7).map((record) => {
                  const status = getAttendanceStatus(record);
                  return (
                    <div 
                      key={record.id} 
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleDateClick(record.date)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">
                            {format(new Date(record.date), 'EEEE, MMMM dd, yyyy')}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {record.punchIn && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(record.punchIn).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            )}
                            {record.punchOut && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(record.punchOut).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* This Month Calendar */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">{format(new Date(), 'MMMM yyyy')}</CardTitle>
                <CardDescription className="text-gray-600">Monthly attendance overview</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {getCurrentMonthDates().map(({ dateStr, date, day, dayName }) => {
                const isSunday = dayName === 'Sun';
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                const holiday = holidays.find(h => h.date === dateStr);
                const attendance = attendanceRecords.find(r => r.date === dateStr);
                const isFuture = date > new Date();

                let className = "h-10 rounded-lg flex flex-col items-center justify-center text-sm font-medium ";
                
                if (isToday) {
                  className += "bg-blue-100 text-blue-700 border-2 border-blue-300 ";
                } else if (holiday) {
                  className += "bg-purple-100 text-purple-700 border border-purple-200 ";
                } else if (attendance) {
                  className += "bg-green-100 text-green-700 border border-green-200 ";
                } else if (isSunday) {
                  className += "bg-gray-100 text-gray-500 border border-gray-200 ";
                } else if (isFuture) {
                  className += "bg-gray-50 text-gray-400 border border-gray-200 ";
                } else {
                  className += "bg-red-50 text-red-700 border border-red-100 ";
                }

                return (
                  <div 
                    key={dateStr} 
                    className={className}
                    onClick={() => !isFuture && handleDateClick(dateStr)}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            
            <div className="flex flex-wrap gap-4 mt-6 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span className="text-xs">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-400"></div>
                <span className="text-xs">Absent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500"></div>
                <span className="text-xs">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-400"></div>
                <span className="text-xs">Today</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CalendarDays className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Holiday Details</DialogTitle>
                <DialogDescription className="text-gray-600">Public holiday information</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Holiday Name</p>
                <p className="text-lg font-semibold text-gray-900">{selectedHoliday.name}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Date</p>
                <p className="text-lg text-gray-900">
                  {format(new Date(selectedHoliday.date), 'EEEE, MMMM dd, yyyy')}
                </p>
              </div>
              {selectedHoliday.description && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Description</p>
                  <p className="text-gray-700">{selectedHoliday.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Attendance Details</DialogTitle>
                <DialogDescription className="text-gray-600">Complete attendance information</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedAttendance && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {format(new Date(selectedAttendance.date), 'EEEE, MMMM dd, yyyy')}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">Punch In</p>
                  <p className="text-xl font-bold text-green-700">
                    {new Date(selectedAttendance.punchIn).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
                
                {selectedAttendance.punchOut ? (
                  <div className="space-y-1 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-700">Punch Out</p>
                    <p className="text-xl font-bold text-red-700">
                      {new Date(selectedAttendance.punchOut).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-700">Status</p>
                    <p className="text-xl font-bold text-yellow-700">No Punch Out</p>
                  </div>
                )}
              </div>
              
              {selectedAttendance.punchOut ? (
                <div className="space-y-1 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">Total Hours Worked</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {((new Date(selectedAttendance.punchOut).getTime() - new Date(selectedAttendance.punchIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} hours
                  </p>
                </div>
              ) : (
                <Button 
                  onClick={() => handleRequestEdit(selectedAttendance)} 
                  variant="outline" 
                  className="w-full border-yellow-300 hover:border-yellow-400 hover:bg-yellow-50"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Request Attendance Edit
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditRequestDialog} onOpenChange={setShowEditRequestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Request Attendance Edit</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Request HR/HOD to update your punch out time
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Date</Label>
              <p className="font-medium text-gray-900">
                {selectedAttendance?.date && format(new Date(selectedAttendance.date), 'MMMM dd, yyyy')}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Current Punch In</Label>
              <p className="font-medium text-gray-900">
                {selectedAttendance?.punchIn && new Date(selectedAttendance.punchIn).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Requested Punch Out Time</Label>
              <Input
                type="time"
                value={editRequestPunchOut}
                onChange={(e) => setEditRequestPunchOut(e.target.value)}
                className="bg-gray-50 border-gray-200"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Reason for Edit Request</Label>
              <Textarea
                value={editRequestReason}
                onChange={(e) => setEditRequestReason(e.target.value)}
                placeholder="Please explain why you need this attendance correction..."
                rows={4}
                className="bg-gray-50 border-gray-200"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditRequestDialog(false)}
              className="border-gray-300 hover:border-gray-400"
            >
              Cancel
            </Button>
            <Button 
              onClick={submitEditRequest}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceTab;
