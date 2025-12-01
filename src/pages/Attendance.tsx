import Layout from '@/components/Layout';
import AttendanceTab from '@/components/dashboard/employee/AttendanceTab';

const Attendance = () => {
  return (
    <Layout pageTitle="Attendance">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <AttendanceTab />
      </div>
    </Layout>
  );
};

export default Attendance;
