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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { CalendarIcon, Plus, Info, X, Clock, CalendarDays, FileText, ChevronRight } from 'lucide-react';
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
        return data.date;
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
    
    let workingDays = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const isSunday = current.getDay() === 0;
      const isHoliday = holidays.includes(dateStr);
      
      if (!isSunday && !isHoliday) {
        workingDays++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    setDuration(workingDays);
    return workingDays;
  };

  const isDateExcluded = (date: Date) => {
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

      const empQuery = query(collection(db, 'employees'), where('userId', '==', currentUser.uid));
      const empSnapshot = await getDocs(empQuery);
      const empDoc = empSnapshot.docs[0];
      const employeeData = empDoc ? empDoc.data() : null;
      const employeeName = employeeData?.name || currentUser.email || 'Unknown';
      const employeeCode = employeeData?.employeeCode || '';

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

      setShowForm(false);
      setLeaveType('PL');
      setStartDate('');
      setEndDate('');
      setDuration(1);
      setReason('');

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

  const availableLeaveTypes = useMemo(() => {
    const genderSpecificTypes: Record<string, ('Male' | 'Female')[]> = {
      'MATERNITY': ['Female'],
      'PATERNITY': ['Male']
    };

    return Object.entries(LEAVE_TYPE_NAMES).filter(([key]) => {
      const allowedGenders = genderSpecificTypes[key];
      if (!allowedGenders) return true;
      return employeeGender && allowedGenders.includes(employeeGender);
    });
  }, [employeeGender]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Leave Management</h1>
            <p className="text-gray-600 mt-1">Apply for leave and track your requests</p>
          </div>
          <Button 
            onClick={() => setShowForm((s) => !s)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? 'Close Form' : 'Apply Leave'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {leaveBalance && (['PL', 'CL', 'SL', 'WFH', 'COMP_OFF', 'LWP'] as (keyof LeaveBalance)[]).map((k) => (
          <Card key={k} className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600">{k}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(leaveBalance as any)[k] ?? 0}
                </p>
                <p className="text-xs text-gray-500">Days Available</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form & Holidays */}
        <div className="lg:col-span-2 space-y-6">
          {/* Apply Leave Form */}
          {showForm && (
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">New Leave Application</CardTitle>
                    <CardDescription className="text-gray-600">Fill in the details to apply for leave</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="leaveType" className="text-sm font-medium text-gray-700">
                        Leave Type
                      </Label>
                      <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                        <SelectTrigger className="w-full bg-gray-50 border-gray-200">
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLeaveTypes.map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center justify-between w-full">
                                <span>{label}</span>
                                {leaveBalance && key !== 'LWP' && key !== 'VACATION' && (
                                  <span className="text-xs text-gray-500">{(leaveBalance as any)[key] ?? 0} available</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Duration (days)</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          value={duration}
                          step={0.5}
                          onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
                          min={0}
                          className="bg-gray-50 border-gray-200"
                        />
                        {startDate && endDate && (
                          <div className="text-xs text-gray-500">
                            Working days
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal bg-gray-50 border-gray-200",
                              !startDate && "text-gray-400"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(new Date(startDate + 'T00:00:00'), "PP") : <span>Select date</span>}
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
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal bg-gray-50 border-gray-200",
                              !endDate && "text-gray-400"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(new Date(endDate + 'T00:00:00'), "PP") : <span>Select date</span>}
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
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {startDate && endDate && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="text-center">
                          <p className="text-gray-600">Total Days</p>
                          <p className="font-semibold text-gray-900">{getTotalDays()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600">Excluded</p>
                          <p className="font-semibold text-gray-900">{getExcludedDatesCount()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600">Working Days</p>
                          <p className="font-semibold text-blue-600">{duration}</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 mt-2 text-center">
                        Sundays and holidays are automatically excluded
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-sm font-medium text-gray-700">
                      Reason for Leave
                    </Label>
                    <Textarea 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value)} 
                      rows={3} 
                      required 
                      className="bg-gray-50 border-gray-200"
                      placeholder="Briefly describe the reason for your leave..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      onClick={handleSubmit} 
                      disabled={submitting}
                      className="bg-blue-600 hover:bg-blue-700 flex-1"
                    >
                      {submitting ? 'Submitting...' : 'Submit Application'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowForm(false)}
                      className="border-gray-300 hover:border-gray-400"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Leave History */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Leave History</CardTitle>
                  <CardDescription className="text-gray-600">Track all your leave requests and approvals</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-3">Loading leave history...</p>
                </div>
              ) : formattedLeaves.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">No Leave History</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    You haven't applied for any leaves yet. Click "Apply Leave" to submit your first request.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formattedLeaves.map((leave) => (
                    <div key={leave.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge 
                              className={cn(
                                leave.status === 'APPROVED' && 'bg-green-100 text-green-800 border-green-200',
                                leave.status === 'REJECTED' && 'bg-red-100 text-red-800 border-red-200',
                                leave.status === 'PENDING' && 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              )}
                            >
                              {leave.status}
                            </Badge>
                            <div className="text-sm font-medium text-gray-900">
                              {LEAVE_TYPE_NAMES[leave.leaveType]}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {leave.startDate} to {leave.endDate}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {leave.duration} day{leave.duration > 1 ? 's' : ''}
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border">
                            {leave.reason}
                          </p>
                        </div>
                        
                        {leave.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelLeave(leave.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                            title="Cancel leave"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Holidays & Info */}
        <div className="space-y-6">
          {/* Holidays */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Upcoming Holidays</CardTitle>
                  <CardDescription className="text-gray-600">Public holidays for the year</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {holidays.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No holidays found</p>
                ) : (
                  holidays
                    .map(dateStr => {
                      const [year, month, day] = dateStr.split('-').map(Number);
                      return { dateStr, date: new Date(year, month - 1, day) };
                    })
                    .filter(({ date }) => date >= new Date(new Date().setHours(0, 0, 0, 0)))
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .slice(0, 10)
                    .map(({ dateStr, date }) => (
                      <div key={dateStr} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-gray-900">
                            {format(date, 'MMMM dd')}
                          </span>
                          <span className="text-xs text-gray-500 block">
                            {format(date, 'EEEE')}
                          </span>
                        </div>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          Holiday
                        </Badge>
                      </div>
                    ))
                )}
                {holidays.filter(dateStr => {
                  const [year, month, day] = dateStr.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  return date >= new Date(new Date().setHours(0, 0, 0, 0));
                }).length === 0 && holidays.length > 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No upcoming holidays</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Information */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900">Important Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  Sundays and holidays are automatically excluded from calculations
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  Pending requests can be cancelled anytime
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  Approval typically takes 24-48 hours
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  Check your balance before applying
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeaveTab;
