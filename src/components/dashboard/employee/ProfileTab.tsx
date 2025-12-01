import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'react-hot-toast';
import { User, Lock, Upload, MapPin, GraduationCap, Briefcase, Users, FileText, Heart } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { query, collection, where, getDocs } from 'firebase/firestore';

const ProfileTab = () => {
  const { user, changePassword } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    employeeCode: '',
    address: '',
    phone: '',
    profileImageUrl: '',
    departmentId: '',
    // Contact Details
    currentAddress: '',
    nativeAddress: '',
    email: '',
    mobile: '',
    // Personal Details
    akaName: '',
    placeOfBirth: '',
    nationality: '',
    nameAsPerBankPassbook: '',
    nameAsPerPAN: '',
    nameAsPerAadhar: '',
    bloodGroup: '',
    height: '',
    weight: '',
    // Qualification
    qualification: '',
    // Previous Experience
    previousExperience: '',
    // Family Details
    familyDetails: '',
    // Documents
    drivingLicense: '',
    passport: '',
    visa: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [hodInfo, setHodInfo] = useState<{ name: string; email: string } | null>(null);
  const [leaveApprovers, setLeaveApprovers] = useState<Array<{ name: string; email: string; role: string }>>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const profileDoc = await getDoc(doc(db, 'employees', user.uid));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data() as any;
          setProfile(profileData);
          
          // Fetch HOD if employee has a department
          if (profileData.departmentId) {
            await fetchHOD(profileData.departmentId);
          }
        }
        
        // Fetch leave approvers
        await fetchLeaveApprovers();
      }
    };
    fetchProfile();
  }, [user]);

  const fetchHOD = async (departmentId: string) => {
    try {
      // Get department details
      const deptDoc = await getDoc(doc(db, 'departments', departmentId));
      if (deptDoc.exists()) {
        const deptData = deptDoc.data();
        if (deptData.hodId) {
          // Get HOD employee details
          const hodDoc = await getDoc(doc(db, 'employees', deptData.hodId));
          if (hodDoc.exists()) {
            const hodData = hodDoc.data();
            setHodInfo({
              name: hodData.name || 'N/A',
              email: hodData.email || 'N/A'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching HOD:', error);
    }
  };

  const fetchLeaveApprovers = async () => {
    try {
      const { query: firestoreQuery, collection, where, getDocs } = await import('firebase/firestore');
      
      // Get HR users
      const hrQuery = firestoreQuery(collection(db, 'user_roles'), where('role', '==', 'hr'));
      const hrSnapshot = await getDocs(hrQuery);
      
      // Get HOD users
      const hodQuery = firestoreQuery(collection(db, 'user_roles'), where('role', '==', 'hod'));
      const hodSnapshot = await getDocs(hodQuery);
      
      const approvers: Array<{ name: string; email: string; role: string }> = [];
      
      // Fetch HR employee details
      for (const hrDoc of hrSnapshot.docs) {
        const userId = hrDoc.data().userId;
        const empDoc = await getDoc(doc(db, 'employees', userId));
        if (empDoc.exists()) {
          const empData = empDoc.data();
          approvers.push({
            name: empData.name || 'N/A',
            email: empData.email || 'N/A',
            role: 'HR'
          });
        }
      }
      
      // Fetch HOD employee details
      for (const hodDoc of hodSnapshot.docs) {
        const userId = hodDoc.data().userId;
        const empDoc = await getDoc(doc(db, 'employees', userId));
        if (empDoc.exists()) {
          const empData = empDoc.data();
          approvers.push({
            name: empData.name || 'N/A',
            email: empData.email || 'N/A',
            role: 'HOD'
          });
        }
      }
      
      setLeaveApprovers(approvers);
    } catch (error) {
      console.error('Error fetching leave approvers:', error);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await updateDoc(doc(db, 'employees', user!.uid), profile);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profile-photos/${user!.uid}`);
      await uploadBytes(storageRef, file);
      const profileImageUrl = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'employees', user!.uid), { profileImageUrl });
      setProfile({ ...profile, profileImageUrl });
      toast.success('Profile photo updated successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await changePassword(newPassword);
      toast.success('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Failed to change password');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <User className="h-6 w-6 text-primary" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Avatar className="h-32 w-32 border-4 border-primary/20">
              <AvatarImage src={profile.profileImageUrl} />
              <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                {profile.name?.charAt(0) || 'E'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">Upload Profile Photo</label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="bg-muted/50"
                  />
                  <Button disabled={uploading} variant="outline" size="icon">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Max file size: 5MB</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Employee Code</label>
              <Input 
                value={profile.employeeCode} 
                disabled 
                className="bg-muted/30"
              />
            </div>
          </div>
          
          <Button onClick={handleUpdateProfile} size="lg" className="w-full md:w-auto">
            Update Profile
          </Button>
        </CardContent>
      </Card>

      {/* My Approvers Section */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-primary" />
            My Approvers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {hodInfo && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h3 className="text-sm font-semibold text-primary mb-2">Head of Department (HOD)</h3>
              <div className="space-y-1">
                <p className="text-sm"><span className="font-medium">Name:</span> {hodInfo.name}</p>
                <p className="text-sm"><span className="font-medium">Email:</span> {hodInfo.email}</p>
              </div>
            </div>
          )}
          
          <div className="p-4 border rounded-lg bg-muted/30">
            <h3 className="text-sm font-semibold text-primary mb-3">Leave Approvers</h3>
            <div className="space-y-3">
              {leaveApprovers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approvers found</p>
              ) : (
                leaveApprovers.map((approver, index) => (
                  <div key={index} className="flex items-start justify-between p-3 bg-background rounded-md border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{approver.name}</p>
                      <p className="text-xs text-muted-foreground">{approver.email}</p>
                    </div>
                    <Badge variant="secondary">{approver.role}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Details */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-6 w-6 text-primary" />
            Contact Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Mobile Number</label>
              <Input
                value={profile.mobile}
                onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                className="bg-muted/50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Current Address</label>
            <Textarea
              value={profile.currentAddress}
              onChange={(e) => setProfile({ ...profile, currentAddress: e.target.value })}
              className="bg-muted/50"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Native Address</label>
            <Textarea
              value={profile.nativeAddress}
              onChange={(e) => setProfile({ ...profile, nativeAddress: e.target.value })}
              className="bg-muted/50"
              rows={3}
            />
          </div>
          <Button onClick={handleUpdateProfile} size="lg" className="w-full md:w-auto">
            Update Contact Details
          </Button>
        </CardContent>
      </Card>

      {/* Personal Details */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Heart className="h-6 w-6 text-primary" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">A.K.A. Name</label>
              <Input
                value={profile.akaName}
                onChange={(e) => setProfile({ ...profile, akaName: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Place of Birth</label>
              <Input
                value={profile.placeOfBirth}
                onChange={(e) => setProfile({ ...profile, placeOfBirth: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nationality</label>
              <Input
                value={profile.nationality}
                onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name as per Bank Passbook</label>
              <Input
                value={profile.nameAsPerBankPassbook}
                onChange={(e) => setProfile({ ...profile, nameAsPerBankPassbook: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name as per PAN Card</label>
              <Input
                value={profile.nameAsPerPAN}
                onChange={(e) => setProfile({ ...profile, nameAsPerPAN: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name as per Aadhar Card</label>
              <Input
                value={profile.nameAsPerAadhar}
                onChange={(e) => setProfile({ ...profile, nameAsPerAadhar: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
              <Input
                value={profile.bloodGroup}
                onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
                className="bg-muted/50"
                placeholder="e.g., A+ve"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Height (cm)</label>
              <Input
                type="number"
                value={profile.height}
                onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Weight (kg)</label>
              <Input
                type="number"
                value={profile.weight}
                onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                className="bg-muted/50"
              />
            </div>
          </div>
          <Button onClick={handleUpdateProfile} size="lg" className="w-full md:w-auto">
            Update Personal Details
          </Button>
        </CardContent>
      </Card>

      {/* Qualification */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-6 w-6 text-primary" />
            Qualification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Educational Qualification</label>
            <Textarea
              value={profile.qualification}
              onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
              className="bg-muted/50"
              rows={4}
              placeholder="List your educational qualifications..."
            />
          </div>
          <Button onClick={handleUpdateProfile} size="lg" className="w-full md:w-auto">
            Update Qualification
          </Button>
        </CardContent>
      </Card>

      {/* Previous Experience */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Briefcase className="h-6 w-6 text-primary" />
            Previous Experience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Work Experience</label>
            <Textarea
              value={profile.previousExperience}
              onChange={(e) => setProfile({ ...profile, previousExperience: e.target.value })}
              className="bg-muted/50"
              rows={4}
              placeholder="List your previous work experience..."
            />
          </div>
          <Button onClick={handleUpdateProfile} size="lg" className="w-full md:w-auto">
            Update Experience
          </Button>
        </CardContent>
      </Card>

      {/* Family Details */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-primary" />
            Family Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Family Information</label>
            <Textarea
              value={profile.familyDetails}
              onChange={(e) => setProfile({ ...profile, familyDetails: e.target.value })}
              className="bg-muted/50"
              rows={4}
              placeholder="Provide family details..."
            />
          </div>
          <Button onClick={handleUpdateProfile} size="lg" className="w-full md:w-auto">
            Update Family Details
          </Button>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Driving License Number</label>
              <Input
                value={profile.drivingLicense}
                onChange={(e) => setProfile({ ...profile, drivingLicense: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Passport Number</label>
              <Input
                value={profile.passport}
                onChange={(e) => setProfile({ ...profile, passport: e.target.value })}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">VISA Number</label>
              <Input
                value={profile.visa}
                onChange={(e) => setProfile({ ...profile, visa: e.target.value })}
                className="bg-muted/50"
              />
            </div>
          </div>
          <Button onClick={handleUpdateProfile} size="lg" className="w-full md:w-auto">
            Update Documents
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-gradient-to-r from-destructive/5 to-destructive/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-6 w-6 text-destructive" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Confirm Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="bg-muted/50"
            />
          </div>
          <Button onClick={handleChangePassword} variant="destructive" size="lg" className="w-full md:w-auto">
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileTab;
