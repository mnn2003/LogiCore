import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { CalendarIcon, Plus, Info, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LeaveType, LeaveRequest, LeaveBalance } from '@/types/leave';

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

const LeaveTab = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('PL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [employeeGender, setEmployeeGender] = useState<'Male' | 'Female' | null>(null);
  const [holidays, setHolidays] = useState<string[]>([]);

  useEffect(() => {
    fetchLeaves();
    fetchLeaveBalance();
    fetchEmployeeGender();
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const holidaysSnapshot = await getDocs(collection(db, 'holidays'));
      const holidayDates = holidaysSnapshot.docs.map(doc => {
        const data = doc.data();
        return data.date; // Date in YYYY-MM-DD format
      });
      setHolidays(holidayDates);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchEmployeeGender = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const empQuery = query(collection(db, 'employees'), where('userId', '==', currentUser.uid));
      const empSnapshot = await getDocs(empQuery);
      if (!empSnapshot.empty) {
        const empData = empSnapshot.docs[0].data();
        setEmployeeGender(empData.gender || null);
      }
    } catch (error) {
      console.error('Error fetching employee gender:', error);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const q = query(
        collection(db, 'leaves'),
        where('employeeId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      const leavesData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
      setLeaves(leavesData);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const balanceDoc = await getDoc(doc(db, 'leave_balances', currentUser.uid));
      if (balanceDoc.exists()) {
        setLeaveBalance(balanceDoc.data() as LeaveBalance);
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  const calculateDuration = (s?: string, e?: string) => {
    const a = s ?? startDate;
    const b = e ?? endDate;
    if (!a || !b) return 0;
    const start = new Date(a + 'T00:00:00');
    const end = new Date(b + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    // Count working days (excluding Sundays and holidays)
    let workingDays = 0;
    const current = new Date(start);
    
    while (current <= end) {
      // Create date string without timezone conversion
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const isSunday = current.getDay() === 0;
      const isHoliday = holidays.includes(dateStr);
      
      // Count only if it's not Sunday and not a holiday
      if (!isSunday && !isHoliday) {
        workingDays++;
      }
      
      // Move to next day
      current.setDate(current.getDate() + 1);
    }
    
    setDuration(workingDays);
    return workingDays;
  };

  const isDateExcluded = (date: Date) => {
    // Create date string without timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const isSunday = date.getDay() === 0;
    const isHoliday = holidays.includes(dateStr);
    return isSunday || isHoliday;
  };

  const getExcludedDatesCount = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    let excludedCount = 0;
    const current = new Date(start);
    
    while (current <= end) {
      if (isDateExcluded(current)) {
        excludedCount++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return excludedCount;
  };

  const getTotalDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
  };

  useEffect(() => {
    calculateDuration();
  }, [startDate, endDate, holidays]);

  const validateForm = () => {
    if (!leaveType) {
      toast.error('Select a leave type');
      return false;
    }
    if (!startDate || !endDate) {
      toast.error('Select start and end dates');
      return false;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date cannot be before start date');
      return false;
    }
    if (!reason.trim()) {
      toast.error('Provide a reason');
      return false;
    }
    // balance check for paid leaves
    if (leaveBalance && leaveType !== 'LWP' && leaveType !== 'VACATION') {
      const available = leaveBalance[leaveType as keyof Omit<LeaveBalance, 'employeeId' | 'lastUpdated'>] || 0;
      if (available < duration) {
        toast.error(`Insufficient balance for ${LEAVE_TYPE_NAMES[leaveType]}. Available: ${available}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // get employee profile
      const empQuery = query(collection(db, 'employees'), where('userId', '==', currentUser.uid));
      const empSnapshot = await getDocs(empQuery);
      const empDoc = empSnapshot.docs[0];
      const employeeData = empDoc ? empDoc.data() : null;
      const employeeName = employeeData?.name || currentUser.email || 'Unknown';
      const employeeCode = employeeData?.employeeCode || '';

      // find approvers (HR + HOD)
      const hrQuery = query(collection(db, 'user_roles'), where('role', '==', 'hr'));
      const hodQuery = query(collection(db, 'user_roles'), where('role', '==', 'hod'));
      const [hrSnap, hodSnap] = await Promise.all([getDocs(hrQuery), getDocs(hodQuery)]);
      const approverIds = [
        ...hrSnap.docs.map((d) => (d.data() as any).userId),
        ...hodSnap.docs.map((d) => (d.data() as any).userId),
      ].filter(Boolean);

      if (approverIds.length === 0) {
        toast.error('No approvers found (HR/HOD)');
        setSubmitting(false);
        return;
      }

      const leaveRequest: Omit<LeaveRequest, 'id'> = {
        employeeId: currentUser.uid,
        employeeName,
        employeeCode,
        leaveType,
        startDate,
        endDate,
        duration,
        reason: reason.trim(),
        status: 'PENDING',
        appliedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        approverIds,
        isPaid: leaveType !== 'LWP',
      };

      await addDoc(collection(db, 'leaves'), leaveRequest);
      toast.success('Leave application submitted');

      // reset form
      setShowForm(false);
      setLeaveType('PL');
      setStartDate('');
      setEndDate('');
      setDuration(1);
      setReason('');

      // refresh data
      await fetchLeaves();
      await fetchLeaveBalance();
    } catch (error) {
      console.error('Error submitting leave:', error);
      toast.error('Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    
    try {
      await deleteDoc(doc(db, 'leaves', leaveId));
      toast.success('Leave request cancelled successfully');
      await fetchLeaves();
      await fetchLeaveBalance();
    } catch (error) {
      console.error('Error cancelling leave:', error);
      toast.error('Failed to cancel leave request');
    }
  };

  const formattedLeaves = useMemo(() => leaves, [leaves]);

  // Filter leave types based on gender
  const availableLeaveTypes = useMemo(() => {
    const genderSpecificTypes: Record<string, ('Male' | 'Female')[]> = {
      'MATERNITY': ['Female'],
      'PATERNITY': ['Male']
    };

    return Object.entries(LEAVE_TYPE_NAMES).filter(([key]) => {
      const allowedGenders = genderSpecificTypes[key];
      if (!allowedGenders) return true; // Available for all
      return employeeGender && allowedGenders.includes(employeeGender);
    });
  }, [employeeGender]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4">
      {/* Balance overview */}
      {leaveBalance && (
        <Card>
          <CardHeader>
            <CardTitle>Leave Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {(['PL', 'CL', 'SL', 'WFH', 'COMP_OFF'] as (keyof LeaveBalance)[]).map((k) => (
                <div key={k} className="p-3 bg-muted rounded-lg flex flex-col items-start">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="text-xl font-bold">{(leaveBalance as any)[k] ?? 0}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holiday List */}
      {holidays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {holidays
                .map(dateStr => {
                  const [year, month, day] = dateStr.split('-').map(Number);
                  return { dateStr, date: new Date(year, month - 1, day) };
                })
                .filter(({ date }) => date >= new Date(new Date().setHours(0, 0, 0, 0)))
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 10)
                .map(({ dateStr, date }) => (
                  <div key={dateStr} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-sm font-medium">
                      {format(date, 'EEEE, MMMM dd, yyyy')}
                    </span>
                    <Badge variant="secondary">Holiday</Badge>
                  </div>
                ))}
              {holidays.filter(dateStr => {
                const [year, month, day] = dateStr.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return date >= new Date(new Date().setHours(0, 0, 0, 0));
              }).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming holidays</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">My Leave Requests</h2>
          <p className="text-sm text-muted-foreground">Apply for leave and view your history.</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? 'Close' : 'Apply Leave'}
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Leave Application</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="leaveType">Leave Type</Label>
                  <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                    <SelectTrigger aria-label="Select leave type">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLeaveTypes.map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center justify-between w-full">
                            <span>{label}</span>
                            {leaveBalance && key !== 'LWP' && key !== 'VACATION' && (
                              <span className="text-xs text-muted-foreground">{(leaveBalance as any)[key] ?? 0} available</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(new Date(startDate + 'T00:00:00'), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate ? new Date(startDate + 'T00:00:00') : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setStartDate(format(date, 'yyyy-MM-dd'));
                          }
                        }}
                        modifiers={{
                          excluded: isDateExcluded,
                        }}
                        modifiersStyles={{
                          excluded: { 
                            textDecoration: 'line-through',
                            color: 'hsl(var(--muted-foreground))',
                            opacity: 0.5,
                          },
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="p-3 border-t bg-muted/30">
                        <div className="flex items-start gap-2 text-xs">
                          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Sundays and holidays are excluded</p>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <span className="line-through opacity-50">00</span> = Excluded
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(new Date(endDate + 'T00:00:00'), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate ? new Date(endDate + 'T00:00:00') : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setEndDate(format(date, 'yyyy-MM-dd'));
                          }
                        }}
                        modifiers={{
                          excluded: isDateExcluded,
                        }}
                        modifiersStyles={{
                          excluded: { 
                            textDecoration: 'line-through',
                            color: 'hsl(var(--muted-foreground))',
                            opacity: 0.5,
                          },
                        }}
                        disabled={(date) => {
                          if (!startDate) return false;
                          return date < new Date(startDate + 'T00:00:00');
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="p-3 border-t bg-muted/30">
                        <div className="flex items-start gap-2 text-xs">
                          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Sundays and holidays are excluded</p>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <span className="line-through opacity-50">00</span> = Excluded
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Duration (working days)</Label>
                  <Input
                    type="number"
                    value={duration}
                    step={0.5}
                    onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                  {startDate && endDate && (
                    <div className="text-xs mt-1 space-y-0.5">
                      <p className="text-muted-foreground">
                        Total: {getTotalDays()} days | Excluded: {getExcludedDatesCount()} days | Working: {duration} days
                      </p>
                      <p className="text-muted-foreground">Adjust for half-days if needed</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required />
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              {formattedLeaves.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No leave requests found</p>
                </div>
              )}

              {formattedLeaves.map((leave) => (
                <div key={leave.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{LEAVE_TYPE_NAMES[leave.leaveType]}</Badge>
                        <div className="text-sm text-muted-foreground">
                          {leave.startDate} — {leave.endDate} · {leave.duration} day{leave.duration > 1 ? 's' : ''}
                        </div>
                      </div>

                      <p className="mt-2 text-sm bg-muted p-2 rounded">{leave.reason}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={
                          leave.status === 'APPROVED' ? 'default' : leave.status === 'REJECTED' ? 'destructive' : 'secondary'
                        }
                      >
                        {leave.status}
                      </Badge>
                      {leave.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelLeave(leave.id)}
                          className="h-8 px-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveTab;
