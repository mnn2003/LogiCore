import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, Phone, Building2, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Employee {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  employeeCode: string;
  photoURL?: string;
  designation?: string;
}

const EmployeeDirectoryContent = () => {
  const { organizationId } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, [organizationId]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      console.log('Current organizationId:', organizationId);
      
      // Filter by organizationId to show only employees from the same organization
      const q = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
        : collection(db, 'employees');
      const empSnapshot = await getDocs(q);
      
      console.log('Total employees fetched:', empSnapshot.size);
      
      const empList = empSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Employee data:', { 
          name: data.name, 
          department: data.department, 
          organizationId: data.organizationId 
        });
        return {
          userId: data.userId,
          name: data.name || 'N/A',
          email: data.email || 'N/A',
          phone: data.phone || data.mobile || '',
          department: data.department || 'N/A',
          employeeCode: data.employeeCode || 'N/A',
          photoURL: data.profileImageUrl || data.photoURL || '',
          designation: data.designation || ''
        };
      });
      
      setEmployees(empList);

      // Extract unique departments (exclude 'N/A' and empty values)
      const uniqueDepts = Array.from(
        new Set(
          empList
            .map(e => e.department)
            .filter(d => d && d !== 'N/A' && d.trim() !== '')
        )
      ).sort();
      
      console.log('Unique departments found:', uniqueDepts);
      console.log('Department count:', uniqueDepts.length);
      setDepartments(uniqueDepts);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === 'all' || employee.department === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold">Employee Directory</h2>
          <p className="text-sm text-muted-foreground">View and search employee information</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or employee code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <Label>Department</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.length > 0 ? (
                      departments.map(dept => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-dept" disabled>
                        No departments found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading employees...</div>
      ) : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No employees found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <Card key={employee.userId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={employee.photoURL} alt={employee.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{employee.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {employee.employeeCode}
                    </Badge>
                    {employee.designation && (
                      <p className="text-sm text-muted-foreground mt-1">{employee.designation}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{employee.email}</span>
                </div>
                
                {employee.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{employee.department}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeDirectoryContent;
