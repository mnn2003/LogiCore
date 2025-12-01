import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, getDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, MapPin, User, Edit, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AttendanceWithEmployee {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  date: string;
  punchIn: any;
  punchOut?: any;
  punchInLocation?: any;
  punchOutLocation?: any;
  totalHours?: number;
}

const AttendanceManagement = () => {
  const { user, organizationId } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceWithEmployee[]>([]);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceWithEmployee | null>(null);
  const [editPunchOut, setEditPunchOut] = useState('');

  useEffect(() => {
    fetchAttendance();
    fetchEditRequests();
  }, [user]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      // Build query with organizationId filter if not super-admin
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'attendance'),
          where('organizationId', '==', organizationId),
          orderBy('date', 'desc'),
          limit(50)
        );
      } else {
        q = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(50));
      }
      const snapshot = await getDocs(q);
      
      const recordsWithEmployees = await Promise.all(
        snapshot.docs.map(async (attendanceDoc) => {
          const attendanceData = attendanceDoc.data() as any;
          let employeeName = 'Unknown';
          let employeeCode = '';
          
          try {
            const employeeDoc = await getDoc(doc(db, 'employees', attendanceData.employeeId));
            if (employeeDoc.exists()) {
              const empData = employeeDoc.data() as any;
              employeeName = empData.name || 'Unknown';
              employeeCode = empData.employeeCode || '';
            }
          } catch (error) {
            console.error('Error fetching employee:', error);
          }
          
          return {
            id: attendanceDoc.id,
            ...attendanceData,
            employeeName,
            employeeCode,
          } as AttendanceWithEmployee;
        })
      );
      
      setAttendanceRecords(recordsWithEmployees);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid';
    }
  };

  const calculateHours = (punchIn: any, punchOut: any) => {
    if (!punchIn || !punchOut) return null;
    try {
      const diff = new Date(punchOut).getTime() - new Date(punchIn).getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return null;
    }
  };

  const fetchEditRequests = async () => {
    if (!user) return;
    try {
      // Build query with organizationId filter if not super-admin
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'attendance_edit_requests'),
          where('organizationId', '==', organizationId),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'attendance_edit_requests'),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      setEditRequests(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    } catch (error) {
      console.error('Error fetching edit requests:', error);
    }
  };

  const handleEditAttendance = (record: AttendanceWithEmployee) => {
    setSelectedRecord(record);
    setEditPunchOut('');
    setShowEditDialog(true);
  };

  const submitEdit = async () => {
    if (!selectedRecord || !editPunchOut) {
      toast.error('Please provide punch out time');
      return;
    }

    try {
      const punchOutDate = new Date(selectedRecord.date + 'T' + editPunchOut);
      await updateDoc(doc(db, 'attendance', selectedRecord.id), {
        punchOut: punchOutDate.toISOString(),
        punchOutLocation: selectedRecord.punchInLocation || null,
        editedBy: user!.uid,
        editedAt: new Date().toISOString()
      });

      toast.success('Attendance updated successfully');
      setShowEditDialog(false);
      fetchAttendance();
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    }
  };

  const handleEditRequestAction = async (requestId: string, action: 'approved' | 'rejected', attendanceId: string, requestedPunchOut: string, date: string) => {
    try {
      if (action === 'approved') {
        const punchOutDate = new Date(date + 'T' + requestedPunchOut);
        await updateDoc(doc(db, 'attendance', attendanceId), {
          punchOut: punchOutDate.toISOString(),
          punchOutLocation: null,
          editedBy: user!.uid,
          editedAt: new Date().toISOString()
        });
      }

      await updateDoc(doc(db, 'attendance_edit_requests', requestId), {
        status: action,
        approvedBy: user!.uid,
        approvedAt: new Date().toISOString()
      });

      toast.success(`Request ${action} successfully`);
      fetchEditRequests();
      fetchAttendance();
    } catch (error) {
      console.error('Error handling edit request:', error);
      toast.error('Failed to process request');
    }
  };

  return (
    <div className="space-y-6">
      {editRequests.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Attendance Edit Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {editRequests.map(request => (
                <div key={request.id} className="p-4 border rounded-lg bg-yellow-50/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{request.employeeName}</p>
                      <p className="text-sm text-muted-foreground">Date: {request.date}</p>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current Punch In:</p>
                      <p className="font-medium">
                        {new Date(request.currentPunchIn).toLocaleTimeString('en-US', { 
                          hour: '2-digit', minute: '2-digit', hour12: true 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Requested Punch Out:</p>
                      <p className="font-medium text-blue-600">{request.requestedPunchOut}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reason:</p>
                    <p className="text-sm">{request.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleEditRequestAction(request.id, 'approved', request.attendanceId, request.requestedPunchOut, request.date)}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleEditRequestAction(request.id, 'rejected', request.attendanceId, request.requestedPunchOut, request.date)}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
      <CardHeader>
        <CardTitle>Attendance Records</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            {attendanceRecords.map(record => (
              <div key={record.id} className="p-4 border rounded-lg space-y-3 hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold">{record.employeeName}</p>
                      {record.employeeCode && (
                        <Badge variant="outline" className="text-xs">{record.employeeCode}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {record.date}
                    </p>
                  </div>
                  <Badge variant={record.punchOut ? 'default' : 'secondary'}>
                    {record.punchOut ? 'Complete' : 'In Progress'}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded">
                    <p className="text-xs text-muted-foreground mb-1">Punch In</p>
                    <p className="font-medium">{formatTime(record.punchIn)}</p>
                    {record.punchInLocation && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {typeof record.punchInLocation === 'object' && record.punchInLocation.lat && record.punchInLocation.lng
                          ? `${record.punchInLocation.lat.toFixed(4)}, ${record.punchInLocation.lng.toFixed(4)}`
                          : record.punchInLocation}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-muted rounded">
                    <p className="text-xs text-muted-foreground mb-1">Punch Out</p>
                    <p className="font-medium">{formatTime(record.punchOut)}</p>
                    {record.punchOutLocation && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {typeof record.punchOutLocation === 'object' && record.punchOutLocation.lat && record.punchOutLocation.lng
                          ? `${record.punchOutLocation.lat.toFixed(4)}, ${record.punchOutLocation.lng.toFixed(4)}`
                          : record.punchOutLocation}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {record.punchOut && calculateHours(record.punchIn, record.punchOut) && (
                    <Badge variant="outline">
                      Total: {calculateHours(record.punchIn, record.punchOut)}
                    </Badge>
                  )}
                  {!record.punchOut && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditAttendance(record)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Add Punch Out
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {attendanceRecords.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No attendance records found</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
          <DialogDescription>
            Add punch out time for {selectedRecord?.employeeName} on {selectedRecord?.date}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Punch In</p>
            <p className="font-medium">
              {selectedRecord?.punchIn && new Date(selectedRecord.punchIn).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Punch Out Time</label>
            <Input
              type="time"
              value={editPunchOut}
              onChange={(e) => setEditPunchOut(e.target.value)}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowEditDialog(false)}>
            Cancel
          </Button>
          <Button onClick={submitEdit}>
            Update Attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
};

export default AttendanceManagement;
