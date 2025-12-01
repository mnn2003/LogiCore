import Layout from '@/components/Layout';
import AttendanceManagementComponent from '@/components/dashboard/admin/AttendanceManagement';

const AttendanceManagement = () => {
  return (
    <Layout pageTitle="Attendance Management">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <AttendanceManagementComponent />
      </div>
    </Layout>
  );
};

export default AttendanceManagement;
