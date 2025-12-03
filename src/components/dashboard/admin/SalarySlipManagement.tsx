import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Plus, Edit, Trash2, Search, Download, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SalarySlip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  month: string;
  year: string;
  basicSalary: number;
  hra: number;
  travelAllowance: number;
  otherAllowances: number;
  taxDeduction: number;
  pfDeduction: number;
  otherDeductions: number;
  netSalary: number;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  salary?: number;
}

const SalarySlipManagement = () => {
  const { toast } = useToast();
  const { organizationId } = useAuth();
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [filteredSlips, setFilteredSlips] = useState<SalarySlip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    employeeId: '',
    month: '',
    year: '',
    basicSalary: '',
    hra: '',
    travelAllowance: '',
    otherAllowances: '',
    taxDeduction: '',
    pfDeduction: '',
    otherDeductions: ''
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    fetchSalarySlips();
    fetchEmployees();
  }, []);

  useEffect(() => {
    let filtered = salarySlips;

    if (searchTerm) {
      filtered = filtered.filter(slip =>
        slip.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        slip.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterMonth) {
      filtered = filtered.filter(slip => slip.month === filterMonth);
    }

    if (filterYear) {
      filtered = filtered.filter(slip => slip.year === filterYear);
    }

    setFilteredSlips(filtered);
  }, [searchTerm, filterMonth, filterYear, salarySlips]);

  const fetchEmployees = async () => {
    try {
      // Filter employees by organizationId if not super-admin
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'employees'));
      }
      const employeeData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(employeeData);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchSalarySlips = async () => {
    try {
      setLoading(true);
      console.log('Fetching salary slips...');
      console.log('Organization ID:', organizationId);
      
      let slipsData: SalarySlip[] = [];
      
      // Try with ordering first (requires composite index)
      try {
        let q;
        if (organizationId) {
          q = query(
            collection(db, 'salary_slips'),
            where('organizationId', '==', organizationId),
            orderBy('year', 'desc'),
            orderBy('month', 'desc')
          );
        } else {
          q = query(collection(db, 'salary_slips'), orderBy('year', 'desc'), orderBy('month', 'desc'));
        }
        const snapshot = await getDocs(q);
        console.log('Salary slips found:', snapshot.docs.length);
        slipsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        })) as SalarySlip[];
      } catch (indexError: any) {
        console.warn('Index error, trying fallback query:', indexError.code);
        // Fallback: fetch without orderBy and sort manually
        let q;
        if (organizationId) {
          q = query(
            collection(db, 'salary_slips'),
            where('organizationId', '==', organizationId)
          );
        } else {
          q = query(collection(db, 'salary_slips'));
        }
        const snapshot = await getDocs(q);
        console.log('Salary slips found (fallback):', snapshot.docs.length);
        slipsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        })) as SalarySlip[];
      }
      
      // Sort by year and month (newest first)
      slipsData.sort((a, b) => {
        if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
        return months.indexOf(b.month) - months.indexOf(a.month);
      });
      
      setSalarySlips(slipsData);
      setFilteredSlips(slipsData);
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      toast({
        title: "Error",
        description: "Failed to fetch salary slips",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateNetSalary = () => {
    const basic = parseFloat(formData.basicSalary) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const travel = parseFloat(formData.travelAllowance) || 0;
    const otherAllow = parseFloat(formData.otherAllowances) || 0;
    const tax = parseFloat(formData.taxDeduction) || 0;
    const pf = parseFloat(formData.pfDeduction) || 0;
    const otherDed = parseFloat(formData.otherDeductions) || 0;

    const totalEarnings = basic + hra + travel + otherAllow;
    const totalDeductions = tax + pf + otherDed;
    return totalEarnings - totalDeductions;
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee && employee.salary) {
      setFormData({
        ...formData,
        employeeId,
        basicSalary: employee.salary.toString(),
        hra: (employee.salary * 0.4).toFixed(2), // 40% HRA
        pfDeduction: (employee.salary * 0.12).toFixed(2) // 12% PF
      });
    } else {
      setFormData({ ...formData, employeeId });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const employee = employees.find(e => e.id === formData.employeeId);
      if (!employee) {
        toast({
          title: "Error",
          description: "Please select an employee",
          variant: "destructive",
        });
        return;
      }

      const netSalary = calculateNetSalary();
      const totalAllowances = (parseFloat(formData.hra) || 0) + 
                             (parseFloat(formData.travelAllowance) || 0) + 
                             (parseFloat(formData.otherAllowances) || 0);
      const totalDeductions = (parseFloat(formData.taxDeduction) || 0) + 
                             (parseFloat(formData.pfDeduction) || 0) + 
                             (parseFloat(formData.otherDeductions) || 0);
      
      const slipData = {
        employeeId: formData.employeeId,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        organizationId: organizationId,
        month: formData.month,
        year: formData.year,
        basicSalary: parseFloat(formData.basicSalary) || 0,
        hra: parseFloat(formData.hra) || 0,
        travelAllowance: parseFloat(formData.travelAllowance) || 0,
        otherAllowances: parseFloat(formData.otherAllowances) || 0,
        allowances: totalAllowances,
        taxDeduction: parseFloat(formData.taxDeduction) || 0,
        pfDeduction: parseFloat(formData.pfDeduction) || 0,
        otherDeductions: parseFloat(formData.otherDeductions) || 0,
        deductions: totalDeductions,
        netSalary,
        status: 'paid'
      };

      if (isEditMode && editingId) {
        await updateDoc(doc(db, 'salary_slips', editingId), slipData);
        toast({
          title: "Success",
          description: "Salary slip updated successfully!",
        });
      } else {
        await addDoc(collection(db, 'salary_slips'), {
          ...slipData,
          createdAt: new Date().toISOString()
        });
        toast({
          title: "Success",
          description: "Salary slip generated successfully!",
        });
      }

      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingId(null);
      resetForm();
      fetchSalarySlips();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Operation failed',
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      month: '',
      year: '',
      basicSalary: '',
      hra: '',
      travelAllowance: '',
      otherAllowances: '',
      taxDeduction: '',
      pfDeduction: '',
      otherDeductions: ''
    });
  };

  const handleEdit = (slip: SalarySlip) => {
    setFormData({
      employeeId: slip.employeeId,
      month: slip.month,
      year: slip.year,
      basicSalary: slip.basicSalary.toString(),
      hra: slip.hra.toString(),
      travelAllowance: slip.travelAllowance.toString(),
      otherAllowances: slip.otherAllowances.toString(),
      taxDeduction: slip.taxDeduction.toString(),
      pfDeduction: slip.pfDeduction.toString(),
      otherDeductions: slip.otherDeductions.toString()
    });
    setEditingId(slip.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setIsEditMode(false);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this salary slip?')) {
      try {
        await deleteDoc(doc(db, 'salary_slips', id));
        toast({
          title: "Success",
          description: "Salary slip deleted successfully!",
        });
        fetchSalarySlips();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete salary slip",
          variant: "destructive",
        });
      }
    }
  };

  const handleDownload = (slip: SalarySlip) => {
    const content = `
SALARY SLIP
${slip.month} ${slip.year}

Employee: ${slip.employeeName}
Employee Code: ${slip.employeeCode}

EARNINGS:
Basic Salary: ₹${slip.basicSalary.toFixed(2)}
HRA: ₹${slip.hra.toFixed(2)}
Travel Allowance: ₹${slip.travelAllowance.toFixed(2)}
Other Allowances: ₹${slip.otherAllowances.toFixed(2)}
Total Earnings: ₹${(slip.basicSalary + slip.hra + slip.travelAllowance + slip.otherAllowances).toFixed(2)}

DEDUCTIONS:
Tax: ₹${slip.taxDeduction.toFixed(2)}
PF: ₹${slip.pfDeduction.toFixed(2)}
Other Deductions: ₹${slip.otherDeductions.toFixed(2)}
Total Deductions: ₹${(slip.taxDeduction + slip.pfDeduction + slip.otherDeductions).toFixed(2)}

NET SALARY: ₹${slip.netSalary.toFixed(2)}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Salary_Slip_${slip.employeeCode}_${slip.month}_${slip.year}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Salary Slips Management
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Generate Salary Slip
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Edit Salary Slip' : 'Generate New Salary Slip'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="employeeId">Employee</Label>
                    <Select 
                      value={formData.employeeId} 
                      onValueChange={handleEmployeeSelect}
                      disabled={isEditMode}
                    >
                      <SelectTrigger id="employeeId">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} ({emp.employeeCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="month">Month</Label>
                    <Select value={formData.month} onValueChange={(value) => setFormData({ ...formData, month: value })}>
                      <SelectTrigger id="month">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                      <SelectTrigger id="year">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Earnings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="basicSalary">Basic Salary (₹)</Label>
                      <Input
                        id="basicSalary"
                        type="number"
                        step="0.01"
                        value={formData.basicSalary}
                        onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hra">HRA (₹)</Label>
                      <Input
                        id="hra"
                        type="number"
                        step="0.01"
                        value={formData.hra}
                        onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="travelAllowance">Travel Allowance (₹)</Label>
                      <Input
                        id="travelAllowance"
                        type="number"
                        step="0.01"
                        value={formData.travelAllowance}
                        onChange={(e) => setFormData({ ...formData, travelAllowance: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherAllowances">Other Allowances (₹)</Label>
                      <Input
                        id="otherAllowances"
                        type="number"
                        step="0.01"
                        value={formData.otherAllowances}
                        onChange={(e) => setFormData({ ...formData, otherAllowances: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Deductions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="taxDeduction">Tax Deduction (₹)</Label>
                      <Input
                        id="taxDeduction"
                        type="number"
                        step="0.01"
                        value={formData.taxDeduction}
                        onChange={(e) => setFormData({ ...formData, taxDeduction: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pfDeduction">PF Deduction (₹)</Label>
                      <Input
                        id="pfDeduction"
                        type="number"
                        step="0.01"
                        value={formData.pfDeduction}
                        onChange={(e) => setFormData({ ...formData, pfDeduction: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherDeductions">Other Deductions (₹)</Label>
                      <Input
                        id="otherDeductions"
                        type="number"
                        step="0.01"
                        value={formData.otherDeductions}
                        onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg">Net Salary:</span>
                    <span className="text-2xl font-bold text-primary">₹{calculateNetSalary().toFixed(2)}</span>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  {isEditMode ? 'Update Salary Slip' : 'Generate Salary Slip'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Filter by year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              {filteredSlips.map(slip => (
                <div key={slip.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-lg">{slip.employeeName}</span>
                        <Badge variant="outline">{slip.employeeCode}</Badge>
                        <Badge>
                          <Calendar className="h-3 w-3 mr-1" />
                          {slip.month} {slip.year}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Basic: </span>
                          <span className="font-medium">₹{slip.basicSalary.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Allowances: </span>
                          <span className="font-medium">₹{(slip.hra + slip.travelAllowance + slip.otherAllowances).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Deductions: </span>
                          <span className="font-medium">₹{(slip.taxDeduction + slip.pfDeduction + slip.otherDeductions).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Net Salary: </span>
                          <span className="font-bold text-primary">₹{slip.netSalary.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(slip)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(slip)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(slip.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredSlips.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Receipt className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No salary slips found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalarySlipManagement;
