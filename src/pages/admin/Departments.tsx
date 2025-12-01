import Layout from '@/components/Layout';
import DepartmentManagement from '@/components/dashboard/admin/DepartmentManagement';

const Departments = () => {
  return (
    <Layout pageTitle="Department Management">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <DepartmentManagement />
      </div>
    </Layout>
  );
};

export default Departments;
