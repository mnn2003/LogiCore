import Layout from '@/components/Layout';
import LeaveApprovalsComponent from '@/components/dashboard/admin/LeaveApprovals';

const LeaveApprovals = () => {
  return (
    <Layout pageTitle="Leave Approvals">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <LeaveApprovalsComponent />
      </div>
    </Layout>
  );
};

export default LeaveApprovals;
