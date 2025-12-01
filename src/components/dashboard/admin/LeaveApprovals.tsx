import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { Check, X, User, Edit } from 'lucide-react';
import { LeaveRequest, LeaveType, LeaveBalance } from '@/types/leave';

const LEAVE_TYPE_NAMES: Record<LeaveType, string> = {
  PL: 'Privilege Leave',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
  ADOPTION: 'Adoption Leave',
  SABBATICAL: 'Sabbatical',
  WFH: 'Work From Home',
  BEREAVEMENT: 'Bereavement Leave',
  PARENTAL: 'Parental Leave',
  COMP_OFF: 'Compensatory Off',
  LWP: 'Leave Without Pay',
  VACATION: 'Vacation',
};

const LeaveApprovals = () => {
  const { userRole, organizationId } = useAuth();
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchPendingLeaves();
    fetchAllLeaves();
  }, [userRole]);

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Build query with organizationId filter if not super-admin
      const constraints = [where('status', '==', 'PENDING')];
      if (organizationId) {
        constraints.push(where('organizationId', '==', organizationId));
      }
      const q = query(collection(db, 'leaves'), ...constraints);
      const snapshot = await getDocs(q);
      
      const leavesWithEmployees = await Promise.all(
        snapshot.docs.map(async (leaveDoc) => {
          const leaveData = leaveDoc.data() as any;
          let employeeName = leaveData.employeeName || 'Unknown';
          let employeeCode = leaveData.employeeCode || '';
          
          // Fallback: try to fetch employee details if not present
          if (employeeName === 'Unknown') {
            try {
              const employeeDoc = await getDoc(doc(db, 'employees', leaveData.employeeId));
              if (employeeDoc.exists()) {
                const empData = employeeDoc.data() as any;
                employeeName = empData.name || 'Unknown';
                employeeCode = empData.employeeCode || '';
              }
            } catch (error) {
              console.error('Error fetching employee:', error);
            }
          }
          
          return {
            id: leaveDoc.id,
            ...leaveData,
            employeeName,
            employeeCode,
          } as LeaveRequest;
        })
      );
      
      setPendingLeaves(leavesWithEmployees);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLeaves = async () => {
    try {
      // Build query with organizationId filter if not super-admin
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'leaves'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      
      const leavesWithEmployees = await Promise.all(
        snapshot.docs.map(async (leaveDoc) => {
          const leaveData = leaveDoc.data() as any;
          let employeeName = leaveData.employeeName || 'Unknown';
          let employeeCode = leaveData.employeeCode || '';
          
          if (employeeName === 'Unknown') {
            try {
              const employeeDoc = await getDoc(doc(db, 'employees', leaveData.employeeId));
              if (employeeDoc.exists()) {
                const empData = employeeDoc.data() as any;
                employeeName = empData.name || 'Unknown';
                employeeCode = empData.employeeCode || '';
              }
            } catch (error) {
              console.error('Error fetching employee:', error);
            }
          }
          
          return {
            id: leaveDoc.id,
            ...leaveData,
            employeeName,
            employeeCode,
          } as LeaveRequest;
        })
      );
      
      setAllLeaves(leavesWithEmployees);
    } catch (error) {
      console.error('Error fetching all leaves:', error);
    }
  };

  const handleApprove = async (leaveId: string, leave: LeaveRequest) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Deduct from leave balance
      const balanceDoc = await getDoc(doc(db, 'leave_balances', leave.employeeId));
      if (balanceDoc.exists() && leave.leaveType !== 'LWP' && leave.leaveType !== 'VACATION') {
        const balance = balanceDoc.data() as LeaveBalance;
        const updatedBalance = {
          ...balance,
          [leave.leaveType]: Math.max(0, balance[leave.leaveType as keyof Omit<LeaveBalance, 'employeeId' | 'lastUpdated'>] - leave.duration),
          lastUpdated: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'leave_balances', leave.employeeId), updatedBalance);
      }

      await updateDoc(doc(db, 'leaves', leaveId), { 
        status: 'APPROVED',
        approvedBy: currentUser.uid,
        approvedAt: new Date().toISOString()
      });
      toast.success('Leave approved and balance updated!');
      fetchPendingLeaves();
      fetchAllLeaves();
    } catch (error) {
      toast.error('Failed to approve leave');
    }
  };

  const handleReject = async (leaveId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      await updateDoc(doc(db, 'leaves', leaveId), { 
        status: 'REJECTED',
        rejectedBy: currentUser.uid,
        rejectedAt: new Date().toISOString()
      });
      toast.success('Leave rejected!');
      fetchPendingLeaves();
      fetchAllLeaves();
    } catch (error) {
      toast.error('Failed to reject leave');
    }
  };

  const handleEditLeave = (leave: LeaveRequest) => {
    setEditingLeave(leave);
    setIsEditDialogOpen(true);
  };

  const handleUpdateLeave = async () => {
    if (!editingLeave || !editingLeave.id) return;

    try {
      await updateDoc(doc(db, 'leaves', editingLeave.id), {
        leaveType: editingLeave.leaveType,
        startDate: editingLeave.startDate,
        endDate: editingLeave.endDate,
        duration: editingLeave.duration,
        reason: editingLeave.reason,
        notes: editingLeave.notes,
      });

      toast.success('Leave updated successfully');
      setIsEditDialogOpen(false);
      fetchPendingLeaves();
      fetchAllLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
      toast.error('Failed to update leave');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'pending'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending Approvals ({pendingLeaves.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'all'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Leave History ({allLeaves.length})
        </button>
      </div>

      {activeTab === 'pending' ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending Leave Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map(leave => (
              <div key={leave.id} className="p-4 border rounded-lg space-y-3 hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold">{leave.employeeName}</p>
                      {leave.employeeCode && (
                        <Badge variant="outline" className="text-xs">{leave.employeeCode}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{LEAVE_TYPE_NAMES[leave.leaveType]}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {leave.startDate} to {leave.endDate} ({leave.duration} days)
                      </span>
                    </div>
                    <p className="text-sm bg-muted p-2 rounded">{leave.reason}</p>
                  </div>
                  <Badge variant="secondary" className="ml-4">Pending</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEditLeave(leave)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => handleApprove(leave.id!, leave)} className="flex-1">
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(leave.id!)} className="flex-1">
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
                {pendingLeaves.length === 0 && (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <Check className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No pending leave requests</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allLeaves.map(leave => (
                <div key={leave.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold">{leave.employeeName}</p>
                        {leave.employeeCode && (
                          <Badge variant="outline" className="text-xs">{leave.employeeCode}</Badge>
                        )}
                      </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{LEAVE_TYPE_NAMES[leave.leaveType]}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {leave.startDate} to {leave.endDate} ({leave.duration} days)
                      </span>
                    </div>
                      <p className="text-sm bg-muted p-2 rounded">{leave.reason}</p>
                    </div>
                  <div className="flex gap-2 ml-4">
                    <Badge 
                      variant={
                        leave.status === 'APPROVED' ? 'default' :
                        leave.status === 'REJECTED' ? 'destructive' : 'secondary'
                      }
                    >
                      {leave.status}
                    </Badge>
                    {leave.status === 'PENDING' && (
                      <Button size="sm" variant="outline" onClick={() => handleEditLeave(leave)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  </div>
                </div>
              ))}
              {allLeaves.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No leave records found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
          </DialogHeader>
          {editingLeave && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Input value={editingLeave.employeeName} disabled />
              </div>
              
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Input value={LEAVE_TYPE_NAMES[editingLeave.leaveType]} disabled />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={editingLeave.startDate}
                    onChange={(e) => setEditingLeave({ ...editingLeave, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={editingLeave.endDate}
                    onChange={(e) => setEditingLeave({ ...editingLeave, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duration (Days)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editingLeave.duration}
                  onChange={(e) => setEditingLeave({ ...editingLeave, duration: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={editingLeave.reason}
                  onChange={(e) => setEditingLeave({ ...editingLeave, reason: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (HR)</Label>
                <Textarea
                  value={editingLeave.notes || ''}
                  onChange={(e) => setEditingLeave({ ...editingLeave, notes: e.target.value })}
                  placeholder="Add internal notes..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateLeave}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveApprovals;
