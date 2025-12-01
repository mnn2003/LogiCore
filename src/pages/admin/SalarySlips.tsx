import Layout from '@/components/Layout';
import SalarySlipManagement from '@/components/dashboard/admin/SalarySlipManagement';

const SalarySlips = () => {
  return (
    <Layout pageTitle="Salary Slip Management">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <SalarySlipManagement />
      </div>
    </Layout>
  );
};

export default SalarySlips;
