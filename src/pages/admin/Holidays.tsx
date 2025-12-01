import Layout from '@/components/Layout';
import HolidayManagement from '@/components/dashboard/admin/HolidayManagement';

const Holidays = () => {
  return (
    <Layout pageTitle="Holiday Management">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <HolidayManagement />
      </div>
    </Layout>
  );
};

export default Holidays;
