import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, MapPin, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
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

  useEffect(() => {
    fetchAttendance();
    fetchHolidays();
  }, [user]);

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
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const record = attendanceRecords.find((r: any) => r.date === dateStr);
    const holiday = holidays.find((h: any) => h.date === dateStr);
    const isSunday = date.getDay() === 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    const isFuture = compareDate > today;
    
    if (isFuture) return 'text-gray-400';
    if (holiday) return 'bg-purple-100 text-purple-700 border border-purple-300';
    if (record) return 'bg-green-100 text-green-700 border border-green-300';
    if (isSunday) return 'bg-gray-100 text-gray-600';
    
    const isWeekday = date.getDay() >= 1 && date.getDay() <= 5;
    const isPastWeekday = compareDate < today && isWeekday;
    
    if (isPastWeekday) return 'bg-red-100 text-red-600 border border-red-200';
    
    return '';
  };

  const handleDateClick = (date: Date) => {
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
        date: selectedAttendance.date,
        currentPunchOut: selectedAttendance.punchOut,
        requestedPunchOut: editRequestPunchOut,
        reason: editRequestReason,
        status: 'pending',
        approverIds,
        createdAt: new Date().toISOString()
      });

      toast.success('Edit request submitted');
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
      {/* Today's Attendance */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Clock className="h-5 w-5 text-blue-600" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Punch In</p>
                  <p className="text-2xl font-bold text-green-600">
                    {new Date(todayRecord.punchIn).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {todayRecord.punchOut && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-gray-600 mb-1">Punch Out</p>
                    <p className="text-2xl font-bold text-red-600">
                      {new Date(todayRecord.punchOut).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
              {!todayRecord.punchOut && (
                <Button 
                  onClick={handlePunchOut} 
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  Punch Out
                </Button>
              )}
              {todayRecord.punchOut && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-center">
                  <p className="text-sm text-gray-600">Total Hours</p>
                  <p className="text-xl font-bold text-blue-600">
                    {((new Date(todayRecord.punchOut).getTime() - new Date(todayRecord.punchIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} hrs
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Button onClick={handlePunchIn} className="bg-blue-600 hover:bg-blue-700">
                <MapPin className="mr-2 h-5 w-5" />
                Punch In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Records */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceRecords.length === 0 ? (
            <p className="text-center text-gray-600 py-4">No attendance records found</p>
          ) : (
            <div className="space-y-3">
              {attendanceRecords.slice(0, 5).map((record) => (
                <div 
                  key={record.id} 
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleDateClick(new Date(record.date))}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(record.date), 'MMMM dd, yyyy')}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
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
                    <Badge className={
                      record.punchIn && record.punchOut ? 'bg-green-100 text-green-800 border-green-200' :
                      record.punchIn && !record.punchOut ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-red-100 text-red-800 border-red-200'
                    }>
                      {record.punchIn && record.punchOut ? 'Present' : 
                       record.punchIn && !record.punchOut ? 'Pending' : 'Absent'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Holiday List */}
      {holidays.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {holidays
                .map(dateStr => {
                  const [year, month, day] = dateStr.split('-').map(Number);
                  return { dateStr, date: new Date(year, month - 1, day) };
                })
                .filter(({ date }) => date >= new Date(new Date().setHours(0, 0, 0, 0)))
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 3)
                .map(({ dateStr, date }) => (
                  <div key={dateStr} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">
                      {format(date, 'MMMM dd, yyyy')}
                    </span>
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">Holiday</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Holiday Details</DialogTitle>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {format(new Date(selectedHoliday.date), 'MMMM dd, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Holiday Name</p>
                <p className="text-lg font-semibold text-gray-900">{selectedHoliday.name}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attendance Details</DialogTitle>
          </DialogHeader>
          {selectedAttendance && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {format(new Date(selectedAttendance.date), 'MMMM dd, yyyy')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Punch In</p>
                  <p className="text-lg font-semibold text-green-600">
                    {new Date(selectedAttendance.punchIn).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {selectedAttendance.punchOut && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-gray-600 mb-1">Punch Out</p>
                    <p className="text-lg font-semibold text-red-600">
                      {new Date(selectedAttendance.punchOut).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
              {!selectedAttendance.punchOut && (
                <Button 
                  onClick={() => handleRequestEdit(selectedAttendance)} 
                  variant="outline" 
                  className="w-full"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Request Edit
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditRequestDialog} onOpenChange={setShowEditRequestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Attendance Edit</DialogTitle>
            <DialogDescription>
              Request HR/HOD to update your punch out time
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Requested Punch Out Time</p>
              <Input
                type="time"
                value={editRequestPunchOut}
                onChange={(e) => setEditRequestPunchOut(e.target.value)}
                required
                className="border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Reason for Edit</p>
              <Textarea
                value={editRequestReason}
                onChange={(e) => setEditRequestReason(e.target.value)}
                placeholder="Explain why you need this correction..."
                rows={4}
                required
                className="border-gray-300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitEditRequest} className="bg-blue-600 hover:bg-blue-700">
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceTab;
