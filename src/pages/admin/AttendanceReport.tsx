import Layout from '@/components/Layout';
import AttendanceReportHR from '@/components/dashboard/admin/AttendanceReport';

const AttendanceReport = () => {
  return (
    <Layout pageTitle="Attendance Report">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <AttendanceReportHR />
      </div>
    </Layout>
  );
};

export default AttendanceReport;
