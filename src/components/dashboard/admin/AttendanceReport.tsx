import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileDown, Calendar, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  punchInLocation?: string;
  punchOutLocation?: string;
}

interface Employee {
  userId: string;
  name: string;
  employeeCode: string;
}

const AttendanceReportHR = () => {
  const { userRole, organizationId } = useAuth();
  const currentUser = auth.currentUser;
  const isHR = userRole?.toLowerCase() === 'hr';
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>(isHR ? 'all' : currentUser?.uid || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const initializeData = async () => {
      await fetchEmployees();
    };
    initializeData();
  }, [organizationId]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchAttendance();
    }
  }, [selectedEmployee, startDate, endDate, employees]);

  const fetchEmployees = async () => {
    try {
      // Filter employees by organizationId
      const q = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
        : collection(db, 'employees');
      const empSnapshot = await getDocs(q);
      const empList = empSnapshot.docs.map(doc => ({
        userId: doc.data().userId,
        name: doc.data().name,
        employeeCode: doc.data().employeeCode || ''
      }));
      setEmployees(empList);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let q;
      
      // If user is not HR, only show their own attendance
      if (!isHR && currentUser) {
        q = query(collection(db, 'attendance'), where('employeeId', '==', currentUser.uid), orderBy('date', 'desc'));
      } else if (selectedEmployee !== 'all') {
        // Filter by selected employee and organizationId
        if (organizationId) {
          q = query(
            collection(db, 'attendance'), 
            where('organizationId', '==', organizationId),
            where('employeeId', '==', selectedEmployee), 
            orderBy('date', 'desc')
          );
        } else {
          q = query(collection(db, 'attendance'), where('employeeId', '==', selectedEmployee), orderBy('date', 'desc'));
        }
      } else {
        // Show all attendance for the organization
        if (organizationId) {
          q = query(collection(db, 'attendance'), where('organizationId', '==', organizationId), orderBy('date', 'desc'));
        } else {
          q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
        }
      }

      const snapshot = await getDocs(q);
      let records = snapshot.docs.map(doc => {
        const data = doc.data() as Omit<AttendanceRecord, 'id'>;
        return {
          id: doc.id,
          ...data
        } as AttendanceRecord;
      });

      // Filter by date range if specified
      if (startDate) {
        records = records.filter(r => r.date >= startDate);
      }
      if (endDate) {
        records = records.filter(r => r.date <= endDate);
      }

      // Fetch employee details for each record
      const recordsWithEmployeeData = await Promise.all(
        records.map(async (record) => {
          const employee = employees.find(e => e.userId === record.employeeId);
          return {
            ...record,
            employeeName: employee?.name || 'Unknown',
            employeeCode: employee?.employeeCode || 'N/A'
          };
        })
      );

      setAttendanceRecords(recordsWithEmployeeData);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWorkHours = (punchIn: string, punchOut: string | null) => {
    if (!punchOut) return 'In Progress';
    const hours = (new Date(punchOut).getTime() - new Date(punchIn).getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatLocation = (location: any) => {
    if (!location) return 'N/A';
    if (typeof location === 'string') return location;
    if (typeof location === 'object' && location.lat && location.lng) {
      return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
    return 'N/A';
  };

  const filteredRecords = attendanceRecords.filter(record => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      record.employeeName?.toLowerCase().includes(query) ||
      record.employeeCode?.toLowerCase().includes(query) ||
      record.date.includes(query)
    );
  });

  const exportToCSV = () => {
    const headers = ['Employee Code', 'Employee Name', 'Date', 'Punch In', 'Punch In Location', 'Punch Out', 'Punch Out Location', 'Total Hours'];
    const rows = filteredRecords.map(record => [
      record.employeeCode || 'N/A',
      record.employeeName || 'Unknown',
      record.date,
      formatTime(record.punchIn),
      record.punchInLocation || 'N/A',
      record.punchOut ? formatTime(record.punchOut) : 'N/A',
      record.punchOutLocation || 'N/A',
      calculateWorkHours(record.punchIn, record.punchOut)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const calculateStats = () => {
    const totalRecords = filteredRecords.length;
    let totalHours = 0;
    let completedRecords = 0;

    filteredRecords.forEach(record => {
      if (record.punchOut) {
        const hours = (new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
        completedRecords++;
      }
    });

    return {
      totalRecords,
      totalHours: totalHours.toFixed(2),
      avgHours: completedRecords > 0 ? (totalHours / completedRecords).toFixed(2) : '0'
    };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attendance Report</h2>
          <p className="text-sm text-muted-foreground">View and manage employee attendance records</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{stats.totalRecords}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{stats.totalHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
                <p className="text-2xl font-bold">{stats.avgHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isHR && (
              <div>
                <Label>Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.userId} value={emp.userId}>
                        {emp.name} ({emp.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No attendance records found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Code</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Punch In</TableHead>
                    <TableHead>Punch In Location</TableHead>
                    <TableHead>Punch Out</TableHead>
                    <TableHead>Punch Out Location</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.employeeCode}
                      </TableCell>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell>
                        {format(new Date(record.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{formatTime(record.punchIn)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatLocation(record.punchInLocation)}
                      </TableCell>
                      <TableCell>
                        {record.punchOut ? formatTime(record.punchOut) : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatLocation(record.punchOutLocation)}
                      </TableCell>
                      <TableCell>
                        {calculateWorkHours(record.punchIn, record.punchOut)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.punchOut ? "default" : "secondary"}>
                          {record.punchOut ? 'Complete' : 'In Progress'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceReportHR;
