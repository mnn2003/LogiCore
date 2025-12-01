import Layout from '@/components/Layout';
import SalaryTab from '@/components/dashboard/employee/SalaryTab';

const Salary = () => {
  return (
    <Layout pageTitle="Salary">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <SalaryTab />
      </div>
    </Layout>
  );
};

export default Salary;
