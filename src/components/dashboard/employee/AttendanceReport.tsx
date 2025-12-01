import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileDown, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

const AttendanceReport = () => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDays: 0,
    totalHours: 0,
    avgHours: 0
  });

  useEffect(() => {
    fetchAttendance();
  }, [user]);

  const fetchAttendance = async () => {
    if (!user) return;
    setLoading(true);
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
      calculateStats(records);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (records: any[]) => {
    let totalHours = 0;
    let daysWithHours = 0;

    records.forEach((record: any) => {
      if (record.punchIn && record.punchOut) {
        const hours = (new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
        daysWithHours++;
      }
    });

    setStats({
      totalDays: records.length,
      totalHours: parseFloat(totalHours.toFixed(2)),
      avgHours: daysWithHours > 0 ? parseFloat((totalHours / daysWithHours).toFixed(2)) : 0
    });
  };

  const calculateWorkHours = (punchIn: string, punchOut: string | null) => {
    if (!punchOut) return 'In Progress';
    const hours = (new Date(punchOut).getTime() - new Date(punchIn).getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Punch In', 'Punch Out', 'Total Hours'];
    const rows = attendanceRecords.map(record => [
      record.date,
      new Date(record.punchIn).toLocaleString(),
      record.punchOut ? new Date(record.punchOut).toLocaleString() : 'N/A',
      calculateWorkHours(record.punchIn, record.punchOut)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Days</p>
                <p className="text-2xl font-bold">{stats.totalDays}</p>
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
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
                <p className="text-2xl font-bold">{stats.avgHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attendance History</CardTitle>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : attendanceRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No attendance records found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Punch In</TableHead>
                    <TableHead>Punch Out</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {new Date(record.punchIn).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </TableCell>
                      <TableCell>
                        {record.punchOut 
                          ? new Date(record.punchOut).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: true 
                            })
                          : '-'
                        }
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

export default AttendanceReport;
