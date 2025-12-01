import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { User, Edit, Plus, AlertCircle, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DEFAULT_LEAVE_BALANCE = {
  PL: 30,
  CL: 2,
  SL: 7,
  WFH: 15,
  MATERNITY: 182,
  PATERNITY: 14,
  ADOPTION: 84,
  SABBATICAL: 0,
  BEREAVEMENT: 10,
  PARENTAL: 10,
  COMP_OFF: 0,
};

const LeaveManagement = () => {
  const { organizationId } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editBalance, setEditBalance] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastAllocation, setLastAllocation] = useState(null);
  const [canAllocate, setCanAllocate] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await fetchEmployeesWithBalances();
      await checkLastAllocation();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const checkLastAllocation = async () => {
    try {
      const allocationDoc = await getDoc(doc(db, 'system_settings', 'leave_allocation'));
      if (allocationDoc.exists()) {
        const lastDate = allocationDoc.data().lastAllocation;
        setLastAllocation(lastDate);

        const lastAllocationDate = new Date(lastDate);
        const now = new Date();
        const isSameMonth =
          lastAllocationDate.getMonth() === now.getMonth() &&
          lastAllocationDate.getFullYear() === now.getFullYear();
        setCanAllocate(!isSameMonth);
      }
    } catch (error) {
      console.error('Error checking last allocation:', error);
    }
  };

  const fetchEmployeesWithBalances = async () => {
    try {
      setLoading(true);
      // Filter employees by organizationId if not super-admin
      let employeesSnapshot;
      if (organizationId) {
        const q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        employeesSnapshot = await getDocs(q);
      } else {
        employeesSnapshot = await getDocs(collection(db, 'employees'));
      }

      const data = await Promise.all(
        employeesSnapshot.docs.map(async (employeeDoc) => {
          const empData = employeeDoc.data();
          const balanceRef = doc(db, 'leave_balances', employeeDoc.id);
          const balanceDoc = await getDoc(balanceRef);

          let balance;
          if (balanceDoc.exists()) {
            balance = balanceDoc.data();
          } else {
            balance = {
              employeeId: employeeDoc.id,
              ...DEFAULT_LEAVE_BALANCE,
              lastUpdated: new Date().toISOString(),
            };
            await setDoc(balanceRef, balance);
          }

          return {
            id: employeeDoc.id,
            name: empData.name || 'Unknown',
            employeeCode: empData.employeeCode || '',
            department: empData.department || '—',
            balance,
          };
        })
      );

      setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBalance = (employee) => {
    setSelectedEmployee(employee);
    setEditBalance(JSON.parse(JSON.stringify(employee.balance)));
    setIsDialogOpen(true);
  };

  const handleUpdateBalance = async () => {
    if (!selectedEmployee || !editBalance) return;

    try {
      await updateDoc(doc(db, 'leave_balances', selectedEmployee.id), {
        ...editBalance,
        lastUpdated: new Date().toISOString(),
      });
      toast.success('Leave balance updated successfully');
      setIsDialogOpen(false);
      setEmployees((prev) =>
        prev.map((e) => (e.id === selectedEmployee.id ? { ...e, balance: editBalance } : e))
      );
    } catch (error) {
      console.error('Error updating balance:', error);
      toast.error('Failed to update leave balance');
    }
  };

  const handleBalanceChange = (leaveType, value) => {
    if (!editBalance) return;
    const numeric = parseFloat(value);
    setEditBalance({
      ...editBalance,
      [leaveType]: Number.isNaN(numeric) ? 0 : numeric,
    });
  };

  const handleAllocateLeaves = async () => {
    if (!canAllocate) {
      toast.error('Monthly leaves have already been allocated this month');
      return;
    }

    const confirmed = window.confirm('Allocate monthly leaves to all employees? This can only be done once per month.');
    if (!confirmed) return;

    try {
      setLoading(true);
      const batch = writeBatch(db);

      employees.forEach((emp) => {
        const balanceRef = doc(db, 'leave_balances', emp.id);
        const current = emp.balance || {};
        const newBalance = {
          employeeId: emp.id,
          PL: (current.PL || 0) + 2.5,
          CL: current.CL ?? DEFAULT_LEAVE_BALANCE.CL,
          SL: current.SL ?? DEFAULT_LEAVE_BALANCE.SL,
          WFH: current.WFH ?? DEFAULT_LEAVE_BALANCE.WFH,
          MATERNITY: current.MATERNITY ?? DEFAULT_LEAVE_BALANCE.MATERNITY,
          PATERNITY: current.PATERNITY ?? DEFAULT_LEAVE_BALANCE.PATERNITY,
          ADOPTION: current.ADOPTION ?? DEFAULT_LEAVE_BALANCE.ADOPTION,
          SABBATICAL: current.SABBATICAL ?? DEFAULT_LEAVE_BALANCE.SABBATICAL,
          BEREAVEMENT: current.BEREAVEMENT ?? DEFAULT_LEAVE_BALANCE.BEREAVEMENT,
          PARENTAL: current.PARENTAL ?? DEFAULT_LEAVE_BALANCE.PARENTAL,
          COMP_OFF: current.COMP_OFF ?? DEFAULT_LEAVE_BALANCE.COMP_OFF,
          lastUpdated: new Date().toISOString(),
        };
        batch.set(balanceRef, newBalance);
      });

      const allocRef = doc(db, 'system_settings', 'leave_allocation');
      batch.set(allocRef, { lastAllocation: new Date().toISOString() });

      await batch.commit();

      toast.success('Monthly leaves allocated to all employees successfully');
      await checkLastAllocation();
      await fetchEmployeesWithBalances();
    } catch (error) {
      console.error('Error allocating leaves:', error);
      toast.error('Failed to allocate leaves');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.name} ${e.employeeCode} ${e.department}`.toLowerCase().includes(q));
  }, [employees, queryText]);

  const toggleExpand = (id) => setExpandedEmployee((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-4 max-w-5xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Leave Balance Management</h2>
          <p className="text-sm text-muted-foreground">Manage employee leave balances efficiently.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search by name, code or dept..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="pr-10"
              aria-label="Search employees"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <Button onClick={handleAllocateLeaves} disabled={!canAllocate}>
            <Plus className="mr-2 h-4 w-4" />
            Allocate Monthly
          </Button>
        </div>
      </div>

      {!canAllocate && lastAllocation && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Monthly leaves were already allocated on {new Date(lastAllocation).toLocaleDateString()}. Allocate again next
            month.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Employee Leave Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-muted p-4 rounded-lg h-20" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No employees found.</div>
              )}

              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{employee.name}</p>
                          {employee.employeeCode && (
                            <Badge variant="outline" className="text-xs">
                              {employee.employeeCode}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {employee.department}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">PL</span>
                            <div className="text-sm">{employee.balance?.PL ?? 0}</div>
                          </div>
                          <div>
                            <span className="font-medium text-foreground">CL</span>
                            <div className="text-sm">{employee.balance?.CL ?? 0}</div>
                          </div>
                          <div>
                            <span className="font-medium text-foreground">SL</span>
                            <div className="text-sm">{employee.balance?.SL ?? 0}</div>
                          </div>
                          <div>
                            <span className="font-medium text-foreground">WFH</span>
                            <div className="text-sm">{employee.balance?.WFH ?? 0}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col gap-2">
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(employee.id)}>
                        {expandedEmployee === employee.id ? 'Hide' : 'Details'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEditBalance(employee)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>

                  {expandedEmployee === employee.id && (
                    <div className="mt-3 border-t pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Comp Off</div>
                        <div className="font-medium">{employee.balance?.COMP_OFF ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Parental</div>
                        <div className="font-medium">{employee.balance?.PARENTAL ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Bereavement</div>
                        <div className="font-medium">{employee.balance?.BEREAVEMENT ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sabbatical</div>
                        <div className="font-medium">{employee.balance?.SABBATICAL ?? 0}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>Edit Leave Balance {selectedEmployee ? `- ${selectedEmployee.name}` : ''}</DialogTitle>
          </DialogHeader>

          {editBalance && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(DEFAULT_LEAVE_BALANCE).map((type) => (
                  <div key={type} className="space-y-2">
                    <Label>{type.replace('_', ' ')} Leave</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editBalance[type]}
                      onChange={(e) => handleBalanceChange(type, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateBalance}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;
