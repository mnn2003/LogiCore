import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserRole } from '@/contexts/AuthContext';

interface ImportProgress {
  current: number;
  total: number;
}

export const downloadTemplate = () => {
  try {
    const templateHeaders = {
      name: 'Employee Name',
      employeeCode: 'Employee Code',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      role: 'Role (staff/hr/hod/intern)',
      designation: 'Designation',
      dateOfBirth: 'Date of Birth (YYYY-MM-DD)',
      dateOfJoining: 'Date of Joining (YYYY-MM-DD)',
      departmentId: 'Department ID',
      salary: 'Salary',
      experience: 'Experience (years)',
      pan: 'PAN Number',
      gender: 'Gender (Male/Female)',
      currentAddress: 'Current Address',
      nativeAddress: 'Native Address',
      mobile: 'Mobile Number',
      akaName: 'Also Known As',
      placeOfBirth: 'Place of Birth',
      nationality: 'Nationality',
      nameAsPerBankPassbook: 'Name as per Bank Passbook',
      nameAsPerPAN: 'Name as per PAN',
      nameAsPerAadhar: 'Name as per Aadhar',
      bloodGroup: 'Blood Group',
      height: 'Height',
      weight: 'Weight',
      qualification: 'Qualification',
      previousExperience: 'Previous Experience',
      familyDetails: 'Family Details',
      drivingLicense: 'Driving License',
      passport: 'Passport',
      visa: 'Visa'
    };

    const sampleData = {
      name: 'John Doe',
      employeeCode: 'EMP001',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      address: '123 Main St, City',
      role: 'staff',
      designation: 'Software Engineer',
      dateOfBirth: '1990-01-15',
      dateOfJoining: '2023-01-01',
      departmentId: 'dept-id-here',
      salary: '50000',
      experience: '5',
      pan: 'ABCDE1234F',
      gender: 'Male',
      currentAddress: '123 Main St, City',
      nativeAddress: '456 Home St, Town',
      mobile: '+1234567890',
      akaName: 'Johnny',
      placeOfBirth: 'City Name',
      nationality: 'Country Name',
      nameAsPerBankPassbook: 'John Doe',
      nameAsPerPAN: 'John Doe',
      nameAsPerAadhar: 'John Doe',
      bloodGroup: 'O+',
      height: '175 cm',
      weight: '70 kg',
      qualification: 'Bachelor of Engineering',
      previousExperience: 'Worked at Company XYZ for 3 years',
      familyDetails: 'Father: John Sr., Mother: Jane',
      drivingLicense: 'DL1234567890',
      passport: 'P1234567',
      visa: 'V1234567'
    };

    const worksheet = XLSX.utils.json_to_sheet([sampleData], {
      header: Object.keys(templateHeaders)
    });

    Object.keys(templateHeaders).forEach((key, index) => {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
      worksheet[cellAddress].v = templateHeaders[key as keyof typeof templateHeaders];
    });

    const columnWidths = Object.keys(templateHeaders).map(() => ({ wch: 20 }));
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Template');

    const fileName = `Employee_Import_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success('Template downloaded successfully!');
  } catch (error) {
    console.error('Error generating template:', error);
    toast.error('Failed to generate template');
  }
};

export const importFromExcel = async (
  file: File,
  organizationId: string,
  setImportProgress: (progress: ImportProgress) => void
): Promise<{ successCount: number; errorCount: number; errors: string[] }> => {
  setImportProgress({ current: 0, total: 0 });

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  const totalRows = jsonData.length;
  setImportProgress({ current: 0, total: totalRows });

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < jsonData.length; i++) {
    setImportProgress({ current: i + 1, total: totalRows });
    const row = jsonData[i] as any;
    const rowNumber = i + 2;
    
    try {
      const employeeCode = row['Employee Code'] || row.employeeCode || row.EmployeeCode;
      if (!employeeCode || typeof employeeCode !== 'string' || employeeCode.trim() === '') {
        errors.push(`Row ${rowNumber}: Missing or invalid Employee Code`);
        errorCount++;
        continue;
      }

      const pan = row['PAN Number'] || row.pan || row.PAN;
      if (!pan || typeof pan !== 'string') {
        errors.push(`Row ${rowNumber} (${employeeCode}): Missing PAN Number`);
        errorCount++;
        continue;
      }
      
      const panStr = String(pan).trim();
      if (panStr.length !== 10) {
        errors.push(`Row ${rowNumber} (${employeeCode}): PAN must be exactly 10 characters (found: ${panStr.length})`);
        errorCount++;
        continue;
      }

      const name = row['Employee Name'] || row.name || row.Name;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        errors.push(`Row ${rowNumber} (${employeeCode}): Missing Employee Name`);
        errorCount++;
        continue;
      }
      
      const emailField = row['Email'] || row.email || row.EMAIL;
      if (!emailField || typeof emailField !== 'string' || !emailField.includes('@')) {
        errors.push(`Row ${rowNumber} (${employeeCode}): Valid email address is required`);
        errorCount++;
        continue;
      }
      
      const email = String(emailField).trim();
      const password = panStr.toUpperCase();

      let userCredential;
      try {
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword: createUser } = await import('firebase/auth');
        const secondaryApp = initializeApp(
          {
            apiKey: "AIzaSyBFHgyqk16_cxG1o7EF2OQ8ksxsjA1ENKk",
            authDomain: "pq-hub-906ed.firebaseapp.com",
            projectId: "pq-hub-906ed"
          },
          `Secondary_${Date.now()}_${Math.random()}`
        );
        const secondaryAuth = getAuth(secondaryApp);
        userCredential = await createUser(secondaryAuth, email, password);
        await deleteApp(secondaryApp);
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          errors.push(`Row ${rowNumber} (${employeeCode}): Employee already exists in system`);
        } else if (authError.code === 'auth/invalid-email') {
          errors.push(`Row ${rowNumber} (${employeeCode}): Invalid email format`);
        } else if (authError.code === 'auth/weak-password') {
          errors.push(`Row ${rowNumber} (${employeeCode}): Password too weak`);
        } else {
          errors.push(`Row ${rowNumber} (${employeeCode}): Authentication error - ${authError.message}`);
        }
        errorCount++;
        continue;
      }
      
      const employeeData = {
        name: String(name).trim(),
        employeeCode: employeeCode.trim(),
        email: row['Email'] || row.email || row.Email || '',
        phone: row['Phone'] || row.phone || row.Phone || '',
        address: row['Address'] || row.address || row.Address || '',
        role: (row['Role (staff/hr/hod/intern)'] || row.role || row.Role || 'staff') as UserRole,
        designation: row['Designation'] || row.designation || row.Designation || '',
        dateOfBirth: row['Date of Birth (YYYY-MM-DD)'] || row.dateOfBirth || row.DateOfBirth || '',
        dateOfJoining: row['Date of Joining (YYYY-MM-DD)'] || row.dateOfJoining || row.DateOfJoining || '',
        departmentId: row['Department ID'] || row.departmentId || row.DepartmentId || null,
        salary: row['Salary'] || row.salary || row.Salary || null,
        experience: row['Experience (years)'] || row.experience || row.Experience || null,
        pan: panStr.toUpperCase(),
        gender: row['Gender (Male/Female)'] || row.gender || row.Gender || null,
        currentAddress: row['Current Address'] || row.currentAddress || row.CurrentAddress || '',
        nativeAddress: row['Native Address'] || row.nativeAddress || row.NativeAddress || '',
        mobile: row['Mobile Number'] || row.mobile || row.Mobile || '',
        akaName: row['Also Known As'] || row.akaName || row.AkaName || '',
        placeOfBirth: row['Place of Birth'] || row.placeOfBirth || row.PlaceOfBirth || '',
        nationality: row['Nationality'] || row.nationality || row.Nationality || '',
        nameAsPerBankPassbook: row['Name as per Bank Passbook'] || row.nameAsPerBankPassbook || row.NameAsPerBankPassbook || '',
        nameAsPerPAN: row['Name as per PAN'] || row.nameAsPerPAN || row.NameAsPerPAN || '',
        nameAsPerAadhar: row['Name as per Aadhar'] || row.nameAsPerAadhar || row.NameAsPerAadhar || '',
        bloodGroup: row['Blood Group'] || row.bloodGroup || row.BloodGroup || '',
        height: row['Height'] || row.height || row.Height || '',
        weight: row['Weight'] || row.weight || row.Weight || '',
        qualification: row['Qualification'] || row.qualification || row.Qualification || '',
        previousExperience: row['Previous Experience'] || row.previousExperience || row.PreviousExperience || '',
        familyDetails: row['Family Details'] || row.familyDetails || row.FamilyDetails || '',
        drivingLicense: row['Driving License'] || row.drivingLicense || row.DrivingLicense || '',
        passport: row['Passport'] || row.passport || row.Passport || '',
        visa: row['Visa'] || row.visa || row.Visa || '',
        userId: userCredential.user.uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'employees', userCredential.user.uid), employeeData);
      await setDoc(doc(db, 'user_roles', userCredential.user.uid), {
        role: employeeData.role,
        organizationId: organizationId,
        createdAt: new Date().toISOString()
      });

      successCount++;
    } catch (error: any) {
      console.error(`Error importing row ${rowNumber}:`, error);
      errors.push(`Row ${rowNumber}: ${error.message || 'Unknown error'}`);
      errorCount++;
    }
  }

  return { successCount, errorCount, errors };
};