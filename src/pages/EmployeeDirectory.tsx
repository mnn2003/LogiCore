import Layout from '@/components/Layout';
import EmployeeDirectoryContent from '@/components/employee/EmployeeDirectoryContent';

const EmployeeDirectory = () => {
  return (
    <Layout pageTitle="Employee Directory">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <EmployeeDirectoryContent />
      </div>
    </Layout>
  );
};

export default EmployeeDirectory;
