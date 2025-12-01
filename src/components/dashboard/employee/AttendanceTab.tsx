import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, getDocs, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Calendar from 'react-calendar';
import { Clock, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import 'react-calendar/dist/Calendar.css';

interface AttendanceTabProps {
  onAttendanceUpdate?: () => void;
}

const AttendanceTab = ({ onAttendanceUpdate }: AttendanceTabProps) => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showEditRequestDialog, setShowEditRequestDialog] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState('');
  const [editRequestPunchOut, setEditRequestPunchOut] = useState('');
  const [employeeData, setEmployeeData] = useState<any>(null);

  useEffect(() => {
    fetchAttendance();
    fetchHolidays();
    fetchEmployeeData();
  }, [user]);

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

  const fetchHolidays = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'holidays'));
      const holidayList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHolidays(holidayList);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchAttendance = async () => {
  if (!user) return;
  try {
    // Method 1: Try with ordering (requires index)
    try {
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      console.log('Records with order:', records);
      setAttendanceRecords(records);

      const today = new Date().toISOString().split('T')[0];
      const todayRec = records.find((r: any) => r.date === today);
      setTodayRecord(todayRec);
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        console.log('Firestore index missing, fetching without order...');
        // Method 2: Fetch without orderBy and sort manually
        const q = query(
          collection(db, 'attendance'),
          where('employeeId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        console.log('Records without order:', records);
        setAttendanceRecords(records);

        const today = new Date().toISOString().split('T')[0];
        const todayRec = records.find((r: any) => r.date === today);
        setTodayRecord(todayRec);
        
        // Show user-friendly message
        toast.error('Please create Firestore index for better performance');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error fetching attendance:', error);
    toast.error('Failed to load attendance records');
  }
};

  const getLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
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
      // Check if already punched in today
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
        punchOutLocation: null
      });
      toast.success('Punched in successfully!');
      fetchAttendance();
      onAttendanceUpdate?.();
    } catch (error) {
      toast.error('Failed to punch in');
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

  const tileClassName = ({ date, view }: any) => {
    if (view !== 'month') return '';
    
    // Create date string in YYYY-MM-DD format avoiding timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const record = attendanceRecords.find((r: any) => r.date === dateStr);
    const holiday = holidays.find((h: any) => h.date === dateStr);
    const isSunday = date.getDay() === 0;
    
    // Get today at midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    const isFuture = compareDate > today;
    
    // Don't style future dates
    if (isFuture) return 'text-muted-foreground/50';
    
    // Priority order: Holiday > Present > Absent > Sunday
    if (holiday) return 'bg-purple-500/20 text-purple-700 font-bold hover:bg-purple-500/30';
    if (record) return 'bg-green-500/20 text-green-700 font-semibold hover:bg-green-500/30';
    if (isSunday) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    
    // Mark as absent only if it's a weekday (Mon-Fri) in the past
    const isWeekday = date.getDay() >= 1 && date.getDay() <= 5; // Monday to Friday
    const isPastWeekday = compareDate < today && isWeekday;
    
    if (isPastWeekday) {
      return 'bg-red-100 text-red-600 font-semibold hover:bg-red-200';
    }
    
    return '';
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    
    // Create date string avoiding timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
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
      // Get HR and HOD user IDs
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

      toast.success('Edit request submitted to HR/HOD');
      setShowEditRequestDialog(false);
      setEditRequestPunchOut('');
      setEditRequestReason('');
    } catch (error) {
      console.error('Error submitting edit request:', error);
      toast.error('Failed to submit edit request');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-6 w-6 text-primary" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {todayRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Punch In</p>
                  <p className="text-2xl font-bold text-green-600">
                    {new Date(todayRecord.punchIn).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </p>
                </div>
                {todayRecord.punchOut && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-muted-foreground mb-1">Punch Out</p>
                    <p className="text-2xl font-bold text-red-600">
                      {new Date(todayRecord.punchOut).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </p>
                  </div>
                )}
              </div>
              {!todayRecord.punchOut && (
                <Button 
                  onClick={handlePunchOut} 
                  variant="destructive" 
                  size="lg"
                  className="w-full"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  Punch Out
                </Button>
              )}
              {todayRecord.punchOut && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-xl font-bold text-primary">
                    {((new Date(todayRecord.punchOut).getTime() - new Date(todayRecord.punchIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} hrs
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mb-4">
                <Clock className="h-16 w-16 mx-auto text-muted-foreground/30" />
              </div>
              <Button onClick={handlePunchIn} size="lg" className="w-full md:w-auto">
                <MapPin className="mr-2 h-5 w-5" />
                Punch In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Attendance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm">✅ Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-200"></div>
                <span className="text-sm">❌ Absent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-500"></div>
                <span className="text-sm">🎉 Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-200"></div>
                <span className="text-sm">🌟 Sunday</span>
              </div>
            </div>
            <Calendar
              onChange={(value: any) => setSelectedDate(value)}
              onClickDay={handleDateClick}
              value={selectedDate}
              tileClassName={tileClassName}
              className="w-full"
            />
            {attendanceRecords.length === 0 && (
              <p className="text-center text-muted-foreground text-sm mt-4">
                No attendance records found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Holiday Details</DialogTitle>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="text-lg font-semibold">{(() => {
                  const [year, month, day] = selectedHoliday.date.split('-').map(Number);
                  return format(new Date(year, month - 1, day), 'MMMM dd, yyyy');
                })()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Holiday Name</p>
                <p className="text-lg font-semibold">{selectedHoliday.name}</p>
              </div>
              {selectedHoliday.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-base">{selectedHoliday.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attendance Details</DialogTitle>
          </DialogHeader>
          {selectedAttendance && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="text-lg font-semibold">{format(new Date(selectedAttendance.date), 'MMMM dd, yyyy')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Punch In</p>
                  <p className="text-lg font-semibold text-green-600">
                    {new Date(selectedAttendance.punchIn).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </p>
                </div>
                {selectedAttendance.punchOut && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-muted-foreground mb-1">Punch Out</p>
                    <p className="text-lg font-semibold text-red-600">
                      {new Date(selectedAttendance.punchOut).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </p>
                  </div>
                )}
              </div>
              {selectedAttendance.punchOut && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-sm text-muted-foreground">Total Hours Worked</p>
                  <p className="text-2xl font-bold text-primary">
                    {((new Date(selectedAttendance.punchOut).getTime() - new Date(selectedAttendance.punchIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} hours
                  </p>
                </div>
              )}
              {!selectedAttendance.punchOut && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <p className="text-sm text-yellow-700">No punch out recorded for this day</p>
                  </div>
                  <Button 
                    onClick={() => handleRequestEdit(selectedAttendance)} 
                    variant="outline" 
                    className="w-full"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Request Attendance Edit
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditRequestDialog} onOpenChange={setShowEditRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Attendance Edit</DialogTitle>
            <DialogDescription>
              Request HR/HOD to update your punch out time for {selectedAttendance?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Punch In</p>
              <p className="font-medium">
                {selectedAttendance?.punchIn && new Date(selectedAttendance.punchIn).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Requested Punch Out Time</label>
              <Input
                type="time"
                value={editRequestPunchOut}
                onChange={(e) => setEditRequestPunchOut(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Edit Request</label>
              <Textarea
                value={editRequestReason}
                onChange={(e) => setEditRequestReason(e.target.value)}
                placeholder="Please explain why you need this attendance correction..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitEditRequest}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceTab;
