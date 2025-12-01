import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { DollarSign, Plus, FileText } from 'lucide-react';

interface Settlement {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  salaryDue: number;
  leaveEncashment: number;
  bonus: number;
  gratuity: number;
  noticePeriodRecovery: number;
  otherRecoveries: number;
  otherPayments: number;
  totalPayable: number;
  totalDeductions: number;
  netSettlement: number;
  status: 'draft' | 'approved' | 'paid';
  remarks: string;
  createdAt: Date;
}

export const FullFinalSettlement = () => {
  const { organizationId } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [clearances, setClearances] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    salaryDue: 0,
    leaveEncashment: 0,
    bonus: 0,
    gratuity: 0,
    noticePeriodRecovery: 0,
    otherRecoveries: 0,
    otherPayments: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchSettlements();
    fetchClearances();
  }, []);

  const fetchClearances = async () => {
    try {
      // Filter clearances by organizationId if not super-admin
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'clearances'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'clearances'));
      }
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClearances(data.filter((c: any) => c.overallStatus === 'completed'));
    } catch (error) {
      console.error('Error fetching clearances:', error);
    }
  };

  const fetchSettlements = async () => {
    try {
      // Build query with organizationId filter if not super-admin
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'settlements'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'settlements'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        createdAt: (doc.data() as any).createdAt?.toDate() || new Date()
      })) as Settlement[];
      setSettlements(data);
    } catch (error) {
      console.error('Error fetching settlements:', error);
      toast.error('Failed to fetch settlements');
    }
  };

  const calculateSettlement = () => {
    const totalPayable = 
      Number(formData.salaryDue) + 
      Number(formData.leaveEncashment) + 
      Number(formData.bonus) + 
      Number(formData.gratuity) + 
      Number(formData.otherPayments);
    
    const totalDeductions = 
      Number(formData.noticePeriodRecovery) + 
      Number(formData.otherRecoveries);
    
    const netSettlement = totalPayable - totalDeductions;
    
    return { totalPayable, totalDeductions, netSettlement };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedClearance = clearances.find(c => c.employeeId === formData.employeeId);
      
      if (!selectedClearance) {
        toast.error('Clearance not found');
        return;
      }

      const { totalPayable, totalDeductions, netSettlement } = calculateSettlement();

      await addDoc(collection(db, 'settlements'), {
        ...formData,
        employeeName: selectedClearance.employeeName,
        employeeCode: selectedClearance.employeeCode,
        totalPayable,
        totalDeductions,
        netSettlement,
        status: 'draft',
        createdAt: Timestamp.now()
      });

      toast.success('Settlement calculated successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchSettlements();
    } catch (error) {
      console.error('Error calculating settlement:', error);
      toast.error('Failed to calculate settlement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      salaryDue: 0,
      leaveEncashment: 0,
      bonus: 0,
      gratuity: 0,
      noticePeriodRecovery: 0,
      otherRecoveries: 0,
      otherPayments: 0,
      remarks: ''
    });
  };

  const { totalPayable, totalDeductions, netSettlement } = calculateSettlement();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Full & Final Settlement</h3>
          <p className="text-sm text-muted-foreground">Calculate and manage employee settlements</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Calculate Settlement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Full & Final Settlement Calculation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
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
                    {clearances.map(c => (
                      <SelectItem key={c.employeeId} value={c.employeeId}>
                        {c.employeeName} - {c.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-semibold text-green-600">Payable Components</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="salaryDue">Salary Due</Label>
                      <Input
                        id="salaryDue"
                        type="number"
                        step="0.01"
                        value={formData.salaryDue}
                        onChange={(e) => setFormData({ ...formData, salaryDue: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="leaveEncashment">Leave Encashment</Label>
                      <Input
                        id="leaveEncashment"
                        type="number"
                        step="0.01"
                        value={formData.leaveEncashment}
                        onChange={(e) => setFormData({ ...formData, leaveEncashment: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bonus">Bonus</Label>
                      <Input
                        id="bonus"
                        type="number"
                        step="0.01"
                        value={formData.bonus}
                        onChange={(e) => setFormData({ ...formData, bonus: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gratuity">Gratuity</Label>
                      <Input
                        id="gratuity"
                        type="number"
                        step="0.01"
                        value={formData.gratuity}
                        onChange={(e) => setFormData({ ...formData, gratuity: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="otherPayments">Other Payments</Label>
                      <Input
                        id="otherPayments"
                        type="number"
                        step="0.01"
                        value={formData.otherPayments}
                        onChange={(e) => setFormData({ ...formData, otherPayments: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-semibold text-red-600">Deductions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="noticePeriodRecovery">Notice Period Recovery</Label>
                      <Input
                        id="noticePeriodRecovery"
                        type="number"
                        step="0.01"
                        value={formData.noticePeriodRecovery}
                        onChange={(e) => setFormData({ ...formData, noticePeriodRecovery: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="otherRecoveries">Other Recoveries</Label>
                      <Input
                        id="otherRecoveries"
                        type="number"
                        step="0.01"
                        value={formData.otherRecoveries}
                        onChange={(e) => setFormData({ ...formData, otherRecoveries: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total Payable:</span>
                      <span className="text-green-600 font-semibold">₹{totalPayable.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Total Deductions:</span>
                      <span className="text-red-600 font-semibold">₹{totalDeductions.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg">
                      <span className="font-bold">Net Settlement:</span>
                      <span className="font-bold">₹{netSettlement.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional remarks"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Settlement'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="border rounded-lg">
        <div className="min-w-[700px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Total Payable</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Settlement</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No settlements calculated
                  </TableCell>
                </TableRow>
            ) : (
              settlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell className="font-medium">{settlement.employeeName}</TableCell>
                  <TableCell>{settlement.employeeCode}</TableCell>
                  <TableCell className="text-green-600">₹{settlement.totalPayable.toFixed(2)}</TableCell>
                  <TableCell className="text-red-600">₹{settlement.totalDeductions.toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">₹{settlement.netSettlement.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={
                      settlement.status === 'paid' ? 'default' :
                      settlement.status === 'approved' ? 'secondary' : 'outline'
                    }>
                      {settlement.status}
                    </Badge>
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
