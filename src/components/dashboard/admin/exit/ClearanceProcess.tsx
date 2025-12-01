import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ClearanceItem {
  department: string;
  status: 'pending' | 'approved' | 'rejected';
  clearedBy: string;
  clearedDate: string;
  remarks: string;
}

interface Clearance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  items: ClearanceItem[];
  overallStatus: 'in-progress' | 'completed' | 'rejected';
  createdAt: Date;
}

export const ClearanceProcess = () => {
  const { organizationId } = useAuth();
  const [clearances, setClearances] = useState<Clearance[]>([]);
  const [resignations, setResignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClearance, setSelectedClearance] = useState<Clearance | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    fetchDepartments();
    fetchClearances();
    fetchResignations();
  }, []);

  const fetchDepartments = async () => {
    try {
      // Filter departments by organizationId if not super-admin
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'departments'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'departments'));
      }
      const deptNames = snapshot.docs.map(doc => doc.data().name || '').filter(name => name);
      setDepartments(deptNames);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to fetch departments');
    }
  };

  const fetchResignations = async () => {
    try {
      // Filter resignations by organizationId if not super-admin
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'resignations'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'resignations'));
      }
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResignations(data.filter((r: any) => r.status === 'approved' || r.status === 'in-clearance'));
    } catch (error) {
      console.error('Error fetching resignations:', error);
    }
  };

  const fetchClearances = async () => {
    try {
      // Build query with organizationId filter if not super-admin
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'clearances'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'clearances'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        createdAt: (doc.data() as any).createdAt?.toDate() || new Date()
      })) as Clearance[];
      setClearances(data);
    } catch (error) {
      console.error('Error fetching clearances:', error);
      toast.error('Failed to fetch clearances');
    }
  };

  const handleInitiateClearance = async () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    if (departments.length === 0) {
      toast.error('No departments found. Please add departments first.');
      return;
    }

    setLoading(true);
    try {
      const selectedResignation = resignations.find(r => r.employeeId === selectedEmployeeId);
      
      if (!selectedResignation) {
        toast.error('Resignation not found');
        return;
      }

      const initialItems: ClearanceItem[] = departments.map(dept => ({
        department: dept,
        status: 'pending',
        clearedBy: '',
        clearedDate: '',
        remarks: ''
      }));

      await addDoc(collection(db, 'clearances'), {
        employeeId: selectedEmployeeId,
        employeeName: selectedResignation.employeeName,
        employeeCode: selectedResignation.employeeCode,
        items: initialItems,
        overallStatus: 'in-progress',
        createdAt: Timestamp.now()
      });

      // Update resignation status
      const resignationDoc = resignations.find(r => r.employeeId === selectedEmployeeId);
      if (resignationDoc) {
        await updateDoc(doc(db, 'resignations', resignationDoc.id), {
          status: 'in-clearance'
        });
      }

      toast.success('Clearance process initiated successfully');
      setIsDialogOpen(false);
      setSelectedEmployeeId('');
      fetchClearances();
      fetchResignations();
    } catch (error) {
      console.error('Error initiating clearance:', error);
      toast.error('Failed to initiate clearance');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClearance = async (clearanceId: string, itemIndex: number, updatedItem: ClearanceItem) => {
    if (!selectedClearance) return;

    setLoading(true);
    try {
      const updatedItems = [...selectedClearance.items];
      updatedItems[itemIndex] = {
        ...updatedItem,
        clearedDate: new Date().toISOString()
      };

      const allApproved = updatedItems.every(item => item.status === 'approved');
      const anyRejected = updatedItems.some(item => item.status === 'rejected');
      
      const overallStatus = anyRejected ? 'rejected' : 
                           allApproved ? 'completed' : 'in-progress';

      await updateDoc(doc(db, 'clearances', clearanceId), {
        items: updatedItems,
        overallStatus
      });

      toast.success('Clearance updated successfully');
      fetchClearances();
      setEditDialogOpen(false);
      setSelectedClearance(null);
    } catch (error) {
      console.error('Error updating clearance:', error);
      toast.error('Failed to update clearance');
    } finally {
      setLoading(false);
    }
  };

  const getClearanceProgress = (items: ClearanceItem[]) => {
    const approved = items.filter(item => item.status === 'approved').length;
    return (approved / items.length) * 100;
  };

  const openEditDialog = (clearance: Clearance) => {
    setSelectedClearance(clearance);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Clearance Process</h3>
          <p className="text-sm text-muted-foreground">Manage departmental clearances for exiting employees</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Initiate Clearance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Initiate Clearance Process</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Employee</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {resignations.map(res => (
                      <SelectItem key={res.employeeId} value={res.employeeId}>
                        {res.employeeName} - {res.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                This will create a clearance checklist for all departments.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInitiateClearance} disabled={loading}>
                  {loading ? 'Initiating...' : 'Initiate Clearance'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {clearances.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No clearance processes initiated
            </CardContent>
          </Card>
        ) : (
          clearances.map((clearance) => (
            <Card key={clearance.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{clearance.employeeName}</h4>
                      <p className="text-sm text-muted-foreground">{clearance.employeeCode}</p>
                    </div>
                    <Badge variant={
                      clearance.overallStatus === 'completed' ? 'default' :
                      clearance.overallStatus === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {clearance.overallStatus}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Clearance Progress</span>
                      <span>{Math.round(getClearanceProgress(clearance.items))}%</span>
                    </div>
                    <Progress value={getClearanceProgress(clearance.items)} />
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <ScrollArea>
                      <div className="min-w-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Department</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Cleared By</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                        {clearance.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.department}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                {item.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                                {item.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                                <span className="capitalize">{item.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>{item.clearedBy || '-'}</TableCell>
                            <TableCell>
                              {item.clearedDate ? new Date(item.clearedDate).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedClearance(clearance);
                                  setEditDialogOpen(true);
                                }}
                              >
                                Update
                              </Button>
                            </TableCell>
                          </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Clearance Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Clearance Status</DialogTitle>
          </DialogHeader>
          {selectedClearance && (
            <div className="space-y-4">
              {selectedClearance.items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-3">
                    <h4 className="font-semibold">{item.department}</h4>
                    <div className="grid gap-3">
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={item.status}
                          onValueChange={(value: any) => {
                            const updated = { ...item, status: value };
                            handleUpdateClearance(selectedClearance.id, index, updated);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Cleared By</Label>
                        <input
                          type="text"
                          value={item.clearedBy}
                          onChange={(e) => {
                            const updatedItems = [...selectedClearance.items];
                            updatedItems[index] = { ...item, clearedBy: e.target.value };
                            setSelectedClearance({ ...selectedClearance, items: updatedItems });
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="Enter name"
                        />
                      </div>
                      <div>
                        <Label>Remarks</Label>
                        <Textarea
                          value={item.remarks}
                          onChange={(e) => {
                            const updatedItems = [...selectedClearance.items];
                            updatedItems[index] = { ...item, remarks: e.target.value };
                            setSelectedClearance({ ...selectedClearance, items: updatedItems });
                          }}
                          placeholder="Additional remarks"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
