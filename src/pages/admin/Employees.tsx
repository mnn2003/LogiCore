import Layout from '@/components/Layout';
import EmployeeManagement from '@/components/dashboard/admin/EmployeeManagement';

const Employees = () => {
  return (
    <Layout pageTitle="Employee Management">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <EmployeeManagement />
      </div>
    </Layout>
  );
};

export default Employees;
