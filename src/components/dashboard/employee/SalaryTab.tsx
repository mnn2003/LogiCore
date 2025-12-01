import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';

const SalaryTab = () => {
  const { user } = useAuth();
  const [salarySlips, setSalarySlips] = useState<any[]>([]);

  useEffect(() => {
    fetchSalarySlips();
  }, [user]);

  const fetchSalarySlips = async () => {
    if (!user) return;
    const q = query(
      collection(db, 'salary_slips'),
      where('employeeId', '==', user.uid),
      orderBy('month', 'desc')
    );
    const snapshot = await getDocs(q);
    setSalarySlips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10">
        <CardTitle className="flex items-center gap-2 text-xl">
          <DollarSign className="h-6 w-6 text-green-600" />
          Salary Slips
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {salarySlips.map(slip => (
            <div key={slip.id} className="flex flex-col md:flex-row justify-between md:items-center p-5 border rounded-lg bg-gradient-to-r from-green-500/5 to-transparent hover:from-green-500/10 transition-colors gap-3">
              <div className="flex-1">
                <p className="font-bold text-lg">{slip.month} {slip.year}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Basic: ₹{slip.basicSalary?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    HRA: ₹{slip.hra?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Travel Allowance: ₹{slip.travelAllowance?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Other Allowances: ₹{slip.otherAllowances?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium border-t pt-1 mt-1">
                    Total Allowances: ₹{((slip.hra || 0) + (slip.travelAllowance || 0) + (slip.otherAllowances || 0)).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Tax: ₹{slip.taxDeduction?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PF: ₹{slip.pfDeduction?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Other Deductions: ₹{slip.otherDeductions?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium border-t pt-1 mt-1">
                    Total Deductions: ₹{((slip.taxDeduction || 0) + (slip.pfDeduction || 0) + (slip.otherDeductions || 0)).toLocaleString()}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <p className="text-base font-semibold text-green-600">
                    Net Salary: ₹{slip.netSalary?.toLocaleString()}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30 w-fit">
                Paid
              </Badge>
            </div>
          ))}
          {salarySlips.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No salary slips available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalaryTab;
