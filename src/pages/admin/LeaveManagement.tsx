import Layout from '@/components/Layout';
import LeaveManagementComponent from '@/components/dashboard/admin/LeaveManagement';

const LeaveManagement = () => {
  return (
    <Layout pageTitle="Leave Management">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <LeaveManagementComponent />
      </div>
    </Layout>
  );
};

export default LeaveManagement;
