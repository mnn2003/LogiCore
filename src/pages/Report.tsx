import Layout from '@/components/Layout';
import AttendanceReport from '@/components/dashboard/employee/AttendanceReport';

const Report = () => {
  return (
    <Layout pageTitle="Report">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <AttendanceReport />
      </div>
    </Layout>
  );
};

export default Report;
