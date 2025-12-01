import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, Timestamp, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { UserMinus, Plus, Calendar, FileText } from 'lucide-react';

interface Resignation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  resignationDate: string;
  lastWorkingDay: string;
  noticePeriod: number;
  reason: string;
  status: 'submitted' | 'approved' | 'in-clearance' | 'completed';
  remarks: string;
  createdAt: Date;
}

export const ResignationTracking = () => {
  const { organizationId } = useAuth();
  const [resignations, setResignations] = useState<Resignation[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    resignationDate: '',
    lastWorkingDay: '',
    noticePeriod: 30,
    reason: '',
    remarks: ''
  });

  useEffect(() => {
    fetchResignations();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      // Filter employees by organizationId if not super-admin
      let employeesSnapshot;
      if (organizationId) {
        const q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        employeesSnapshot = await getDocs(q);
      } else {
        employeesSnapshot = await getDocs(collection(db, 'employees'));
      }
      const employeesList = employeesSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Employee data:', { id: doc.id, name: data.name, department: data.department });
        return {
          id: doc.id,
          ...data
        };
      });
      setEmployees(employeesList);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchResignations = async () => {
    try {
      // Build query with organizationId filter if not super-admin
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'resignations'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'resignations'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      
      // Fetch all resignations and enrich with employee data if needed
      const data = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const resignationData = docSnapshot.data() as any;
          let department = resignationData.department;
          let designation = resignationData.designation;
          
          // If department or designation is missing, fetch from employee record
          if (!department || !designation) {
            try {
              const employeeDoc = await getDoc(doc(db, 'employees', resignationData.employeeId));
              if (employeeDoc.exists()) {
                const empData = employeeDoc.data();
                department = department || empData.department || 'N/A';
                designation = designation || empData.designation || 'N/A';
                
                // Update the resignation record with the fetched data
                await updateDoc(doc(db, 'resignations', docSnapshot.id), {
                  department: department,
                  designation: designation
                });
              }
            } catch (error) {
              console.error('Error fetching employee data for resignation:', error);
            }
          }
          
          console.log('Resignation data:', { 
            id: docSnapshot.id, 
            employeeName: resignationData.employeeName,
            department: department,
            designation: designation,
            submissionDate: resignationData.submissionDate,
            resignationDate: resignationData.resignationDate
          });
          
          return {
            id: docSnapshot.id,
            ...resignationData,
            department: department || 'N/A',
            designation: designation || 'N/A',
            createdAt: resignationData.createdAt?.toDate() || new Date()
          };
        })
      ) as Resignation[];
      
      setResignations(data);
    } catch (error) {
      console.error('Error fetching resignations:', error);
      toast.error('Failed to fetch resignations');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
      
      if (!selectedEmployee) {
        toast.error('Employee not found');
        return;
      }

      console.log('Selected employee for resignation:', {
        name: selectedEmployee.name,
        department: selectedEmployee.department,
        designation: selectedEmployee.designation
      });

      await addDoc(collection(db, 'resignations'), {
        employeeId: formData.employeeId,
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.employeeCode,
        department: selectedEmployee.department || 'N/A',
        designation: selectedEmployee.designation || 'N/A',
        resignationDate: formData.resignationDate,
        lastWorkingDay: formData.lastWorkingDay,
        noticePeriod: formData.noticePeriod,
        reason: formData.reason,
        status: 'submitted',
        remarks: formData.remarks,
        createdAt: Timestamp.now()
      });

      toast.success('Resignation recorded successfully');
      setIsDialogOpen(false);
      setFormData({
        employeeId: '',
        resignationDate: '',
        lastWorkingDay: '',
        noticePeriod: 30,
        reason: '',
        remarks: ''
      });
      fetchResignations();
    } catch (error) {
      console.error('Error recording resignation:', error);
      toast.error('Failed to record resignation');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: Resignation['status']) => {
    try {
      await updateDoc(doc(db, 'resignations', id), {
        status: newStatus
      });
      toast.success('Status updated successfully');
      fetchResignations();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status: Resignation['status']) => {
    const statusConfig = {
      'submitted': { label: 'Submitted', variant: 'secondary' as const },
      'approved': { label: 'Approved', variant: 'default' as const },
      'in-clearance': { label: 'In Clearance', variant: 'outline' as const },
      'completed': { label: 'Completed', variant: 'default' as const }
    };
    
    const config = statusConfig[status] || { label: 'Unknown', variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Resignation Tracking</h3>
          <p className="text-sm text-muted-foreground">Track and manage employee resignations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Record Resignation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record Employee Resignation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="employee">Employee *</Label>
                  <Select
                    value={formData.employeeId}
                    onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.employeeCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="resignationDate">Resignation Date *</Label>
                  <Input
                    id="resignationDate"
                    type="date"
                    value={formData.resignationDate}
                    onChange={(e) => setFormData({ ...formData, resignationDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="lastWorkingDay">Last Working Day *</Label>
                  <Input
                    id="lastWorkingDay"
                    type="date"
                    value={formData.lastWorkingDay}
                    onChange={(e) => setFormData({ ...formData, lastWorkingDay: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="noticePeriod">Notice Period (Days) *</Label>
                  <Input
                    id="noticePeriod"
                    type="number"
                    value={formData.noticePeriod}
                    onChange={(e) => setFormData({ ...formData, noticePeriod: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="reason">Reason for Resignation *</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Enter reason for resignation"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Additional remarks (optional)"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Recording...' : 'Record Resignation'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="border rounded-lg">
        <div className="min-w-[800px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Resignation Date</TableHead>
                <TableHead>Last Working Day</TableHead>
                <TableHead>Notice Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resignations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No resignations recorded
                  </TableCell>
                </TableRow>
            ) : (
              resignations.map((resignation) => (
                <TableRow key={resignation.id}>
                  <TableCell className="font-medium">{resignation.employeeName}</TableCell>
                  <TableCell>{resignation.employeeCode}</TableCell>
                  <TableCell>{resignation.department || 'N/A'}</TableCell>
                  <TableCell>{(resignation as any).submissionDate || resignation.resignationDate || 'N/A'}</TableCell>
                  <TableCell>{(resignation as any).lastWorkingDate || resignation.lastWorkingDay || 'N/A'}</TableCell>
                  <TableCell>{resignation.noticePeriod} days</TableCell>
                  <TableCell>{getStatusBadge(resignation.status)}</TableCell>
                  <TableCell>
                    <Select
                      value={resignation.status}
                      onValueChange={(value) => updateStatus(resignation.id, value as Resignation['status'])}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="in-clearance">In Clearance</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </ScrollArea>
    </div>
  );
};
